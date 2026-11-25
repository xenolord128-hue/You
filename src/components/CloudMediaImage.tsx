import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  extractMediaAssetId,
  getCachedCloudMediaUrl,
  isBackendMediaEndpointUnavailable,
  markBackendMediaEndpointUnavailable,
  resolveCloudMediaAssetFallback,
} from '../lib/cloudMediaFallback';

export interface CloudMediaImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  src?: string | null;
  fallback?: React.ReactNode;
  onAllFailed?: (failedUrl: string) => void;
  onImageLoaded?: () => void;
}

/**
 * Resilient product/editorial image component that:
 * 1. Resolves cached Firestore `media_assets` blob URLs immediately when available.
 * 2. Proactively hydrates `/api/media/:id` via Firestore if static hosting returned 404/HTML.
 * 3. Detects already-complete cached images via `imgRef.current.complete` so load callbacks never stall.
 * 4. Resets internal attempt state whenever `src` changes and safely cancels stale async lookups.
 * 5. Calls `onAllFailed` and logs failed URLs cleanly when an image is genuinely unavailable.
 */
export const CloudMediaImage: React.FC<CloudMediaImageProps> = ({
  src,
  alt = '',
  fallback = null,
  onAllFailed,
  onImageLoaded,
  onLoad,
  referrerPolicy = 'no-referrer',
  ...rest
}) => {
  const rawSrc = (src || '').trim();
  const [resolvedSrc, setResolvedSrc] = useState<string>(
    () => getCachedCloudMediaUrl(rawSrc) || rawSrc
  );
  const [failed, setFailed] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const mountedRef = useRef(true);
  const latestRawSrcRef = useRef(rawSrc);
  latestRawSrcRef.current = rawSrc;

  const onAllFailedRef = useRef(onAllFailed);
  onAllFailedRef.current = onAllFailed;

  const onImageLoadedRef = useRef(onImageLoaded);
  onImageLoadedRef.current = onImageLoaded;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setFailed(false);

    if (!rawSrc) {
      setResolvedSrc('');
      setFailed(true);
      return () => {
        active = false;
      };
    }

    const cached = getCachedCloudMediaUrl(rawSrc);
    if (cached) {
      setResolvedSrc(cached);
      return () => {
        active = false;
      };
    }

    const mediaId = extractMediaAssetId(rawSrc);
    if (mediaId && isBackendMediaEndpointUnavailable()) {
      setResolvedSrc('');
      void resolveCloudMediaAssetFallback(rawSrc).then((cloudUrl) => {
        if (!active || !mountedRef.current) return;
        if (cloudUrl) {
          setResolvedSrc(cloudUrl);
        } else {
          console.error('[CloudMediaImage] Failed to resolve cloud media fallback:', rawSrc);
          setFailed(true);
          onAllFailedRef.current?.(rawSrc);
        }
      });
      return () => {
        active = false;
      };
    }

    setResolvedSrc(rawSrc);
    return () => {
      active = false;
    };
  }, [rawSrc]);

  const handleImgError = useCallback(() => {
    const mediaId = extractMediaAssetId(rawSrc);
    if (mediaId && resolvedSrc === rawSrc) {
      markBackendMediaEndpointUnavailable();
      void resolveCloudMediaAssetFallback(rawSrc).then((cloudUrl) => {
        if (!mountedRef.current || latestRawSrcRef.current !== rawSrc) return;
        if (cloudUrl) {
          setResolvedSrc(cloudUrl);
        } else {
          console.error('[CloudMediaImage] Image failed on both backend and Firestore fallback:', rawSrc);
          setFailed(true);
          onAllFailedRef.current?.(rawSrc);
        }
      });
      return;
    }
    console.error('[CloudMediaImage] Image failed to load:', resolvedSrc || rawSrc);
    setFailed(true);
    onAllFailedRef.current?.(rawSrc);
  }, [rawSrc, resolvedSrc]);

  // Immediately recognize browser-cached / blob images whose load completed synchronously
  useLayoutEffect(() => {
    const el = imgRef.current;
    if (!el || failed || !resolvedSrc) return;
    if (el.complete) {
      if (el.naturalWidth > 0) {
        onImageLoadedRef.current?.();
      } else {
        handleImgError();
      }
    }
  }, [resolvedSrc, failed, handleImgError]);

  if (!rawSrc || failed) {
    return <>{fallback}</>;
  }

  if (!resolvedSrc) {
    return <div aria-hidden="true" className="h-full w-full skeleton-shimmer" />;
  }

  return (
    <img
      ref={imgRef}
      key={resolvedSrc}
      src={resolvedSrc}
      alt={alt}
      referrerPolicy={referrerPolicy}
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth === 0) {
          handleImgError();
          return;
        }
        onImageLoadedRef.current?.();
        onLoad?.(e);
      }}
      onError={handleImgError}
      {...rest}
    />
  );
};
