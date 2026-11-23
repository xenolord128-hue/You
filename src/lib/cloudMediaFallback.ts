import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const hydratedMediaCache = new Map<string, string>();
const inFlightMediaLookups = new Map<string, Promise<string | null>>();

function extractMediaAssetId(src: string): string | null {
  const match = src.match(/\/api\/media\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
}

export async function resolveCloudMediaAssetFallback(src: string): Promise<string | null> {
  const mediaId = extractMediaAssetId(src);
  if (!mediaId) return null;

  const cached = hydratedMediaCache.get(mediaId);
  if (cached) return cached;

  const existingLookup = inFlightMediaLookups.get(mediaId);
  if (existingLookup) return existingLookup;

  const lookupPromise = (async () => {
    try {
      const snap = await getDoc(doc(db, 'media_assets', mediaId));
      if (!snap.exists()) return null;
      const data = snap.data() as { dataBase64?: unknown; mimeType?: unknown };
      if (typeof data.dataBase64 !== 'string' || !data.dataBase64) return null;

      const mimeType =
        typeof data.mimeType === 'string' && /^image\/(jpeg|png|webp)$/i.test(data.mimeType)
          ? data.mimeType
          : 'image/webp';

      const binaryStr = atob(data.dataBase64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      hydratedMediaCache.set(mediaId, blobUrl);
      return blobUrl;
    } catch {
      return null;
    } finally {
      inFlightMediaLookups.delete(mediaId);
    }
  })();

  inFlightMediaLookups.set(mediaId, lookupPromise);
  return lookupPromise;
}

/**
 * Fallback handler for <img> elements pointing to `/api/media/:id` when served from
 * static hosting without a paired Node backend. Reads the verified public-readable
 * `media_assets/{id}` document from Firestore once and caches an object URL.
 */
export function handleCloudMediaImageError(
  img: HTMLImageElement,
  rawSrc?: string,
  onExhausted?: () => void
): void {
  if (!img || img.dataset.cloudFallbackTried === '1') {
    onExhausted?.();
    return;
  }
  const candidate = rawSrc || img.getAttribute('src') || img.src || '';
  if (!extractMediaAssetId(candidate)) {
    onExhausted?.();
    return;
  }

  img.dataset.cloudFallbackTried = '1';
  void resolveCloudMediaAssetFallback(candidate).then((resolved) => {
    if (resolved && img.isConnected) {
      img.src = resolved;
    } else {
      onExhausted?.();
    }
  });
}
