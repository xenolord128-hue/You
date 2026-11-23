import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react';
import { BRAND_LOCATION } from '../config/storeConfig';
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

interface BoutiqueLocatorMapProps {
  businessAddress?: string;
  heightClass?: string;
}

/**
 * Independent Business Showroom Map (used on About Us and Contact pages).
 * Never shares or mixes state with Customer Checkout Delivery Maps.
 */
export const BoutiqueLocatorMap: React.FC<BoutiqueLocatorMapProps> = ({
  businessAddress,
  heightClass = 'h-[340px] sm:h-[380px]',
}) => {
  const [selectedId, setSelectedId] = useState<string | null>('savar-flagship');
  const trimmedCustom = (businessAddress || '').trim();
  const [resolvedPos, setResolvedPos] = useState<{ lat: number; lng: number }>(
    STORE_LOCATIONS[0].position
  );

  useEffect(() => {
    if (!trimmedCustom || trimmedCustom === BRAND_LOCATION) {
      setResolvedPos(STORE_LOCATIONS[0].position);
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
          return null;
        }
        if (!res.ok) return null;
        return (await res.json()) as { location?: { lat: number; lng: number } };
      })
      .then((data) => {
        if (!cancelled && data?.location) {
          setResolvedPos(data.location);
        }
      })
      .catch(() => {
        // Keep Savar canonical coordinates if custom address lookup fails
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [trimmedCustom]);

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

  return (
    <div
      className={`w-full ${heightClass} rounded-3xl border border-[#D9D9D9] bg-[#F5F5F5] overflow-hidden`}
    >
      <GoogleMap
        defaultCenter={resolvedPos}
        defaultZoom={15}
        mapId="DEMO_MAP_ID"
        gestureHandling="greedy"
        disableDefaultUI={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <MapCameraController target={{ ...resolvedPos, zoom: 15 }} />
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
    </div>
  );
};

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

/**
 * Customer Checkout Delivery Map:
 * - Shows ONLY the customer's dynamically geocoded or pinned delivery address.
 * - Never falls back to or displays the business owner's Savar showroom location.
 */
export const CustomerDeliveryMap: React.FC<CustomerDeliveryMapProps> = ({
  address,
  area,
  city,
  postalCode,
  deliveryLocation,
  onLocationChange,
  onReverseGeocodeAddress,
  heightClass = 'h-[240px] sm:h-[260px]',
}) => {
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
        const res = await fetch(
          apiUrl(`/api/maps/geocode?address=${encodeURIComponent(query)}`),
          { signal: ctrl.signal }
        );
        if (res.status === 429) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          setStatusMessage('Map search quota reached. Drag or tap map to set pin.');
          return;
        }
        const data = (await res.json().catch(() => null)) as
          | {
              formattedAddress?: string;
              location?: { lat: number; lng: number };
              error?: string;
            }
          | null;

        if (!res.ok || !data?.location) {
          setStatusMessage(
            data?.error || 'Could not match address automatically — tap map to set delivery pin.'
          );
          return;
        }

        const label = data.formattedAddress || query.replace(/, Bangladesh$/i, '');
        lastGeocodedQueryRef.current = query;
        const nextLoc = {
          lat: data.location.lat,
          lng: data.location.lng,
          label,
        };
        onLocationChange(nextLoc);
        setCameraTarget({
          lat: nextLoc.lat,
          lng: nextLoc.lng,
          zoom: address.trim().length >= 5 ? 16 : 14,
        });
        setShowInfo(true);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setStatusMessage('Unable to locate address right now — tap map to drop pin.');
      } finally {
        if (activeAbortRef.current === ctrl) {
          activeAbortRef.current = null;
          setGeocoding(false);
        }
      }
    },
    [address, onLocationChange]
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
      onLocationChange({ lat, lng, label: deliveryLocation?.label || fallbackLabel });
      setCameraTarget({ lat, lng, zoom: 16 });
      setShowInfo(true);
      setGeocoding(true);
      setStatusMessage('');

      try {
        const res = await fetch(
          apiUrl(`/api/maps/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`)
        );
        if (res.status === 429) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          return;
        }
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
        // Keep pinned lat/lng even if reverse geocode fails transiently
      } finally {
        setGeocoding(false);
      }
    },
    [deliveryLocation?.label, onLocationChange, onReverseGeocodeAddress]
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

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-1.5 text-xs text-[#292929]">
          <MapPin className="h-3.5 w-3.5 text-[#0A0A0A] shrink-0" />
          <span className="truncate font-medium">
            {deliveryLocation
              ? `Delivery Pin: ${deliveryLocation.label}`
              : 'Enter delivery address or tap map to set delivery pin'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {composedQuery && (
            <button
              type="button"
              disabled={geocoding}
              onClick={() => {
                lastGeocodedQueryRef.current = '';
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

      <div
        className={`relative w-full ${heightClass} rounded-2xl border border-[#D9D9D9] bg-[#F5F5F5] overflow-hidden`}
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
          style={{ width: '100%', height: '100%' }}
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
                    const lat = typeof pos.lat === 'function' ? pos.lat() : Number(pos.lat);
                    const lng = typeof pos.lng === 'function' ? pos.lng() : Number(pos.lng);
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

      {statusMessage && (
        <p className="text-[11px] text-[#5C5C5C]" role="status">
          {statusMessage}
        </p>
      )}
    </div>
  );
};

