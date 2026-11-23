import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, db, isVerifiedAdminUser, storage } from '../lib/firebase';
import { apiUrl } from '../lib/api';

export type MediaFolder =
  | 'products/images'
  | 'products/videos'
  | 'categories'
  | 'hero';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB input limit before client compression
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
const DURABLE_IMAGE_TARGET_BYTES = 540 * 1024; // Guarantees <= 720 KB base64 inside Firestore 1 MiB doc & rules
const DURABLE_IMAGE_MAX_HARD_BYTES = 680 * 1024;
const DURABLE_IMAGE_BYPASS_BYTES = 420 * 1024;
const DURABLE_IMAGE_MAX_DIM = 1600;

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
]);

const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

let inMemoryAdminSessionToken = '';

export function setMediaSessionToken(token: string): void {
  inMemoryAdminSessionToken = token || '';
}

function sanitizeFileName(raw: string, fallbackExt: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  if (!cleaned) return `media-${Date.now()}${fallbackExt}`;
  return cleaned;
}

function normalizeDurableMime(rawMime: string, filename: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const lower = rawMime.toLowerCase();
  if (lower === 'image/png' || lower === 'image/x-png' || /\.png$/i.test(filename)) {
    return 'image/png';
  }
  if (lower === 'image/webp' || /\.webp$/i.test(filename)) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Unable to decode image ${file.name}.`));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Compresses large upload images into web-optimized <= 640 KB WebP/JPEG files
 * so they persist permanently inside Firestore `media_assets` and load fast on mobile.
 */
export async function compressImageForDurableStorage(file: File): Promise<File> {
  if (typeof document === 'undefined') return file;
  const normalizedMime = normalizeDurableMime(file.type, file.name);
  if (
    file.size <= DURABLE_IMAGE_BYPASS_BYTES &&
    (normalizedMime === 'image/webp' ||
      normalizedMime === 'image/jpeg' ||
      normalizedMime === 'image/png')
  ) {
    return file;
  }

  let bestUnderHardLimit: File | null = null;
  try {
    const img = await loadImageFromFile(file);
    const naturalW = img.naturalWidth || img.width || 1200;
    const naturalH = img.naturalHeight || img.height || 1500;
    let scale = Math.min(1, DURABLE_IMAGE_MAX_DIM / Math.max(naturalW, naturalH));

    const targetMime = 'image/webp';
    const fallbackMime = 'image/jpeg';
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'product-image';

    for (let dimPass = 0; dimPass < 5; dimPass += 1) {
      const targetW = Math.max(160, Math.round(naturalW * scale));
      const targetH = Math.max(160, Math.round(naturalH * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const qualities = [0.86, 0.76, 0.66, 0.54, 0.42];
      for (const q of qualities) {
        let blob = await canvasToBlob(canvas, targetMime, q);
        let chosenMime = targetMime;
        let ext = '.webp';
        if (!blob || blob.type !== targetMime) {
          blob = await canvasToBlob(canvas, fallbackMime, q);
          chosenMime = fallbackMime;
          ext = '.jpg';
        }
        if (blob && blob.size > 0) {
          const candidate = new File([blob], `${baseName}${ext}`, {
            type: chosenMime,
            lastModified: Date.now(),
          });
          if (blob.size <= DURABLE_IMAGE_TARGET_BYTES) {
            return candidate;
          }
          if (
            blob.size <= DURABLE_IMAGE_MAX_HARD_BYTES &&
            (!bestUnderHardLimit || blob.size < bestUnderHardLimit.size)
          ) {
            bestUnderHardLimit = candidate;
          }
        }
      }
      scale *= 0.75;
    }
  } catch {
    // checked below
  }

  if (bestUnderHardLimit) {
    return bestUnderHardLimit;
  }
  if (file.size <= DURABLE_IMAGE_MAX_HARD_BYTES) {
    return file;
  }
  throw new Error(
    `${file.name} (${Math.round(file.size / 1024)} KB) could not be compressed under 680 KB for cloud storage. Please choose a smaller image.`
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function uploadImageDirectToFirestoreMediaAssets(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const mimeType = normalizeDurableMime(file.type, file.name);
  if (file.size > 700 * 1024) {
    throw new Error(
      `${file.name} is still too large after compression (${Math.round(
        file.size / 1024
      )} KB). Please choose a smaller image under 700 KB.`
    );
  }
  onProgress?.(40);
  const dataBase64 = await fileToBase64(file);
  if (dataBase64.length > 960_000) {
    throw new Error(`${file.name} exceeds Firestore document size limits.`);
  }
  const mediaId = `image-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const assetPayload = {
    id: mediaId,
    kind: 'image',
    mimeType,
    filename: sanitizeFileName(file.name, '.webp').slice(0, 140),
    sizeBytes: file.size,
    dataBase64,
    createdAt: new Date().toISOString(),
  };

  onProgress?.(75);
  await setDoc(doc(db, 'media_assets', mediaId), assetPayload);
  const verified = await getDocFromServer(doc(db, 'media_assets', mediaId));
  if (!verified.exists()) {
    throw new Error(`Failed to verify persistent cloud storage for ${file.name}.`);
  }
  onProgress?.(100);
  return `/api/media/${mediaId}`;
}

