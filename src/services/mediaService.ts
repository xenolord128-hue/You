import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
  type UploadTask,
} from 'firebase/storage';
import {
  auth,
  db,
  FIREBASE_PROJECT_ID,
  getStorageInstance,
  isVerifiedAdminUser,
  STORAGE_BUCKET,
  storage,
} from '../lib/firebase';
import { apiUrl } from '../lib/api';

export type MediaFolder =
  | 'products/images'
  | 'products/videos'
  | 'categories'
  | 'hero';

export type MediaUploadStage =
  | 'validating'
  | 'authenticating'
  | 'probing-bucket'
  | 'preparing'
  | 'uploading'
  | 'download-url'
  | 'verifying'
  | 'firestore-save'
  | 'retrying'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface MediaUploadOptions {
  signal?: AbortSignal;
  uploadKey?: string;
  onStageChange?: (stage: MediaUploadStage) => void;
}

export interface ValidatedMediaFile {
  kind: 'image' | 'video';
  detectedMime:
    | 'image/jpeg'
    | 'image/png'
    | 'image/webp'
    | 'video/mp4'
    | 'video/webm'
    | 'video/quicktime';
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
}

export class MediaUploadError extends Error {
  code: string;
  isPermanent: boolean;
  stage: MediaUploadStage;

  constructor(
    message: string,
    opts: { code: string; isPermanent: boolean; stage?: MediaUploadStage }
  ) {
    super(message);
    this.name = 'MediaUploadError';
    this.code = opts.code;
    this.isPermanent = opts.isPermanent;
    this.stage = opts.stage || 'error';
  }
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
const SMALL_IMAGE_DIRECT_UPLOAD_BYTES = 256 * 1024; // Use uploadBytes for <= 256 KB
const STORAGE_MAX_IMAGE_OPTIMIZE_BYTES = 1.6 * 1024 * 1024; // Keep cloud images crisp & mobile-fast
const STORAGE_IMAGE_MAX_DIM = 2000;

const DURABLE_IMAGE_TARGET_BYTES = 540 * 1024; // <= 720 KB base64 inside Firestore 1 MiB doc & rules
const DURABLE_IMAGE_MAX_HARD_BYTES = 680 * 1024;
const DURABLE_IMAGE_BYPASS_BYTES = 420 * 1024;
const DURABLE_IMAGE_MAX_DIM = 1600;

const STORAGE_PROBE_TIMEOUT_MS = 3_500;
const STORAGE_PROBE_SUCCESS_TTL_MS = 5 * 60 * 1000;
const STORAGE_PROBE_FAILURE_TTL_MS = 10 * 1000;

const HANDSHAKE_STALL_MS = 15_000;
const IMAGE_PROGRESS_STALL_MS = 35_000;
const VIDEO_PROGRESS_STALL_MS = 60_000;
const MAX_TRANSIENT_RETRIES = 2;

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

interface ActiveUploadHandle {
  cancel: () => void;
  promise: Promise<string>;
}

const activeUploadRegistry = new Map<string, ActiveUploadHandle>();

let inMemoryAdminSessionToken = '';

interface StorageBucketProbeResult {
  available: boolean;
  bucketName?: string;
  reason?: 'unconfigured' | 'bucket-not-found' | 'cors-or-network' | 'offline';
  httpStatus?: number;
  checkedAt: number;
}

let cachedBucketProbe: StorageBucketProbeResult | null = null;

export function setMediaSessionToken(token: string): void {
  inMemoryAdminSessionToken = token || '';
}

export function resetStorageProbeCache(): void {
  cachedBucketProbe = null;
}

function logUploadStage(
  stage:
    | 'Validation'
    | 'Start'
    | 'Progress'
    | 'Retry'
    | 'Complete'
    | 'DownloadURL'
    | 'Error'
    | 'Cancelled'
    | 'DuplicatePrevented',
  details: Record<string, unknown>
): void {
  const safePayload = {
    ts: new Date().toISOString(),
    ...details,
  };
  if (stage === 'Error') {
    console.error(`[Upload:${stage}]`, safePayload);
  } else if (stage === 'Retry' || stage === 'Cancelled' || stage === 'DuplicatePrevented') {
    console.warn(`[Upload:${stage}]`, safePayload);
  } else {
    console.info(`[Upload:${stage}]`, safePayload);
  }
}

export function cancelActiveMediaUpload(uploadKey: string): boolean {
  const handle = activeUploadRegistry.get(uploadKey);
  if (!handle) return false;
  handle.cancel();
  activeUploadRegistry.delete(uploadKey);
  return true;
}

export function cancelAllActiveMediaUploads(): void {
  for (const [key, handle] of activeUploadRegistry.entries()) {
    try {
      handle.cancel();
    } catch {
      // ignore
    }
    activeUploadRegistry.delete(key);
  }
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

export function isValidUploadedMediaUrl(url: string | undefined | null): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('javascript:')
  ) {
    return false;
  }
  if (trimmed.startsWith('/api/media/') || trimmed.startsWith('/uploads/')) {
    return !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function asciiAt(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end && i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

export function detectMediaSignature(
  headerBytes: Uint8Array,
  filename: string
): ValidatedMediaFile['detectedMime'] | null {
  if (headerBytes.length < 4) return null;

  // JPEG: FF D8 FF
  if (headerBytes[0] === 0xff && headerBytes[1] === 0xd8 && headerBytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    headerBytes.length >= 8 &&
    headerBytes[0] === 0x89 &&
    headerBytes[1] === 0x50 &&
    headerBytes[2] === 0x4e &&
    headerBytes[3] === 0x47 &&
    headerBytes[4] === 0x0d &&
    headerBytes[5] === 0x0a &&
    headerBytes[6] === 0x1a &&
    headerBytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: RIFF....WEBP
  if (
    headerBytes.length >= 12 &&
    asciiAt(headerBytes, 0, 4) === 'RIFF' &&
    asciiAt(headerBytes, 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  // WEBM / Matroska: 1A 45 DF A3
  if (
    headerBytes[0] === 0x1a &&
    headerBytes[1] === 0x45 &&
    headerBytes[2] === 0xdf &&
    headerBytes[3] === 0xa3
  ) {
    return 'video/webm';
  }

  // MP4 / QuickTime ISO BMFF: box size + ftyp/moov/mdat/wide/free/pnot
  if (headerBytes.length >= 8) {
    const boxType = asciiAt(headerBytes, 4, 8);
    if (
      boxType === 'ftyp' ||
      boxType === 'moov' ||
      boxType === 'mdat' ||
      boxType === 'wide' ||
      boxType === 'free' ||
      boxType === 'pnot'
    ) {
      const majorBrand = headerBytes.length >= 12 ? asciiAt(headerBytes, 8, 12) : '';
      if (majorBrand === 'qt  ' || /\.mov$/i.test(filename)) {
        return 'video/quicktime';
      }
      return 'video/mp4';
    }
  }

  return null;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  if (typeof URL === 'undefined' || typeof Image === 'undefined') {
    return Promise.reject(new Error('Image decoding unavailable in this runtime.'));
  }
  const objectUrl = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if ((img.naturalWidth || 0) <= 0 || (img.naturalHeight || 0) <= 0) {
        reject(new Error(`${file.name} decoded with zero dimensions and appears corrupted.`));
        return;
      }
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`${file.name} could not be decoded as a valid image. The file may be corrupted.`));
    };
    img.src = objectUrl;
  });
}

function probeVideoMetadata(
  file: File
): Promise<{ width: number; height: number; durationSec: number }> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return Promise.resolve({ width: 0, height: 0, durationSec: 0 });
  }
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const videoEl = document.createElement('video');
    videoEl.preload = 'metadata';
    videoEl.muted = true;

    let done = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      videoEl.onloadedmetadata = null;
      videoEl.onerror = null;
      videoEl.removeAttribute('src');
      videoEl.load();
      URL.revokeObjectURL(objectUrl);
    };

    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      // Do not fail valid large MOV/MP4 if browser codec metadata takes >4s
      resolve({ width: 0, height: 0, durationSec: 0 });
    }, 4_000);

    videoEl.onloadedmetadata = () => {
      if (done) return;
      done = true;
      const width = videoEl.videoWidth || 0;
      const height = videoEl.videoHeight || 0;
      const durationSec = Number.isFinite(videoEl.duration) ? videoEl.duration : 0;
      cleanup();
      resolve({ width, height, durationSec });
    };

    videoEl.onerror = () => {
      if (done) return;
      done = true;
      cleanup();
      reject(
        new MediaUploadError(
          `${file.name} could not be read as a playable video. Verify it is a valid MP4, WEBM, or MOV file.`,
          { code: 'CORRUPTED_MEDIA', isPermanent: true, stage: 'validating' }
        )
      );
    };

    videoEl.src = objectUrl;
  });
}

