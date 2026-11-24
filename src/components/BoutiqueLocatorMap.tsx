import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APILoadingStatus,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Crosshair, ExternalLink, Loader2, MapPin, Search } from 'lucide-react';
import { BRAND_LOCATION } from '../config/storeConfig';
import { useStore } from '../context/StoreContext';
import { apiUrl } from '../lib/api';

export interface StoreLocation {
  id: string;
  name: string;
  address: string;
  hours: string;
  position: { lat: number; lng: number };
}

export const STORE_LOCATIONS: StoreLocation[] = [
  {
    id: 'savar-flagship',
    name: 'PYTHOX WORLD Flagship Store',
    address: BRAND_LOCATION,
    hours: 'Daily 10:30 AM – 9:30 PM',
    position: { lat: 23.8485, lng: 90.2587 },
  },
];

let globalGmpSdkFailed = false;
const fallbackListeners = new Set<() => void>();

export function triggerGmpSdkFallback() {
  if (globalGmpSdkFailed) return;
  globalGmpSdkFailed = true;
  fallbackListeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('gmp-sdk-fallback', () => {
    triggerGmpSdkFallback();
  });
}

export function useGmpSdkFallbackFlag(): boolean {
  const [failed, setFailed] = useState(globalGmpSdkFailed);
  useEffect(() => {
    const sync = () => setFailed(globalGmpSdkFailed);
    fallbackListeners.add(sync);
    const onEvent = () => triggerGmpSdkFallback();
    window.addEventListener('gmp-sdk-fallback', onEvent);
    return () => {
      fallbackListeners.delete(sync);
      window.removeEventListener('gmp-sdk-fallback', onEvent);
    };
  }, []);
  return failed;
}

export const MapsSdkBoundary: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { mapsApiKey } = useStore();
  const sdkFailed = useGmpSdkFallbackFlag();

  if (!mapsApiKey || sdkFailed) {
    return <>{children}</>;
  }

  return (
    <APIProvider
      apiKey={mapsApiKey}
      libraries={['places', 'marker']}
      language="en"
      region="BD"
      onError={() => triggerGmpSdkFallback()}
    >
      {children}
    </APIProvider>
  );
};

function useMapsJsReady(): {
  hasKey: boolean;
  sdkLoaded: boolean;
  sdkFailed: boolean;
} {
  const { mapsApiKey } = useStore();
  const status = useApiLoadingStatus();
  const globalFailed = useGmpSdkFallbackFlag();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!mapsApiKey || globalFailed) return;
    if (status === APILoadingStatus.LOADED) {
      setTimedOut(false);
      return;
    }
    if (
      status === APILoadingStatus.FAILED ||
      status === APILoadingStatus.AUTH_FAILURE
    ) {
      triggerGmpSdkFallback();
      return;
    }
    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [mapsApiKey, globalFailed, status]);

  const sdkFailed =
    !mapsApiKey ||
    globalFailed ||
    timedOut ||
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE;

  return {
    hasKey: Boolean(mapsApiKey),
    sdkLoaded: !sdkFailed && status === APILoadingStatus.LOADED,
    sdkFailed,
  };
}

export function buildGoogleMapsEmbedUrl(query: string, zoom = 15): string {
  const cleanQuery = (query || 'Bangladesh').trim();
  const clampedZoom = Math.min(20, Math.max(4, Math.round(zoom)));
  return `https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s${encodeURIComponent(
    cleanQuery
  )}!6i${clampedZoom}`;
}

