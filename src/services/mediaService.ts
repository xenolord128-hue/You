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
  'image/png',
  'image/webp',
]);
const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

function sanitizeFileName(raw: string, fallbackExt: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  if (!cleaned) return `media-${Date.now()}${fallbackExt}`;
  return cleaned;
}

export function uploadMediaToFirebase(
  file: File,
  folder: MediaFolder,
  onProgress?: (pct: number) => void
): Promise<string> {
  const isVideo = folder === 'products/videos';
  const extMatch = isVideo
    ? /\.(mp4|webm|mov)$/i.test(file.name)
    : /\.(jpg|jpeg|png|webp)$/i.test(file.name);
  const mimeAllowed = isVideo
    ? ALLOWED_VIDEO_MIME.has(file.type.toLowerCase())
    : ALLOWED_IMAGE_MIME.has(file.type.toLowerCase());

  if (!mimeAllowed && !extMatch) {
    return Promise.reject(
      new Error(
        isVideo
          ? `${file.name}: unsupported video format. Allowed: MP4, WEBM, MOV.`
          : `${file.name}: unsupported image format. Allowed: JPG, PNG, WEBP.`
      )
    );
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size <= 0 || file.size > maxBytes) {
    return Promise.reject(
      new Error(
        isVideo
          ? `${file.name} exceeds the 50 MB video upload limit.`
          : `${file.name} exceeds the 10 MB image upload limit.`
      )
    );
  }

  if (!isVerifiedAdminUser(auth.currentUser)) {
    return Promise.reject(
      new Error('Please sign in with the verified Admin Google account before uploading media.')
    );
  }

  const fallbackExt = isVideo ? '.mp4' : '.jpg';
  const objectPath = `${folder}/${Date.now()}-${Math.floor(100 + Math.random() * 899)}-${sanitizeFileName(file.name, fallbackExt)}`;
  const storageRef = ref(storage, objectPath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      cacheControl: 'public, max-age=31536000',
    });

    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0 && onProgress) {
          const pct = Math.min(
            99,
            Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          );
          onProgress(pct);
        }
      },
      (error) => {
        const code = (error as { code?: string })?.code || '';
        if (code === 'storage/unauthorized') {
          reject(
            new Error(
              'Firebase Storage permission denied. Ensure Storage is enabled and storage.rules are deployed in Firebase Console.'
            )
          );
          return;
        }
        if (code === 'storage/quota-exceeded') {
          reject(new Error('Firebase Storage quota exceeded.'));
          return;
        }
        reject(new Error(error.message || `Failed to upload ${file.name} to Firebase Storage.`));
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          onProgress?.(100);
          resolve(url);
        } catch (err) {
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