/**
 * Validates size, extension/MIME, magic-byte file signature, and browser decodability
 * before starting any network upload.
 */
export async function validateMediaFile(
  file: File,
  kind: 'image' | 'video'
): Promise<ValidatedMediaFile> {
  if (!(file instanceof File) && typeof (file as Blob)?.arrayBuffer !== 'function') {
    throw new MediaUploadError('Invalid file provided.', {
      code: 'VALIDATION_ERROR',
      isPermanent: true,
      stage: 'validating',
    });
  }

  const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size <= 0) {
    throw new MediaUploadError(`${file.name}: file is empty (0 bytes).`, {
      code: 'EMPTY_FILE',
      isPermanent: true,
      stage: 'validating',
    });
  }
  if (file.size > maxBytes) {
    throw new MediaUploadError(
      kind === 'video'
        ? `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 50 MB video upload limit.`
        : `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 10 MB image upload limit.`,
      {
        code: 'FILE_TOO_LARGE',
        isPermanent: true,
        stage: 'validating',
      }
    );
  }

  const extMatch =
    kind === 'video'
      ? /\.(mp4|webm|mov)$/i.test(file.name)
      : /\.(jpg|jpeg|png|webp)$/i.test(file.name);
  const mimeLower = (file.type || '').toLowerCase();
  const mimeAllowed =
    kind === 'video'
      ? ALLOWED_VIDEO_MIME.has(mimeLower)
      : ALLOWED_IMAGE_MIME.has(mimeLower);

  if (mimeLower && !mimeAllowed && !extMatch) {
    throw new MediaUploadError(
      kind === 'video'
        ? `${file.name}: unsupported video format (${mimeLower}). Allowed: MP4, WEBM, MOV.`
        : `${file.name}: unsupported image format (${mimeLower}). Allowed: JPG, PNG, WEBP.`,
      { code: 'UNSUPPORTED_FORMAT', isPermanent: true, stage: 'validating' }
    );
  }

  let headerBytes: Uint8Array;
  try {
    const headerBuf = await file.slice(0, 32).arrayBuffer();
    headerBytes = new Uint8Array(headerBuf);
  } catch {
    throw new MediaUploadError(`Unable to read ${file.name}. The file may be inaccessible or corrupted.`, {
      code: 'UNREADABLE_FILE',
      isPermanent: true,
      stage: 'validating',
    });
  }

  const detectedMime = detectMediaSignature(headerBytes, file.name);
  const expectedPrefix = kind === 'video' ? 'video/' : 'image/';
  if (!detectedMime || !detectedMime.startsWith(expectedPrefix)) {
    throw new MediaUploadError(
      kind === 'video'
        ? `${file.name} is corrupted or not a genuine MP4, WEBM, or MOV video.`
        : `${file.name} is corrupted or not a genuine JPG, PNG, or WEBP image.`,
      { code: 'INVALID_MAGIC_BYTES', isPermanent: true, stage: 'validating' }
    );
  }

  let width: number | undefined;
  let height: number | undefined;
  let durationSec: number | undefined;

  if (typeof document !== 'undefined') {
    if (kind === 'image') {
      const img = await loadImageFromFile(file).catch((err) => {
        throw new MediaUploadError(
          err instanceof Error ? err.message : `${file.name} appears corrupted.`,
          { code: 'CORRUPTED_MEDIA', isPermanent: true, stage: 'validating' }
        );
      });
      width = img.naturalWidth;
      height = img.naturalHeight;
    } else {
      const meta = await probeVideoMetadata(file);
      width = meta.width || undefined;
      height = meta.height || undefined;
      durationSec = meta.durationSec || undefined;
    }
  }

  logUploadStage('Validation', {
    name: file.name,
    kind,
    sizeBytes: file.size,
    declaredMime: mimeLower || '(none)',
    detectedMime,
    width,
    height,
    durationSec,
  });

  return {
    kind,
    detectedMime,
    sizeBytes: file.size,
    width,
    height,
    durationSec,
  };
}