export function buildGoogleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    (query || 'Bangladesh').trim()
  )}`;
}

interface GoogleMapsIframeViewProps {
  query: string;
  zoom?: number;
  title: string;
  heightClass?: string;
  minHeightPx?: number;
  roundedClass?: string;
  badgeTitle?: string;
  badgeSubtitle?: string;
  externalQuery?: string;
}

const GoogleMapsIframeView: React.FC<GoogleMapsIframeViewProps> = ({
  query,
  zoom = 15,
  title,
  heightClass = 'h-[340px] sm:h-[380px]',
  minHeightPx = 240,
  roundedClass = 'rounded-3xl',
  badgeTitle,
  badgeSubtitle,
  externalQuery,
}) => {
  const embedSrc = useMemo(() => buildGoogleMapsEmbedUrl(query, zoom), [query, zoom]);
  const externalHref = useMemo(
    () => buildGoogleMapsSearchUrl(externalQuery || query),
    [externalQuery, query]
  );

  return (
    <div
      className={`relative w-full ${heightClass} ${roundedClass} border border-[#D9D9D9] bg-[#EAE9E4] overflow-hidden`}
      style={{ minHeight: `${minHeightPx}px` }}
    >
      <iframe
        title={title}
        src={embedSrc}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        className="w-full h-full border-0 block"
        style={{ width: '100%', height: '100%', minHeight: `${minHeightPx}px` }}
      />

      {badgeTitle && (
        <div className="pointer-events-none absolute left-3 bottom-3 right-3 sm:right-auto sm:max-w-[290px] rounded-xl bg-white/95 backdrop-blur-sm border border-[#D9D9D9] px-3 py-2 shadow-sm">
          <p className="text-[11px] font-semibold text-[#0A0A0A] truncate">
            {badgeTitle}
          </p>
          {badgeSubtitle && (
            <p className="text-[10px] text-[#5C5C5C] truncate mt-0.5">
              {badgeSubtitle}
            </p>
          )}
        </div>
      )}

      <a
        href={externalHref}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-lg bg-white/95 border border-[#D9D9D9] px-2.5 py-1.5 text-[11px] font-medium text-[#0A0A0A] shadow-sm hover:border-[#0A0A0A] transition-colors"
      >
        <span>Open in Maps</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    </div>
  );
};

interface CameraTarget {
  lat: number;
  lng: number;
  zoom?: number;
}

