import React, { useEffect, useRef, useState } from 'react';
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
 * 3. Resets internal attempt state whenever `src` changes (prevents stale gallery slide bugs).
 * 4. Calls `onAllFailed` cleanly when an image is genuinely unavailable so no broken-image icon renders.
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
  const onAllFailedRef = useRef(onAllFailed);
  onAllFailedRef.current = onAllFailed;

  useEffect(() => {
    let active = true;
    setFailed(false);

    if (!rawSrc) {
      setResolvedSrc('');
      setFailed(true);
      return;
    }

    const cached = getCachedCloudMediaUrl(rawSrc);
    if (cached) {
      setResolvedSrc(cached);
      return;
    }

    const mediaId = extractMediaAssetId(rawSrc);
    if (mediaId && isBackendMediaEndpointUnavailable()) {
      setResolvedSrc('');
      void resolveCloudMediaAssetFallback(rawSrc).then((cloudUrl) => {
        if (!active) return;
        if (cloudUrl) {
          setResolvedSrc(cloudUrl);
        } else {
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

  if (!rawSrc || failed) {
    return <>{fallback}</>;
  }

  if (!resolvedSrc) {
    return <div aria-hidden="true" className="h-full w-full skeleton-shimmer" />;
  }

  const handleImgError = () => {
    const mediaId = extractMediaAssetId(rawSrc);
    if (mediaId && resolvedSrc === rawSrc) {
      markBackendMediaEndpointUnavailable();
      void resolveCloudMediaAssetFallback(rawSrc).then((cloudUrl) => {
        if (cloudUrl) {
          setResolvedSrc(cloudUrl);
        } else {
          setFailed(true);
          onAllFailedRef.current?.(rawSrc);
        }
      });
      return;
    }
    setFailed(true);
    onAllFailedRef.current?.(rawSrc);
  };

  return (
    <img
      key={resolvedSrc}
      src={resolvedSrc}
      alt={alt}
      referrerPolicy={referrerPolicy}
      onLoad={(e) => {
        onImageLoaded?.();
        onLoad?.(e);
      }}
      onError={handleImgError}
      {...rest}
    />
  );
};