interface BackendUploadResult {
  url: string;
  persistent: boolean;
}

function uploadViaBackendXhr(
  file: File,
  kind: 'image' | 'video',
  sessionToken: string,
  firebaseIdToken: string,
  onProgress?: (pct: number) => void
): Promise<BackendUploadResult> {
  const timeoutMs = kind === 'video' ? 90_000 : 25_000;
  const endpoint = apiUrl(
    `/api/admin/upload-media?kind=${encodeURIComponent(
      kind
    )}&filename=${encodeURIComponent(file.name)}`
  );

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const finishError = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const finishSuccess = (result: BackendUploadResult) => {
      if (settled) return;
      settled = true;
      onProgress?.(100);
      resolve(result);
    };

    xhr.open('POST', endpoint, true);
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader(
      'Content-Type',
      file.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg')
    );
    if (sessionToken) {
      xhr.setRequestHeader('X-Admin-Session', sessionToken);
    }
    if (firebaseIdToken) {
      xhr.setRequestHeader('X-Firebase-Id-Token', firebaseIdToken);
    }

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0 && onProgress) {
        const pct = Math.min(95, Math.max(5, Math.round((evt.loaded / evt.total) * 95)));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      const contentType = (xhr.getResponseHeader('content-type') || '').toLowerCase();
      let payload: { url?: string; persistent?: boolean; error?: string } | null = null;
      if (contentType.includes('application/json')) {
        try {
          payload = JSON.parse(xhr.responseText) as {
            url?: string;
            persistent?: boolean;
            error?: string;
          };
        } catch {
          payload = null;
        }
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload?.url) {
        finishSuccess({
          url: payload.url,
          persistent: Boolean(payload.persistent),
        });
        return;
      }

      if (xhr.status === 401 || xhr.status === 403) {
        finishError(
          new Error(
            payload?.error || 'Admin session expired or unauthorized. Please log in again.'
          )
        );
        return;
      }

      if (!contentType.includes('application/json')) {
        const err = new Error('BACKEND_UNAVAILABLE') as Error & { code?: string };
        err.code = 'BACKEND_UNAVAILABLE';
        finishError(err);
        return;
      }

      finishError(
        new Error(
          payload?.error ||
            `Upload failed with status ${xhr.status}. Please verify the file and try again.`
        )
      );
    };

    xhr.onerror = () => {
      finishError(new Error('Network error while uploading media. Please check your connection.'));
    };

    xhr.ontimeout = () => {
      finishError(
        new Error(
          `${file.name} upload timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`
        )
      );
    };

    xhr.onabort = () => {
      finishError(new Error(`Upload cancelled for ${file.name}.`));
    };

    try {
      xhr.send(file);
    } catch (err) {
      finishError(
        err instanceof Error ? err : new Error(`Unable to start upload for ${file.name}.`)
      );
    }
  });
}