const MapCameraController: React.FC<{ target: CameraTarget | null }> = ({ target }) => {
  const map = useMap();
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (!map || !target) return;
    const key = `${target.lat.toFixed(6)},${target.lng.toFixed(6)},${target.zoom ?? ''}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    map.panTo({ lat: target.lat, lng: target.lng });
    if (typeof target.zoom === 'number') {
      const currentZoom = map.getZoom();
      if (typeof currentZoom !== 'number' || currentZoom < target.zoom) {
        map.setZoom(target.zoom);
      }
    }
  }, [map, target]);

  return null;
};

interface MarkerItemProps {
  loc: StoreLocation;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const StoreMarkerItem: React.FC<MarkerItemProps> = ({
  loc,
  isSelected,
  onSelect,
  onClose,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={loc.position}
        onClick={() => onSelect(loc.id)}
      >
        <Pin background="#0A0A0A" borderColor="#0A0A0A" glyphColor="#FFFFFF" />
      </AdvancedMarker>
      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onClose}>
          <div className="p-1 max-w-[230px]">
            <p className="text-xs font-semibold text-[#0A0A0A]">{loc.name}</p>
            <p className="mt-1 text-[11px] text-[#292929]">{loc.address}</p>
            <p className="mt-1 text-[11px] text-[#808080]">{loc.hours}</p>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface PlacesTextSearchResult {
  location?: { lat: () => number; lng: () => number } | null;
  formattedAddress?: string;
}

async function resolvePlaceClientSide(
  placesLib: unknown,
  query: string
): Promise<{ lat: number; lng: number; formattedAddress?: string } | null> {
  const lib = placesLib as
    | {
        Place?: {
          searchByText?: (req: {
            textQuery: string;
            fields: string[];
            region?: string;
            maxResultCount?: number;
          }) => Promise<{ places?: PlacesTextSearchResult[] }>;
        };
      }
    | null;

  if (!lib?.Place?.searchByText) return null;
  try {
    const res = await lib.Place.searchByText({
      textQuery: query,
      fields: ['location', 'formattedAddress'],
      region: 'bd',
      maxResultCount: 1,
    });
    const top = res.places?.[0];
    if (!top?.location) return null;
    const lat = top.location.lat();
    const lng = top.location.lng();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      formattedAddress: top.formattedAddress,
    };
  } catch {
    return null;
  }
}

interface BoutiqueLocatorMapProps {
  businessAddress?: string;
  heightClass?: string;
}

const BoutiqueLocatorMapInner: React.FC<BoutiqueLocatorMapProps> = ({
  businessAddress,
  heightClass = 'h-[340px] sm:h-[380px]',
}) => {
  const { sdkLoaded, sdkFailed } = useMapsJsReady();
  const placesLib = useMapsLibrary('places');
  const [selectedId, setSelectedId] = useState<string | null>('savar-flagship');
  const trimmedCustom = (businessAddress || '').trim();
  const isDefaultStoreAddress = !trimmedCustom || trimmedCustom === BRAND_LOCATION;
  const [resolvedPos, setResolvedPos] = useState<{ lat: number; lng: number }>(
    STORE_LOCATIONS[0].position
  );
  const [customResolved, setCustomResolved] = useState(false);

  useEffect(() => {
    if (isDefaultStoreAddress) {
      setResolvedPos(STORE_LOCATIONS[0].position);
      setCustomResolved(false);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();

    fetch(apiUrl(`/api/maps/geocode?address=${encodeURIComponent(trimmedCustom)}`), {
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (res.status === 429) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          triggerGmpSdkFallback();
          return null;
        }
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (!res.ok || !ct.includes('application/json')) return null;
        return (await res.json()) as { location?: { lat: number; lng: number } };
      })
      .then(async (data) => {
        if (cancelled) return;
        if (data?.location) {
          setResolvedPos(data.location);
          setCustomResolved(true);
          return;
        }
        const clientMatch = await resolvePlaceClientSide(placesLib, trimmedCustom);
        if (!cancelled && clientMatch) {
          setResolvedPos({ lat: clientMatch.lat, lng: clientMatch.lng });
          setCustomResolved(true);
        }
      })
      .catch(() => {
        // Keep Savar canonical coordinates or embed address lookup on static builds
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [isDefaultStoreAddress, trimmedCustom, placesLib]);

  const showroomLocations = useMemo<StoreLocation[]>(
    () => [
      {
        ...STORE_LOCATIONS[0],
        address: trimmedCustom || STORE_LOCATIONS[0].address,
        position: resolvedPos,
      },
    ],
    [trimmedCustom, resolvedPos]
  );

  const handleClose = useCallback(() => setSelectedId(null), []);

  const embedQuery = useMemo(() => {
    if (isDefaultStoreAddress || customResolved) {
      return `${resolvedPos.lat.toFixed(6)},${resolvedPos.lng.toFixed(6)}`;
    }
    return trimmedCustom;
  }, [isDefaultStoreAddress, customResolved, resolvedPos, trimmedCustom]);

  if (sdkFailed || !sdkLoaded) {
    return (
      <GoogleMapsIframeView
        query={embedQuery}
        externalQuery={trimmedCustom || `${resolvedPos.lat.toFixed(6)},${resolvedPos.lng.toFixed(6)}`}
        zoom={16}
        title="PYTHOX WORLD Flagship Store Location"
        heightClass={heightClass}
        minHeightPx={320}
        roundedClass="rounded-3xl"
        badgeTitle={STORE_LOCATIONS[0].name}
        badgeSubtitle={trimmedCustom || BRAND_LOCATION}
      />
    );
  }

  return (
    <div
      className={`relative w-full ${heightClass} rounded-3xl border border-[#D9D9D9] bg-[#F5F5F5] overflow-hidden`}
      style={{ minHeight: '320px' }}
    >
      <GoogleMap
        defaultCenter={resolvedPos}
        defaultZoom={16}
        mapId="DEMO_MAP_ID"
        gestureHandling="greedy"
        disableDefaultUI={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%', minHeight: '320px' }}
      >
        <MapCameraController target={{ ...resolvedPos, zoom: 16 }} />
        {showroomLocations.map((loc) => (
          <StoreMarkerItem
            key={loc.id}
            loc={loc}
            isSelected={selectedId === loc.id}
            onSelect={setSelectedId}
            onClose={handleClose}
          />
        ))}
      </GoogleMap>

      <a
        href={buildGoogleMapsSearchUrl(
          isDefaultStoreAddress
            ? `${resolvedPos.lat.toFixed(6)},${resolvedPos.lng.toFixed(6)}`
            : trimmedCustom
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 right-12 inline-flex items-center gap-1 rounded-lg bg-white/95 border border-[#D9D9D9] px-2.5 py-1.5 text-[11px] font-medium text-[#0A0A0A] shadow-sm hover:border-[#0A0A0A] transition-colors"
      >
        <span>Open in Maps</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    </div>
  );
};

/**
 * Independent Business Showroom Map (used on About Us and Contact pages).
 * Renders interactive Google Maps JS SDK when available and falls back seamlessly
 * to Google Maps Embed when published without a server key or on referrer restrictions.
 */
export const BoutiqueLocatorMap: React.FC<BoutiqueLocatorMapProps> = (props) => (
  <MapsSdkBoundary>
    <BoutiqueLocatorMapInner {...props} />
  </MapsSdkBoundary>
);

export interface CustomerDeliveryMapProps {
  address: string;
  area: string;
  city: string;
  postalCode: string;
  deliveryLocation: { lat: number; lng: number; label: string } | null;
  onLocationChange: (loc: { lat: number; lng: number; label: string } | null) => void;
  onReverseGeocodeAddress?: (info: {
    formattedAddress: string;
    area?: string;
    city?: string;
    postalCode?: string;
  }) => void;
  heightClass?: string;
}

const BANGLADESH_OVERVIEW_CENTER = { lat: 23.685, lng: 90.3563 };

const CustomerDeliveryMapInner: React.FC<CustomerDeliveryMapProps> = ({
  address,
  area,
  city,
  postalCode,
  deliveryLocation,
  onLocationChange,
  onReverseGeocodeAddress,
  heightClass = 'h-[240px] sm:h-[260px]',
}) => {
  const { sdkLoaded, sdkFailed } = useMapsJsReady();
  const placesLib = useMapsLibrary('places');
  const [customerMarkerRef, customerMarker] = useAdvancedMarkerRef();
  const [showInfo, setShowInfo] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(
    deliveryLocation
      ? { lat: deliveryLocation.lat, lng: deliveryLocation.lng, zoom: 15 }
      : null
  );

  const lastGeocodedQueryRef = useRef<string>('');
  const skipNextAutoGeocodeRef = useRef<boolean>(false);
  const activeAbortRef = useRef<AbortController | null>(null);

  const composedQuery = useMemo(() => {
    const parts = [address, area, city, postalCode]
      .map((v) => v.trim())
      .filter(Boolean);
    if (parts.length === 0) return '';
    return `${parts.join(', ')}, Bangladesh`;
  }, [address, area, city, postalCode]);

  const hasTypedMeaningfulAddress = useMemo(() => {
    return (
      address.trim().length >= 3 ||
      area.trim().length >= 2 ||
      (city.trim().length >= 2 && city.trim() !== 'Dhaka')
    );
  }, [address, area, city]);

  const runForwardGeocode = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      if (activeAbortRef.current) activeAbortRef.current.abort();
      const ctrl = new AbortController();
      activeAbortRef.current = ctrl;

      setGeocoding(true);
      setStatusMessage('');
      try {
        let resolved: { lat: number; lng: number; label: string } | null = null;
        let backendResponded = false;

        try {
          const res = await fetch(
            apiUrl(`/api/maps/geocode?address=${encodeURIComponent(query)}`),
            { signal: ctrl.signal }
          );
          if (res.status === 429) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
            triggerGmpSdkFallback();
            setStatusMessage('Map search quota reached. Showing address view on map.');
            return;
          }
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (ct.includes('application/json')) {
            backendResponded = true;
            const data = (await res.json().catch(() => null)) as
              | {
                  formattedAddress?: string;
                  location?: { lat: number; lng: number };
                  error?: string;
                }
              | null;

            if (res.ok && data?.location) {
              resolved = {
                lat: data.location.lat,
                lng: data.location.lng,
                label: data.formattedAddress || query.replace(/, Bangladesh$/i, ''),
              };
            }
          }
        } catch (err) {
          if ((err as { name?: string })?.name === 'AbortError') return;
        }

        if (!resolved && placesLib) {
          const clientMatch = await resolvePlaceClientSide(placesLib, query);
          if (clientMatch) {
            resolved = {
              lat: clientMatch.lat,
              lng: clientMatch.lng,
              label:
                clientMatch.formattedAddress || query.replace(/, Bangladesh$/i, ''),
            };
          }
        }

        if (ctrl.signal.aborted) return;

        if (!resolved) {
          if (sdkFailed || !sdkLoaded || !backendResponded) {
            // In embed fallback mode, sync the typed address cleanly without showing error noise
            lastGeocodedQueryRef.current = query;
            setStatusMessage('');
          } else {
            setStatusMessage(
              'Could not match address automatically — tap map to set delivery pin.'
            );
          }
          return;
        }

        lastGeocodedQueryRef.current = query;
        onLocationChange(resolved);
        setCameraTarget({
          lat: resolved.lat,
          lng: resolved.lng,
          zoom: address.trim().length >= 5 ? 16 : 14,
        });
        setShowInfo(true);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setStatusMessage('Unable to locate address right now — tap map or use GPS.');
      } finally {
        if (activeAbortRef.current === ctrl) {
          activeAbortRef.current = null;
          setGeocoding(false);
        }
      }
    },
    [address, onLocationChange, placesLib, sdkFailed, sdkLoaded]
  );

  // Sync camera if autocomplete or persisted draft updated deliveryLocation externally
  useEffect(() => {
    if (!deliveryLocation) return;
    setCameraTarget({
      lat: deliveryLocation.lat,
      lng: deliveryLocation.lng,
      zoom: 15,
    });
  }, [deliveryLocation?.lat, deliveryLocation?.lng]);

  // Debounced auto-geocoding whenever customer edits address, area, city, or postal code
  useEffect(() => {
    if (!composedQuery || !hasTypedMeaningfulAddress) return;
    if (skipNextAutoGeocodeRef.current) {
      skipNextAutoGeocodeRef.current = false;
      lastGeocodedQueryRef.current = composedQuery;
      return;
    }
    if (
      deliveryLocation &&
      address.trim().length >= 3 &&
      deliveryLocation.label.trim().toLowerCase() === address.trim().toLowerCase()
    ) {
      lastGeocodedQueryRef.current = composedQuery;
      return;
    }
    if (composedQuery === lastGeocodedQueryRef.current) return;

    const timer = window.setTimeout(() => {
      void runForwardGeocode(composedQuery);
    }, 550);

    return () => window.clearTimeout(timer);
  }, [
    composedQuery,
    hasTypedMeaningfulAddress,
    address,
    deliveryLocation,
    runForwardGeocode,
  ]);

  const handlePinCoordinates = useCallback(
    async (lat: number, lng: number) => {
      const fallbackLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      skipNextAutoGeocodeRef.current = true;
      onLocationChange({ lat, lng, label: fallbackLabel });
      setCameraTarget({ lat, lng, zoom: 16 });
      setShowInfo(true);
      setGeocoding(true);
      setStatusMessage('');

      try {
        const res = await fetch(
          apiUrl(
            `/api/maps/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(
              lng
            )}`
          )
        );
        if (res.status === 429) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          triggerGmpSdkFallback();
          return;
        }
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('application/json')) return;
        const data = (await res.json().catch(() => null)) as
          | {
              formattedAddress?: string;
              area?: string;
              city?: string;
              postalCode?: string;
            }
          | null;

        if (res.ok && data?.formattedAddress) {
          skipNextAutoGeocodeRef.current = true;
          onLocationChange({
            lat,
            lng,
            label: data.formattedAddress,
          });
          onReverseGeocodeAddress?.({
            formattedAddress: data.formattedAddress,
            area: data.area,
            city: data.city,
            postalCode: data.postalCode,
          });
        }
      } catch {
        // Keep pinned lat/lng even if reverse geocode fails or backend is static
      } finally {
        setGeocoding(false);
      }
    },
    [onLocationChange, onReverseGeocodeAddress]
  );

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage('Browser geolocation is unavailable on this device.');
      return;
    }
    setLocatingGps(true);
    setStatusMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        void handlePinCoordinates(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocatingGps(false);
        setStatusMessage('Location permission denied. Enter your address or tap the map.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const embedQuery = useMemo(() => {
    if (
      deliveryLocation &&
      Number.isFinite(deliveryLocation.lat) &&
      Number.isFinite(deliveryLocation.lng)
    ) {
      return `${deliveryLocation.lat.toFixed(6)},${deliveryLocation.lng.toFixed(6)}`;
    }
    if (hasTypedMeaningfulAddress && composedQuery) {
      return composedQuery;
    }
    return 'Bangladesh';
  }, [deliveryLocation, hasTypedMeaningfulAddress, composedQuery]);

  const embedZoom = deliveryLocation ? 16 : hasTypedMeaningfulAddress ? 15 : 7;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-1.5 text-xs text-[#292929]">
          <MapPin className="h-3.5 w-3.5 text-[#0A0A0A] shrink-0" />
          <span className="truncate font-medium">
            {deliveryLocation
              ? `Delivery Pin: ${deliveryLocation.label}`
              : hasTypedMeaningfulAddress
              ? `Map Target: ${composedQuery.replace(/, Bangladesh$/i, '')}`
              : 'Enter delivery address or tap Current Location to pin'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {composedQuery && (
            <button
              type="button"
              disabled={geocoding}
              onClick={() => {
                lastGeocodedQueryRef.current = '';
                if (sdkFailed || !sdkLoaded) {
                  onLocationChange(null);
                }
                void runForwardGeocode(composedQuery);
              }}
              className="inline-flex items-center gap-1.5 min-h-[34px] rounded-lg border border-[#D4D3CE] bg-white px-2.5 py-1 text-[11px] font-medium text-[#0A0A0A] hover:border-[#0A0A0A] disabled:opacity-60 cursor-pointer"
            >
              {geocoding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Search className="h-3 w-3" />
              )}
              <span>Locate Address</span>
            </button>
          )}
          <button
            type="button"
            disabled={locatingGps || geocoding}
            onClick={handleUseCurrentLocation}
            className="inline-flex items-center gap-1.5 min-h-[34px] rounded-lg border border-[#D4D3CE] bg-[#F3F2EE] px-2.5 py-1 text-[11px] font-medium text-[#0A0A0A] hover:border-[#0A0A0A] disabled:opacity-60 cursor-pointer"
          >
            {locatingGps ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Crosshair className="h-3 w-3" />
            )}
            <span>Current Location</span>
          </button>
        </div>
      </div>

      {sdkFailed || !sdkLoaded ? (
        <GoogleMapsIframeView
          query={embedQuery}
          externalQuery={embedQuery}
          zoom={embedZoom}
          title="Customer Delivery Location Map"
          heightClass={heightClass}
          minHeightPx={240}
          roundedClass="rounded-2xl"
          badgeTitle={
            deliveryLocation
              ? 'Customer Delivery Location'
              : hasTypedMeaningfulAddress
              ? 'Entered Delivery Address'
              : 'Bangladesh Delivery Coverage'
          }
          badgeSubtitle={
            deliveryLocation
              ? deliveryLocation.label
              : hasTypedMeaningfulAddress
              ? composedQuery.replace(/, Bangladesh$/i, '')
              : 'Enter address above or tap Current Location'
          }
        />
      ) : (
        <div
          className={`relative w-full ${heightClass} rounded-2xl border border-[#D9D9D9] bg-[#F5F5F5] overflow-hidden`}
          style={{ minHeight: '240px' }}
        >
          <GoogleMap
            defaultCenter={
              deliveryLocation
                ? { lat: deliveryLocation.lat, lng: deliveryLocation.lng }
                : BANGLADESH_OVERVIEW_CENTER
            }
            defaultZoom={deliveryLocation ? 15 : 7}
            mapId="DEMO_MAP_ID"
            gestureHandling="greedy"
            disableDefaultUI={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            onClick={(ev) => {
              const latLng = ev.detail.latLng;
              if (latLng) {
                void handlePinCoordinates(latLng.lat, latLng.lng);
              }
            }}
            style={{ width: '100%', height: '100%', minHeight: '240px' }}
          >
            <MapCameraController target={cameraTarget} />

            {deliveryLocation && (
              <>
                <AdvancedMarker
                  ref={customerMarkerRef}
                  position={{ lat: deliveryLocation.lat, lng: deliveryLocation.lng }}
                  draggable
                  onDragEnd={(ev) => {
                    const pos = ev.latLng;
                    if (pos) {
                      const lat =
                        typeof pos.lat === 'function' ? pos.lat() : Number(pos.lat);
                      const lng =
                        typeof pos.lng === 'function' ? pos.lng() : Number(pos.lng);
                      if (Number.isFinite(lat) && Number.isFinite(lng)) {
                        void handlePinCoordinates(lat, lng);
                      }
                    }
                  }}
                  onClick={() => setShowInfo(true)}
                >
                  <Pin background="#0A0A0A" borderColor="#0A0A0A" glyphColor="#FFFFFF" />
                </AdvancedMarker>
                {showInfo && customerMarker && (
                  <InfoWindow
                    anchor={customerMarker}
                    onCloseClick={() => setShowInfo(false)}
                  >
                    <div className="p-1 max-w-[220px]">
                      <p className="text-xs font-semibold text-[#0A0A0A]">
                        Customer Delivery Location
                      </p>
                      <p className="mt-1 text-[11px] text-[#292929] leading-snug">
                        {deliveryLocation.label}
                      </p>
                      <p className="mt-1 text-[10px] text-[#5C5C5C]">
                        Drag marker or tap map to adjust drop-off point.
                      </p>
                    </div>
                  </InfoWindow>
                )}
              </>
            )}
          </GoogleMap>

          {!deliveryLocation && !geocoding && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-white/95 border border-[#D9D9D9] px-3 py-2 text-[11px] text-[#292929] shadow-sm">
              Enter your delivery street/area above to center the map on your location, or tap anywhere on the map to place your pin.
            </div>
          )}
        </div>
      )}

      {statusMessage && (
        <p className="text-[11px] text-[#5C5C5C]" role="status">
          {statusMessage}
        </p>
      )}
    </div>
  );
};

