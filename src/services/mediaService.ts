import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, isVerifiedAdminUser, storage } from '../lib/firebase';

export type MediaFolder =
  | 'products/images'
  | 'products/videos'
  | 'categories'
  | 'hero';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

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

function uploadViaBackendXhr(
  file: File,
  kind: 'image' | 'video',
  sessionToken: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const timeoutMs = kind === 'video' ? 90_000 : 25_000;
  const endpoint = `/api/admin/upload-media?kind=${encodeURIComponent(
    kind
  )}&filename=${encodeURIComponent(file.name)}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const finishError = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const finishSuccess = (url: string) => {
      if (settled) return;
      settled = true;
      onProgress?.(100);
      resolve(url);
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

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0 && onProgress) {
        const pct = Math.min(98, Math.max(1, Math.round((evt.loaded / evt.total) * 100)));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      const contentType = (xhr.getResponseHeader('content-type') || '').toLowerCase();
      let payload: { url?: string; error?: string } | null = null;
      if (contentType.includes('application/json')) {
        try {
          payload = JSON.parse(xhr.responseText) as { url?: string; error?: string };
        } catch {
          payload = null;
        }
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload?.url) {
        finishSuccess(payload.url);
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
  // Tighten Firebase SDK retry windows so unreachable/unconfigured buckets never stall 10+ minutes
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

  try {
    return await uploadViaBackendXhr(
      file,
      isVideo ? 'video' : 'image',
      token,
      onProgress
    );
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'BACKEND_UNAVAILABLE' && isVerifiedAdminUser(auth.currentUser)) {
      return uploadViaFirebaseStorage(file, folder, isVideo, onProgress);
    }
    if (code === 'BACKEND_UNAVAILABLE') {
      throw new Error(
        'Upload server endpoint is unavailable. Please ensure the Node backend server is running.'
      );
    }
    throw err instanceof Error ? err : new Error(`Upload failed for ${file.name}.`);
  }
}