function uploadViaFirebaseStorage(
  file: File,
  folder: MediaFolder,
  isVideo: boolean,
  onProgress?: (pct: number) => void
): Promise<string> {
  storage.maxUploadRetryTime = 12_000;
  storage.maxOperationRetryTime = 12_000;

  const fallbackExt = isVideo ? '.mp4' : '.jpg';
  const objectPath = `${folder}/${Date.now()}-${Math.floor(100 + Math.random() * 899)}-${sanitizeFileName(file.name, fallbackExt)}`;
  const storageRef = ref(storage, objectPath);
  const timeoutMs = isVideo ? 75_000 : 20_000;

  return new Promise((resolve, reject) => {
    let settled = false;
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      cacheControl: 'public, max-age=31536000',
    });

    const timeoutTimer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        task.cancel();
      } catch {
        // ignore cancel errors
      }
      reject(
        new Error(
          `Media storage upload timed out for ${file.name}. Check Firebase Storage configuration or upload via the server.`
        )
      );
    }, timeoutMs);

    const cleanup = () => window.clearTimeout(timeoutTimer);

    task.on(
      'state_changed',
      (snapshot) => {
        if (settled) return;
        if (snapshot.totalBytes > 0 && onProgress) {
          const pct = Math.min(
            98,
            Math.max(1, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
          );
          onProgress(pct);
        }
      },
      (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        const code = (error as { code?: string })?.code || '';
        if (code === 'storage/unauthorized') {
          reject(
            new Error(
              'Firebase Storage permission denied. Ensure Storage rules are configured or authenticate via the Admin Console.'
            )
          );
          return;
        }
        if (code === 'storage/quota-exceeded') {
          reject(new Error('Storage quota exceeded.'));
          return;
        }
        reject(new Error(error.message || `Failed to upload ${file.name} to storage.`));
      },
      async () => {
        if (settled) return;
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          settled = true;
          cleanup();
          onProgress?.(100);
          resolve(url);
        } catch (err) {
          settled = true;
          cleanup();
          reject(
            err instanceof Error
              ? err
              : new Error(`Failed to resolve download URL for ${file.name}.`)
          );
        }
      }
    );
  });
}

export async function uploadMediaToFirebase(
  file: File,
  folder: MediaFolder,
  onProgress?: (pct: number) => void,
  sessionTokenOverride?: string
): Promise<string> {
  const isVideo = folder === 'products/videos';
  const extMatch = isVideo
    ? /\.(mp4|webm|mov)$/i.test(file.name)
    : /\.(jpg|jpeg|png|webp)$/i.test(file.name);
  const mimeLower = file.type.toLowerCase();
  const mimeAllowed = isVideo
    ? ALLOWED_VIDEO_MIME.has(mimeLower)
    : ALLOWED_IMAGE_MIME.has(mimeLower);

  if (!mimeAllowed && !extMatch) {
    throw new Error(
      isVideo
        ? `${file.name}: unsupported video format. Allowed: MP4, WEBM, MOV.`
        : `${file.name}: unsupported image format. Allowed: JPG, PNG, WEBP.`
    );
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size <= 0) {
    throw new Error(`${file.name}: file is empty.`);
  }
  if (file.size > maxBytes) {
    throw new Error(
      isVideo
        ? `${file.name} exceeds the 50 MB video upload limit.`
        : `${file.name} exceeds the 10 MB image upload limit.`
    );
  }

  const token = sessionTokenOverride ?? inMemoryAdminSessionToken;
  onProgress?.(2);

  if (!isVideo && !isVerifiedAdminUser(auth.currentUser)) {
    throw new Error(
      'Google Admin sign-in (lord79915@gmail.com or pythoxfashion@gmail.com) is required to upload product images permanently to Cloud Storage.'
    );
  }

  // Compress images client-side so every asset fits cleanly inside permanent Firestore media_assets storage
  const preparedFile = isVideo
    ? file
    : await compressImageForDurableStorage(file);

  const firebaseIdToken =
    auth.currentUser && isVerifiedAdminUser(auth.currentUser)
      ? await auth.currentUser.getIdToken(true).catch(() => '')
      : '';

  if (!isVideo && !firebaseIdToken) {
    throw new Error(
      'Google Admin authentication expired. Please re-connect Google Admin before uploading images.'
    );
  }

  try {
    const result = await uploadViaBackendXhr(
      preparedFile,
      isVideo ? 'video' : 'image',
      token,
      firebaseIdToken,
      onProgress
    );

    if (!isVideo && (!result.persistent || result.url.startsWith('/uploads/'))) {
      // Guarantee Firestore permanent media_assets copy even if backend skipped cloud write
      return await uploadImageDirectToFirestoreMediaAssets(preparedFile, onProgress);
    }

    return result.url;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (isVerifiedAdminUser(auth.currentUser)) {
      if (!isVideo && preparedFile.size <= DURABLE_IMAGE_MAX_HARD_BYTES) {
        return uploadImageDirectToFirestoreMediaAssets(preparedFile, onProgress);
      }
      if (code === 'BACKEND_UNAVAILABLE') {
        return uploadViaFirebaseStorage(preparedFile, folder, isVideo, onProgress);
      }
    }
    if (code === 'BACKEND_UNAVAILABLE') {
      throw new Error(
        'Upload server endpoint is unavailable. Please sign in with Google Admin or ensure the backend server is running.'
      );
    }
    throw err instanceof Error ? err : new Error(`Upload failed for ${file.name}.`);
  }
}