/**
 * Customer Checkout Delivery Map:
 * - Shows ONLY the customer's dynamically geocoded or pinned delivery address.
 * - Never falls back to or displays the business owner's Savar showroom location.
 */
export const CustomerDeliveryMap: React.FC<CustomerDeliveryMapProps> = (props) => (
  <MapsSdkBoundary>
    <CustomerDeliveryMapInner {...props} />
  </MapsSdkBoundary>
);

export interface OrderLocationPreviewMapProps {
  address: string;
  area?: string;
  city?: string;
  postalCode?: string;
  deliveryLocation?: { lat: number; lng: number; label: string } | null;
  heightClass?: string;
}

const OrderLocationPreviewMapInner: React.FC<OrderLocationPreviewMapProps> = ({
  address,
  area,
  city,
  postalCode,
  deliveryLocation,
  heightClass = 'h-[200px] sm:h-[220px]',
}) => {
  const { sdkLoaded, sdkFailed } = useMapsJsReady();
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [showInfo, setShowInfo] = useState(true);

  const addressLabel = useMemo(() => {
    const cleanPostal = postalCode && postalCode !== '0000' ? postalCode : '';
    return [address, area, city, cleanPostal].map((v) => (v || '').trim()).filter(Boolean).join(', ');
  }, [address, area, city, postalCode]);

  const hasValidCoords = Boolean(
    deliveryLocation &&
      Number.isFinite(deliveryLocation.lat) &&
      Number.isFinite(deliveryLocation.lng)
  );

  const mapQuery = useMemo(() => {
    if (hasValidCoords && deliveryLocation) {
      return `${deliveryLocation.lat.toFixed(6)},${deliveryLocation.lng.toFixed(6)}`;
    }
    return addressLabel ? `${addressLabel}, Bangladesh` : 'Bangladesh';
  }, [hasValidCoords, deliveryLocation, addressLabel]);

  if (!addressLabel && !hasValidCoords) return null;

  if (!hasValidCoords || sdkFailed || !sdkLoaded || !deliveryLocation) {
    return (
      <GoogleMapsIframeView
        query={mapQuery}
        externalQuery={mapQuery}
        zoom={hasValidCoords ? 16 : 15}
        title="Customer Delivery Location Confirmation Map"
        heightClass={heightClass}
        minHeightPx={190}
        roundedClass="rounded-2xl"
        badgeTitle="Confirmed Delivery Pin"
        badgeSubtitle={deliveryLocation?.label || addressLabel}
      />
    );
  }

  const position = { lat: deliveryLocation.lat, lng: deliveryLocation.lng };

  return (
    <div
      className={`relative w-full ${heightClass} rounded-2xl border border-[#D9D9D9] bg-[#F5F5F5] overflow-hidden`}
      style={{ minHeight: '190px' }}
    >
      <GoogleMap
        defaultCenter={position}
        defaultZoom={16}
        mapId="DEMO_MAP_ID"
        gestureHandling="cooperative"
        disableDefaultUI={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%', minHeight: '190px' }}
      >
        <MapCameraController target={{ ...position, zoom: 16 }} />
        <AdvancedMarker
          ref={markerRef}
          position={position}
          onClick={() => setShowInfo((prev) => !prev)}
        >
          <Pin background="#0A0A0A" borderColor="#0A0A0A" glyphColor="#FFFFFF" />
        </AdvancedMarker>
        {showInfo && marker && (
          <InfoWindow anchor={marker} onCloseClick={() => setShowInfo(false)}>
            <div className="p-1 max-w-[220px]">
              <p className="text-xs font-semibold text-[#0A0A0A]">
                Confirmed Delivery Pin
              </p>
              <p className="mt-1 text-[11px] text-[#292929] leading-snug">
                {deliveryLocation.label || addressLabel}
              </p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      <a
        href={buildGoogleMapsSearchUrl(mapQuery)}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 right-12 inline-flex items-center gap-1 rounded-lg bg-white/95 border border-[#D9D9D9] px-2.5 py-1.5 text-[11px] font-medium text-[#0A0A0A] shadow-sm hover:border-[#0A0A0A] transition-colors"
      >
        <span>Open in Maps</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    </div>
  );
};

export const OrderLocationPreviewMap: React.FC<OrderLocationPreviewMapProps> = (
  props
) => (
  <MapsSdkBoundary>
    <OrderLocationPreviewMapInner {...props} />
  </MapsSdkBoundary>
);
