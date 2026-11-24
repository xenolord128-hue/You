import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';

const hydratedMediaCache = new Map<string, string>();
const inFlightMediaLookups = new Map<string, Promise<string | null>>();
let backendMediaEndpointUnavailable = false;

export function extractMediaAssetId(src: string | undefined | null): string | null {
  if (!src || typeof src !== 'string') return null;
  const match = src.match(/\/api\/media\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
}

export function isBackendMediaEndpointUnavailable(): boolean {
  return backendMediaEndpointUnavailable;
}

export function markBackendMediaEndpointUnavailable(): void {
  backendMediaEndpointUnavailable = true;
}

export function getCachedCloudMediaUrl(src: string | undefined | null): string | null {
  const mediaId = extractMediaAssetId(src);
  if (!mediaId) return null;
  return hydratedMediaCache.get(mediaId) || null;
}

export async function resolveCloudMediaAssetFallback(
  src: string | undefined | null
): Promise<string | null> {
  const mediaId = extractMediaAssetId(src);
  if (!mediaId) return null;

  const cached = hydratedMediaCache.get(mediaId);
  if (cached) return cached;

  const existingLookup = inFlightMediaLookups.get(mediaId);
  if (existingLookup) return existingLookup;

  const lookupPromise = (async () => {
    try {
      const ref = doc(db, 'media_assets', mediaId);
      let snap = await getDoc(ref).catch(() => null);
      if (!snap || !snap.exists()) {
        snap = await getDocFromServer(ref);
      }
      if (!snap.exists()) return null;

      const data = snap.data() as {
        dataBase64?: unknown;
        mimeType?: unknown;
        url?: unknown;
      };

      if (typeof data.url === 'string' && /^https?:\/\//i.test(data.url)) {
        hydratedMediaCache.set(mediaId, data.url);
        return data.url;
      }

      if (typeof data.dataBase64 !== 'string' || !data.dataBase64) return null;

      const rawMime = typeof data.mimeType === 'string' ? data.mimeType.toLowerCase() : '';
      const mimeType =
        rawMime === 'image/jpeg' || rawMime === 'image/jpg'
          ? 'image/jpeg'
          : rawMime === 'image/png'
            ? 'image/png'
            : rawMime === 'image/webp'
              ? 'image/webp'
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
 * `media_assets/{id}` document from Firestore once per mediaId and caches an object URL.
 */
export function handleCloudMediaImageError(
  img: HTMLImageElement,
  rawSrc?: string,
  onExhausted?: () => void
): void {
  if (!img) {
    onExhausted?.();
    return;
  }

  const candidate = rawSrc || img.getAttribute('src') || img.src || '';
  const mediaId = extractMediaAssetId(candidate);
  if (!mediaId) {
    onExhausted?.();
    return;
  }

  if (img.dataset.cloudFallbackAsset === mediaId) {
    onExhausted?.();
    return;
  }

  markBackendMediaEndpointUnavailable();
  img.dataset.cloudFallbackAsset = mediaId;

  const cached = hydratedMediaCache.get(mediaId);
  if (cached) {
    if (img.isConnected && img.src !== cached) {
      img.src = cached;
      return;
    }
    onExhausted?.();
    return;
  }

  void resolveCloudMediaAssetFallback(candidate).then((resolved) => {
    if (resolved && img.isConnected) {
      img.src = resolved;
    } else {
      onExhausted?.();
    }
  });
}