function normalizeDurableMime(
  rawMime: string,
  filename: string
): 'image/jpeg' | 'image/png' | 'image/webp' {
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

async function optimizeImageForStorageBucket(
  file: File,
  detectedMime: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<{ file: File; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }> {
  if (typeof document === 'undefined' || file.size <= STORAGE_MAX_IMAGE_OPTIMIZE_BYTES) {
    return { file, mimeType: detectedMime };
  }

  try {
    const img = await loadImageFromFile(file);
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const scale = Math.min(1, STORAGE_IMAGE_MAX_DIM / Math.max(naturalW, naturalH));
    const targetW = Math.max(200, Math.round(naturalW * scale));
    const targetH = Math.max(200, Math.round(naturalH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, mimeType: detectedMime };
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'product-image';
    const blob = await canvasToBlob(canvas, 'image/webp', 0.88);
    if (blob && blob.size > 0 && blob.size < file.size) {
      return {
        file: new File([blob], `${baseName}.webp`, {
          type: 'image/webp',
          lastModified: Date.now(),
        }),
        mimeType: 'image/webp',
      };
    }
  } catch {
    // fallback to original validated file
  }

  return { file, mimeType: detectedMime };
}

/**
 * Compresses large upload images into web-optimized <= 680 KB WebP/JPEG files
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
  throw new MediaUploadError(
    `${file.name} (${Math.round(file.size / 1024)} KB) could not be compressed under 680 KB for cloud storage. Please choose a smaller image.`,
    { code: 'COMPRESSION_LIMIT_EXCEEDED', isPermanent: true, stage: 'preparing' }
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
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) {
    throw new MediaUploadError(`Upload cancelled for ${file.name}.`, {
      code: 'ABORTED',
      isPermanent: true,
      stage: 'cancelled',
    });
  }

  const mimeType = normalizeDurableMime(file.type, file.name);
  if (file.size > 700 * 1024) {
    throw new MediaUploadError(
      `${file.name} is still too large after compression (${Math.round(
        file.size / 1024
      )} KB). Please choose a smaller image under 700 KB.`,
      { code: 'FIRESTORE_ASSET_TOO_LARGE', isPermanent: true, stage: 'preparing' }
    );
  }

  onProgress?.(40);
  const dataBase64 = await fileToBase64(file);
  if (signal?.aborted) {
    throw new MediaUploadError(`Upload cancelled for ${file.name}.`, {
      code: 'ABORTED',
      isPermanent: true,
      stage: 'cancelled',
    });
  }
  if (dataBase64.length > 960_000) {
    throw new MediaUploadError(`${file.name} exceeds Firestore document size limits.`, {
      code: 'FIRESTORE_ASSET_TOO_LARGE',
      isPermanent: true,
      stage: 'preparing',
    });
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
    throw new MediaUploadError(
      `Failed to verify persistent cloud storage for ${file.name}.`,
      { code: 'FIRESTORE_VERIFY_FAILED', isPermanent: false, stage: 'verifying' }
    );
  }

  const finalUrl = `/api/media/${mediaId}`;
  onProgress?.(100);
  logUploadStage('DownloadURL', {
    provider: 'firestore-media-assets',
    name: file.name,
    url: finalUrl,
  });
  return finalUrl;
}

interface BackendUploadResult {
  url: string;
  persistent: boolean;
}

function uploadViaBackendXhr(
  file: File,
  kind: 'image' | 'video',
  mimeType: string,
  sessionToken: string,
  firebaseIdToken: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<BackendUploadResult> {
  const timeoutMs = kind === 'video' ? 90_000 : 25_000;
  const endpoint = apiUrl(
    `/api/admin/upload-media?kind=${encodeURIComponent(
      kind
    )}&filename=${encodeURIComponent(file.name)}`
  );

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new MediaUploadError(`Upload cancelled for ${file.name}.`, {
          code: 'ABORTED',
          isPermanent: true,
          stage: 'cancelled',
        })
      );
      return;
    }

    const xhr = new XMLHttpRequest();
    let settled = false;

    const cleanupSignal = () => {
      signal?.removeEventListener('abort', handleAbort);
    };

    const finishError = (err: MediaUploadError) => {
      if (settled) return;
      settled = true;
      cleanupSignal();
      reject(err);
    };

    const finishSuccess = (result: BackendUploadResult) => {
      if (settled) return;
      settled = true;
      cleanupSignal();
      onProgress?.(100);
      resolve(result);
    };

    const handleAbort = () => {
      try {
        xhr.abort();
      } catch {
        // ignore
      }
      finishError(
        new MediaUploadError(`Upload cancelled for ${file.name}.`, {
          code: 'ABORTED',
          isPermanent: true,
          stage: 'cancelled',
        })
      );
    };

    signal?.addEventListener('abort', handleAbort, { once: true });

    xhr.open('POST', endpoint, true);
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader('Content-Type', mimeType);
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
          new MediaUploadError(
            payload?.error || 'Admin session expired or unauthorized. Please sign in again.',
            { code: 'UNAUTHORIZED', isPermanent: true, stage: 'uploading' }
          )
        );
        return;
      }

      if (!contentType.includes('application/json')) {
        finishError(
          new MediaUploadError('BACKEND_UNAVAILABLE', {
            code: 'BACKEND_UNAVAILABLE',
            isPermanent: true,
            stage: 'uploading',
          })
        );
        return;
      }

      const isTransientStatus =
        xhr.status === 408 || xhr.status === 429 || xhr.status >= 500;
      finishError(
        new MediaUploadError(
          payload?.error ||
            `Upload failed with status ${xhr.status}. Please verify the file and try again.`,
          {
            code: `HTTP_${xhr.status}`,
            isPermanent: !isTransientStatus,
            stage: 'uploading',
          }
        )
      );
    };

    xhr.onerror = () => {
      finishError(
        new MediaUploadError('Network error while uploading media. Please check your connection.', {
          code: 'NETWORK_ERROR',
          isPermanent: typeof navigator !== 'undefined' && navigator.onLine === false,
          stage: 'uploading',
        })
      );
    };

    xhr.ontimeout = () => {
      finishError(
        new MediaUploadError(
          `${file.name} upload timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`,
          { code: 'UPLOAD_TIMEOUT', isPermanent: false, stage: 'uploading' }
        )
      );
    };

    xhr.onabort = () => {
      finishError(
        new MediaUploadError(`Upload cancelled for ${file.name}.`, {
          code: 'ABORTED',
          isPermanent: true,
          stage: 'cancelled',
        })
      );
    };

    try {
      xhr.send(file);
    } catch (err) {
      finishError(
        new MediaUploadError(
          err instanceof Error ? err.message : `Unable to start upload for ${file.name}.`,
          { code: 'XHR_SEND_FAILED', isPermanent: false, stage: 'uploading' }
        )
      );
    }
  });
}

/**
 * Probes the configured Firebase Storage bucket (`pythoxworld.firebasestorage.app`)
 * before invoking `uploadBytesResumable`, preventing blind retry loops that culminate in
 * `storage/retry-limit-exceeded` when the Storage bucket is unprovisioned (HTTP 404) or offline.
 */
async function probeSingleFirebaseBucket(bucketName: string): Promise<{
  available: boolean;
  bucketName: string;
  reason?: 'bucket-not-found' | 'cors-or-network' | 'offline';
  httpStatus?: number;
}> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), STORAGE_PROBE_TIMEOUT_MS);

  try {
    const probeUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
      bucketName
    )}/o?maxResults=1`;
    const res = await fetch(probeUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (res.status === 404) {
      return {
        available: false,
        bucketName,
        reason: 'bucket-not-found',
        httpStatus: 404,
      };
    }

    // 200, 401, or 403 proves the Storage bucket exists and responds cleanly over CORS
    if (res.ok || res.status === 401 || res.status === 403) {
      return {
        available: true,
        bucketName,
        httpStatus: res.status,
      };
    }

    return {
      available: false,
      bucketName,
      reason: 'cors-or-network',
      httpStatus: res.status,
    };
  } catch {
    return {
      available: false,
      bucketName,
      reason:
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'offline'
          : 'cors-or-network',
    };
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function checkFirebaseStorageBucketStatus(
  forceFresh = false
): Promise<StorageBucketProbeResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      available: false,
      reason: 'offline',
      checkedAt: Date.now(),
    };
  }

  if (!STORAGE_BUCKET) {
    return {
      available: false,
      reason: 'unconfigured',
      checkedAt: Date.now(),
    };
  }

  const now = Date.now();
  if (!forceFresh && cachedBucketProbe) {
    const ttl = cachedBucketProbe.available
      ? STORAGE_PROBE_SUCCESS_TTL_MS
      : STORAGE_PROBE_FAILURE_TTL_MS;
    if (now - cachedBucketProbe.checkedAt < ttl) {
      return cachedBucketProbe;
    }
  }

  const candidateBuckets = [STORAGE_BUCKET];
  if (
    FIREBASE_PROJECT_ID &&
    STORAGE_BUCKET.endsWith('.firebasestorage.app') &&
    !candidateBuckets.includes(`${FIREBASE_PROJECT_ID}.appspot.com`)
  ) {
    candidateBuckets.push(`${FIREBASE_PROJECT_ID}.appspot.com`);
  }

  let lastResult: StorageBucketProbeResult = {
    available: false,
    bucketName: STORAGE_BUCKET,
    reason: 'bucket-not-found',
    checkedAt: Date.now(),
  };

  for (const candidate of candidateBuckets) {
    const probe = await probeSingleFirebaseBucket(candidate);
    lastResult = {
      ...probe,
      checkedAt: Date.now(),
    };
    if (probe.available) {
      cachedBucketProbe = lastResult;
      return cachedBucketProbe;
    }
    if (probe.reason !== 'bucket-not-found') {
      break;
    }
  }

  cachedBucketProbe = lastResult;
  return cachedBucketProbe;
}

export function classifyFirebaseStorageError(
  error: unknown,
  filename: string,
  stageOverride?: MediaUploadStage
): MediaUploadError {
  if (error instanceof MediaUploadError) return error;

  const errObj = error as {
    code?: string;
    status_?: number;
    status?: number;
    serverResponse?: string;
  };
  const code = (errObj?.code || '').toLowerCase();
  const httpStatus = Number(errObj?.status_ ?? errObj?.status ?? 0) || 0;
  const serverResp = String(errObj?.serverResponse || '').toLowerCase();
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const lowerMsg = rawMessage.toLowerCase();

  if (code === 'storage/canceled' || code === 'aborted') {
    return new MediaUploadError(`Upload cancelled for ${filename}.`, {
      code: 'storage/canceled',
      isPermanent: true,
      stage: 'cancelled',
    });
  }

  if (code === 'storage/unauthenticated' || httpStatus === 401) {
    return new MediaUploadError(
      `Authentication stage failed (storage/unauthenticated): Google Admin sign-in expired or missing while uploading ${filename}.`,
      { code: 'storage/unauthenticated', isPermanent: true, stage: 'authenticating' }
    );
  }

  if (code === 'storage/unauthorized' || httpStatus === 403) {
    return new MediaUploadError(
      `Storage permission denied (storage/unauthorized): Authenticated user is not permitted by storage.rules to write ${filename}.`,
      { code: 'storage/unauthorized', isPermanent: true, stage: 'uploading' }
    );
  }

  if (
    code === 'storage/bucket-not-found' ||
    code === 'storage/project-not-found' ||
    code === 'storage/no-default-bucket' ||
    httpStatus === 404 ||
    serverResp.includes('bucket does not exist') ||
    lowerMsg.includes('bucket does not exist')
  ) {
    return new MediaUploadError(
      `Invalid or unactivated bucket (storage/bucket-not-found): Firebase Storage bucket "${STORAGE_BUCKET}" returned HTTP 404 on project "${FIREBASE_PROJECT_ID || 'pythoxworld'}". Enable Storage in Firebase Console -> Storage -> Get Started and publish storage.rules.`,
      { code: 'storage/bucket-not-found', isPermanent: true, stage: 'probing-bucket' }
    );
  }

  if (stageOverride === 'download-url') {
    return new MediaUploadError(
      `getDownloadURL failure for ${filename} (${code || 'unknown'}): ${rawMessage || 'Could not obtain a public download URL after upload.'}`,
      { code: code || 'DOWNLOAD_URL_FAILED', isPermanent: false, stage: 'download-url' }
    );
  }

  if (code === 'storage/quota-exceeded') {
    return new MediaUploadError(
      'Storage quota exceeded (storage/quota-exceeded): Upgrade your Firebase Storage plan or free space.',
      { code, isPermanent: true, stage: 'uploading' }
    );
  }

  if (
    code === 'storage/invalid-argument' ||
    code === 'storage/invalid-checksum' ||
    code === 'storage/invalid-format'
  ) {
    return new MediaUploadError(
      `Invalid file rejected by Storage (${code}) for ${filename}: Check file integrity and format.`,
      { code, isPermanent: true, stage: 'validating' }
    );
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new MediaUploadError(
      `Network failure (offline) while uploading ${filename}. Reconnect to the internet and retry.`,
      { code: 'OFFLINE', isPermanent: true, stage: 'uploading' }
    );
  }

  if (code === 'storage/retry-limit-exceeded') {
    return new MediaUploadError(
      `Upload stage failed for ${filename} (storage/retry-limit-exceeded): Firebase Storage upload request could not complete (usually caused by an unactivated 404 bucket failing CORS preflight, missing CORS config, or mobile network interruption).`,
      { code, isPermanent: false, stage: 'uploading' }
    );
  }

  if (code === 'storage/unknown' || code === 'network_stall') {
    return new MediaUploadError(
      `Network or upload timeout error while uploading ${filename} (${code || 'storage/unknown'}).`,
      { code: code || 'storage/unknown', isPermanent: false, stage: 'uploading' }
    );
  }

  return new MediaUploadError(
    rawMessage || `Failed during ${stageOverride || 'uploading'} for ${filename}.`,
    { code: code || 'storage/upload-failed', isPermanent: false, stage: stageOverride || 'error' }
  );
}

async function attemptSingleFirebaseStorageUpload(
  file: File,
  folder: MediaFolder,
  mimeType: string,
  isVideo: boolean,
  targetBucketName?: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) {
    throw new MediaUploadError(`Upload cancelled for ${file.name}.`, {
      code: 'ABORTED',
      isPermanent: true,
      stage: 'cancelled',
    });
  }

  const targetStorage = getStorageInstance(targetBucketName);
  targetStorage.maxUploadRetryTime = 10_000;
  targetStorage.maxOperationRetryTime = 10_000;

  const fallbackExt = isVideo ? '.mp4' : '.jpg';
  const objectPath = `${folder}/${Date.now()}-${Math.floor(100 + Math.random() * 899)}-${sanitizeFileName(file.name, fallbackExt)}`;
  const storageRef = ref(targetStorage, objectPath);
  const metadata = {
    contentType: mimeType,
    cacheControl: 'public, max-age=31536000',
  };

  logUploadStage('Start', {
    provider: 'firebase-storage',
    bucket: targetBucketName || STORAGE_BUCKET,
    objectPath,
    sizeBytes: file.size,
    contentType: mimeType,
    mode: !isVideo && file.size <= SMALL_IMAGE_DIRECT_UPLOAD_BYTES ? 'uploadBytes' : 'uploadBytesResumable',
  });

  // Fast single-shot upload for small images (<= 256 KB) with explicit abort + timeout guard
  if (!isVideo && file.size <= SMALL_IMAGE_DIRECT_UPLOAD_BYTES) {
    onProgress?.(25);
    const snapshot = await new Promise<Awaited<ReturnType<typeof uploadBytes>>>((resolve, reject) => {
      let done = false;
      const timer = window.setTimeout(() => {
        if (done) return;
        done = true;
        signal?.removeEventListener('abort', onAbort);
        reject(
          new MediaUploadError(
            `Upload timeout for ${file.name}: direct Storage upload did not finish within 25s.`,
            { code: 'UPLOAD_TIMEOUT', isPermanent: false, stage: 'uploading' }
          )
        );
      }, 25_000);
      const onAbort = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        reject(
          new MediaUploadError(`Upload cancelled for ${file.name}.`, {
            code: 'ABORTED',
            isPermanent: true,
            stage: 'cancelled',
          })
        );
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      uploadBytes(storageRef, file, metadata)
        .then((snap) => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          resolve(snap);
        })
        .catch((err) => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          reject(err);
        });
    });

    onProgress?.(92);
    let url = '';
    try {
      url = await getDownloadURL(snapshot.ref);
    } catch (dlErr) {
      throw classifyFirebaseStorageError(dlErr, file.name, 'download-url');
    }
    if (!isValidUploadedMediaUrl(url)) {
      throw new MediaUploadError(`getDownloadURL failure: invalid URL returned for ${file.name}.`, {
        code: 'INVALID_DOWNLOAD_URL',
        isPermanent: true,
        stage: 'download-url',
      });
    }
    onProgress?.(100);
    logUploadStage('Complete', { provider: 'firebase-storage', objectPath, sizeBytes: file.size });
    logUploadStage('DownloadURL', { provider: 'firebase-storage', objectPath, url });
    return url;
  }

  // Resumable upload with stall detection + clean task cancellation
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let task: UploadTask | null = null;
    let lastBytes = 0;
    let lastProgressAt = Date.now();
    let stallTimer: number | undefined;
    let lastLoggedPct = -1;

    const cleanup = () => {
      if (stallTimer !== undefined) {
        window.clearInterval(stallTimer);
      }
      signal?.removeEventListener('abort', handleAbort);
    };

    const failWith = (err: MediaUploadError) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const handleAbort = () => {
      try {
        task?.cancel();
      } catch {
        // ignore
      }
      failWith(
        new MediaUploadError(`Upload cancelled for ${file.name}.`, {
          code: 'ABORTED',
          isPermanent: true,
          stage: 'cancelled',
        })
      );
    };

    signal?.addEventListener('abort', handleAbort, { once: true });

    try {
      task = uploadBytesResumable(storageRef, file, metadata);
    } catch (initErr) {
      failWith(classifyFirebaseStorageError(initErr, file.name));
      return;
    }

    const activeProgressStallMs = isVideo ? VIDEO_PROGRESS_STALL_MS : IMAGE_PROGRESS_STALL_MS;
    stallTimer = window.setInterval(() => {
      if (settled) return;
      const idleMs = Date.now() - lastProgressAt;
      const limitMs = lastBytes === 0 ? HANDSHAKE_STALL_MS : activeProgressStallMs;
      if (idleMs > limitMs) {
        try {
          task?.cancel();
        } catch {
          // ignore
        }
        failWith(
          new MediaUploadError(
            lastBytes === 0
              ? `Storage connection stalled before transfer started for ${file.name}. Check Storage bucket CORS/network and retry.`
              : `Upload stalled for ${file.name} after transferring ${Math.round(lastBytes / 1024)} KB.`,
            {
              code: 'NETWORK_STALL',
              isPermanent: typeof navigator !== 'undefined' && navigator.onLine === false,
              stage: 'uploading',
            }
          )
        );
      }
    }, 2_000);

    task.on(
      'state_changed',
      (snapshot) => {
        if (settled) return;
        if (snapshot.bytesTransferred > lastBytes) {
          lastBytes = snapshot.bytesTransferred;
          lastProgressAt = Date.now();
        }
        if (snapshot.totalBytes > 0) {
          const pct = Math.min(
            98,
            Math.max(1, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
          );
          onProgress?.(pct);
          if (pct >= lastLoggedPct + 25 || pct === 98) {
            lastLoggedPct = pct;
            logUploadStage('Progress', {
              provider: 'firebase-storage',
              objectPath,
              pct,
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
            });
          }
        }
      },
      (error) => {
        if (settled) return;
        const classified = classifyFirebaseStorageError(error, file.name);
        failWith(classified);
      },
      async () => {
        if (settled || !task) return;
        try {
          logUploadStage('Complete', {
            provider: 'firebase-storage',
            objectPath,
            sizeBytes: file.size,
          });
          let url = '';
          try {
            url = await getDownloadURL(task.snapshot.ref);
          } catch (dlErr) {
            throw classifyFirebaseStorageError(dlErr, file.name, 'download-url');
          }
          if (!isValidUploadedMediaUrl(url)) {
            throw new MediaUploadError(
              `getDownloadURL failure: invalid download URL returned by Firebase Storage for ${file.name}.`,
              { code: 'INVALID_DOWNLOAD_URL', isPermanent: true, stage: 'download-url' }
            );
          }
          settled = true;
          cleanup();
          onProgress?.(100);
          logUploadStage('DownloadURL', {
            provider: 'firebase-storage',
            objectPath,
            url,
          });
          resolve(url);
        } catch (err) {
          failWith(classifyFirebaseStorageError(err, file.name, 'download-url'));
        }
      }
    );
  });
}

async function uploadViaFirebaseStorageWithRetry(
  file: File,
  folder: MediaFolder,
  mimeType: string,
  isVideo: boolean,
  targetBucketName?: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
  onStageChange?: (stage: MediaUploadStage) => void
): Promise<string> {
  // Use Firebase Storage SDK's short native retry window so our intelligent
  // transient-vs-permanent classifier remains in full control.
  storage.maxUploadRetryTime = 10_000;
  storage.maxOperationRetryTime = 10_000;

  let lastError: MediaUploadError | null = null;

  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt += 1) {
    if (signal?.aborted) {
      throw new MediaUploadError(`Upload cancelled for ${file.name}.`, {
        code: 'ABORTED',
        isPermanent: true,
        stage: 'cancelled',
      });
    }

    if (attempt > 0) {
      onStageChange?.('retrying');
      const backoffMs = Math.min(4_000, 1_000 * Math.pow(2, attempt - 1));
      logUploadStage('Retry', {
        provider: 'firebase-storage',
        name: file.name,
        attempt,
        backoffMs,
        previousCode: lastError?.code,
      });
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        }, backoffMs);
        const onAbort = () => {
          window.clearTimeout(timer);
          reject(
            new MediaUploadError(`Upload cancelled for ${file.name}.`, {
              code: 'ABORTED',
              isPermanent: true,
              stage: 'cancelled',
            })
          );
        };
        signal?.addEventListener('abort', onAbort, { once: true });
      });
    }

    onStageChange?.('uploading');
    try {
      return await attemptSingleFirebaseStorageUpload(
        file,
        folder,
        mimeType,
        isVideo,
        targetBucketName,
        onProgress,
        signal
      );
    } catch (err) {
      const classified = classifyFirebaseStorageError(err, file.name);
      lastError = classified;
      if (classified.isPermanent || attempt >= MAX_TRANSIENT_RETRIES) {
        logUploadStage('Error', {
          provider: 'firebase-storage',
          name: file.name,
          code: classified.code,
          isPermanent: classified.isPermanent,
          message: classified.message,
        });
        throw classified;
      }
    }
  }

  throw (
    lastError ||
    new MediaUploadError(`Upload failed for ${file.name}.`, {
      code: 'UPLOAD_FAILED',
      isPermanent: false,
      stage: 'error',
    })
  );
}

/**
 * Full verified upload pipeline for product images, videos, categories, and hero banners:
 * 1. Validates size, MIME, magic bytes, and browser decode integrity.
 * 2. Prevents duplicate concurrent uploads via `activeUploadRegistry`.
 * 3. Checks auth + connectivity + Firebase Storage bucket availability (`pythoxworld.firebasestorage.app`).
 * 4. Uploads to Firebase Storage (`uploadBytes` / `uploadBytesResumable`) -> verifies `getDownloadURL`,
 *    or falls back safely to verified Firestore `media_assets` for images (or Node backend for videos)
 *    if the Firebase Storage bucket has not been enabled yet (HTTP 404).
 */
export async function uploadMediaToFirebase(
  file: File,
  folder: MediaFolder,
  onProgress?: (pct: number) => void,
  sessionTokenOverride?: string,
  options?: MediaUploadOptions
): Promise<string> {
  const isVideo = folder === 'products/videos';
  const kind: 'image' | 'video' = isVideo ? 'video' : 'image';
  const uploadKey =
    options?.uploadKey ||
    `${folder}:${file.name}:${file.size}:${file.lastModified || 0}`;

  const existingActive = activeUploadRegistry.get(uploadKey);
  if (existingActive) {
    logUploadStage('DuplicatePrevented', { uploadKey, name: file.name, folder });
    return existingActive.promise;
  }

  const internalAbort = new AbortController();
  const externalSignal = options?.signal;
  const forwardAbort = () => internalAbort.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      internalAbort.abort();
    } else {
      externalSignal.addEventListener('abort', forwardAbort, { once: true });
    }
  }

  const runPipeline = async (): Promise<string> => {
    const signal = internalAbort.signal;

    try {
      if (signal.aborted) {
        throw new MediaUploadError(`Upload cancelled for ${file.name}.`, {
          code: 'ABORTED',
          isPermanent: true,
          stage: 'cancelled',
        });
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new MediaUploadError(
          `You appear to be offline. Reconnect to the internet before uploading ${file.name}.`,
          { code: 'OFFLINE', isPermanent: true, stage: 'error' }
        );
      }

      // Stage 1: Validate file format, magic bytes, size, and decodability
      options?.onStageChange?.('validating');
      const validated = await validateMediaFile(file, kind);

      if (signal.aborted) {
        throw new MediaUploadError(`Upload cancelled for ${file.name}.`, {
          code: 'ABORTED',
          isPermanent: true,
          stage: 'cancelled',
        });
      }

      // Stage 2: Wait for Firebase Auth persistence hydration, verify Admin user & refresh ID token
      options?.onStageChange?.('authenticating');
      await auth.authStateReady();
      if (!isVerifiedAdminUser(auth.currentUser)) {
        throw new MediaUploadError(
          'Authentication stage failed (storage/unauthenticated): Google Admin sign-in (lord79915@gmail.com or pythoxfashion@gmail.com) is required to upload product media permanently.',
          { code: 'storage/unauthenticated', isPermanent: true, stage: 'authenticating' }
        );
      }

      let firebaseIdToken = '';
      try {
        firebaseIdToken = await auth.currentUser!.getIdToken(true);
      } catch {
        firebaseIdToken = '';
      }
      if (!firebaseIdToken) {
        throw new MediaUploadError(
          'Authentication stage failed (storage/unauthenticated): Google Admin session expired. Please re-authenticate and retry.',
          { code: 'storage/unauthenticated', isPermanent: true, stage: 'authenticating' }
        );
      }

      const sessionToken = sessionTokenOverride ?? inMemoryAdminSessionToken;
      onProgress?.(2);
      options?.onStageChange?.('probing-bucket');

      // Stage 3: Probe Firebase Storage bucket availability cleanly
      const bucketProbe = await checkFirebaseStorageBucketStatus();
      const activeBucket = bucketProbe.bucketName || STORAGE_BUCKET;
      logUploadStage('Start', {
        name: file.name,
        folder,
        kind,
        sizeBytes: file.size,
        storageBucket: activeBucket,
        bucketAvailable: bucketProbe.available,
        bucketProbeReason: bucketProbe.reason || 'ok',
        httpStatus: bucketProbe.httpStatus,
      });

      options?.onStageChange?.('preparing');

      // Path A: Firebase Storage bucket IS provisioned and healthy -> use real Firebase Storage!
      if (bucketProbe.available) {
        let storageFile = file;
        let storageMime: string = validated.detectedMime;
        if (!isVideo) {
          const optimized = await optimizeImageForStorageBucket(
            file,
            validated.detectedMime as 'image/jpeg' | 'image/png' | 'image/webp'
          );
          storageFile = optimized.file;
          storageMime = optimized.mimeType;
        }

        try {
          const downloadUrl = await uploadViaFirebaseStorageWithRetry(
            storageFile,
            folder,
            storageMime,
            isVideo,
            activeBucket,
            onProgress,
            signal,
            options?.onStageChange
          );
          options?.onStageChange?.('complete');
          return downloadUrl;
        } catch (storageErr) {
          const classified = classifyFirebaseStorageError(storageErr, file.name);
          // For images, allow durable Firestore fallback ONLY if Storage network/CORS blocked unexpectedly (never silently swallow auth/validation failures)
          const canFallbackImage =
            !isVideo &&
            classified.code !== 'storage/unauthorized' &&
            classified.code !== 'storage/unauthenticated' &&
            classified.code !== 'storage/canceled' &&
            classified.code !== 'ABORTED';
          if (!canFallbackImage) {
            throw classified;
          }
          logUploadStage('Retry', {
            name: file.name,
            reason: `Firebase Storage unavailable (${classified.code}); using verified durable image store.`,
          });
        }
      }

      // Path B: Firebase Storage bucket not yet enabled (HTTP 404) or CORS-blocked
      if (!isVideo) {
        const compressedImage = await compressImageForDurableStorage(file);
        const compressedMime = normalizeDurableMime(
          compressedImage.type || validated.detectedMime,
          compressedImage.name
        );

        options?.onStageChange?.('uploading');
        try {
          const result = await uploadViaBackendXhr(
            compressedImage,
            'image',
            compressedMime,
            sessionToken,
            firebaseIdToken,
            onProgress,
            signal
          );

          if (result.persistent && isValidUploadedMediaUrl(result.url) && !result.url.startsWith('/uploads/')) {
            options?.onStageChange?.('complete');
            logUploadStage('DownloadURL', {
              provider: 'backend-firestore-media-assets',
              name: file.name,
              url: result.url,
            });
            return result.url;
          }
        } catch (backendErr) {
          if (backendErr instanceof MediaUploadError) {
            if (
              backendErr.code === 'ABORTED' ||
              backendErr.code === 'UNAUTHORIZED'
            ) {
              throw backendErr;
            }
          }
        }

        options?.onStageChange?.('verifying');
        const directUrl = await uploadImageDirectToFirestoreMediaAssets(
          compressedImage,
          onProgress,
          signal
        );
        options?.onStageChange?.('complete');
        return directUrl;
      }

      // Video path when Firebase Storage bucket returns 404 ("The specified bucket does not exist")
      options?.onStageChange?.('uploading');
      try {
        const videoResult = await uploadViaBackendXhr(
          file,
          'video',
          validated.detectedMime,
          sessionToken,
          firebaseIdToken,
          onProgress,
          signal
        );
        if (isValidUploadedMediaUrl(videoResult.url)) {
          options?.onStageChange?.('complete');
          logUploadStage('DownloadURL', {
            provider: 'express-uploads',
            name: file.name,
            url: videoResult.url,
            persistent: videoResult.persistent,
          });
          return videoResult.url;
        }
      } catch (backendErr) {
        if (
          backendErr instanceof MediaUploadError &&
          backendErr.code !== 'BACKEND_UNAVAILABLE'
        ) {
          throw backendErr;
        }
      }

      const bucketMessage =
        bucketProbe.reason === 'bucket-not-found'
          ? `Firebase Storage bucket "${STORAGE_BUCKET}" is not activated yet on project "pythoxworld" (HTTP 404). Open Firebase Console -> Storage -> Get Started to activate your Storage bucket, publish storage.rules, and retry.`
          : bucketProbe.reason === 'offline'
            ? `Cannot upload video ${file.name} while offline.`
            : `Firebase Storage bucket "${STORAGE_BUCKET}" is unreachable from this origin (${bucketProbe.reason || 'CORS/network'}). Verify Firebase Storage CORS settings and try again.`;

      throw new MediaUploadError(bucketMessage, {
        code:
          bucketProbe.reason === 'bucket-not-found'
            ? 'storage/bucket-not-found'
            : 'STORAGE_UNAVAILABLE',
        isPermanent: true,
        stage: 'error',
      });
    } catch (err) {
      const normalizedErr =
        err instanceof MediaUploadError
          ? err
          : classifyFirebaseStorageError(err, file.name);
      if (normalizedErr.stage === 'cancelled') {
        options?.onStageChange?.('cancelled');
        logUploadStage('Cancelled', { name: file.name, uploadKey });
      } else {
        options?.onStageChange?.('error');
        logUploadStage('Error', {
          name: file.name,
          uploadKey,
          code: normalizedErr.code,
          isPermanent: normalizedErr.isPermanent,
          message: normalizedErr.message,
        });
      }
      throw normalizedErr;
    } finally {
      externalSignal?.removeEventListener('abort', forwardAbort);
      activeUploadRegistry.delete(uploadKey);
    }
  };

  const promise = runPipeline();
  activeUploadRegistry.set(uploadKey, {
    cancel: () => internalAbort.abort(),
    promise,
  });

  return promise;
}

export interface MinimalStorageTestResult {
  ok: boolean;
  failedStage?: MediaUploadStage;
  code?: string;
  message: string;
  bucket: string;
  objectPath: string;
  uid?: string;
  downloadUrl?: string;
}

/**
 * Minimal internal Storage diagnostic test using the exact app/auth/storage instance
 * and authenticated admin session against `admin-test/{uid}/test-image.jpg`.
 */
export async function runMinimalStorageUploadTest(): Promise<MinimalStorageTestResult> {
  await auth.authStateReady();
  const user = auth.currentUser;
  const uid = user?.uid || 'anonymous';
  const objectPath = `admin-test/${uid}/test-image.jpg`;

  if (!isVerifiedAdminUser(user)) {
    return {
      ok: false,
      failedStage: 'authenticating',
      code: 'storage/unauthenticated',
      message: 'Unauthenticated: sign in with an authorized Google Admin account first.',
      bucket: STORAGE_BUCKET,
      objectPath,
    };
  }

  try {
    await user!.getIdToken(true);
  } catch {
    return {
      ok: false,
      failedStage: 'authenticating',
      code: 'storage/unauthenticated',
      message: 'Authentication token refresh failed for current admin user.',
      bucket: STORAGE_BUCKET,
      objectPath,
      uid,
    };
  }

  const probe = await checkFirebaseStorageBucketStatus(true);
  const activeBucket = probe.bucketName || STORAGE_BUCKET;
  if (!probe.available) {
    return {
      ok: false,
      failedStage: 'probing-bucket',
      code: probe.reason === 'bucket-not-found' ? 'storage/bucket-not-found' : 'NETWORK_ERROR',
      message:
        probe.reason === 'bucket-not-found'
          ? `Invalid or unactivated bucket "${activeBucket}" (HTTP ${probe.httpStatus || 404}). Enable Firebase Storage in Firebase Console -> Storage -> Get Started.`
          : `Storage endpoint unreachable (${probe.reason || 'cors-or-network'}).`,
      bucket: activeBucket,
      objectPath,
      uid,
    };
  }

  // Minimal valid 1x1 JPEG payload
  const tinyJpegBytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03,
    0x03, 0x03, 0x03, 0x04, 0x03, 0x03, 0x04, 0x05, 0x08, 0x05, 0x05, 0x04, 0x04, 0x05, 0x0a, 0x07,
    0x07, 0x06, 0x08, 0x0c, 0x0a, 0x0c, 0x0c, 0x0b, 0x0a, 0x0b, 0x0b, 0x0d, 0x0e, 0x12, 0x10, 0x0d,
    0x0e, 0x11, 0x0e, 0x0b, 0x0b, 0x10, 0x16, 0x10, 0x11, 0x13, 0x14, 0x15, 0x15, 0x15, 0x0c, 0x0f,
    0x17, 0x18, 0x16, 0x14, 0x18, 0x12, 0x14, 0x15, 0x14, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xff, 0xc4, 0x00, 0x14,
    0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xd2, 0xcf, 0x20, 0xff,
    0xd9,
  ]);
  const testStorage = getStorageInstance(activeBucket);
  testStorage.maxUploadRetryTime = 8_000;
  testStorage.maxOperationRetryTime = 8_000;
  const testRef = ref(testStorage, objectPath);

  try {
    const snap = await uploadBytes(testRef, tinyJpegBytes, { contentType: 'image/jpeg' });
    let downloadUrl = '';
    try {
      downloadUrl = await getDownloadURL(snap.ref);
    } catch (dlErr) {
      const classifiedDl = classifyFirebaseStorageError(dlErr, 'test-image.jpg', 'download-url');
      return {
        ok: false,
        failedStage: 'download-url',
        code: classifiedDl.code,
        message: classifiedDl.message,
        bucket: activeBucket,
        objectPath,
        uid,
      };
    }

    await deleteObject(snap.ref).catch(() => {});
    return {
      ok: true,
      message: `Minimal Storage test succeeded against ${activeBucket}/${objectPath}.`,
      bucket: activeBucket,
      objectPath,
      uid,
      downloadUrl,
    };
  } catch (err) {
    const classified = classifyFirebaseStorageError(err, 'test-image.jpg');
    return {
      ok: false,
      failedStage: classified.stage,
      code: classified.code,
      message: classified.message,
      bucket: activeBucket,
      objectPath,
      uid,
    };
  }
}
