import React, { useCallback, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import { BRAND_LOCATION } from '../config/storeConfig';

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
  deliveryPoint?: { lat: number; lng: number; label: string } | null;
  heightClass?: string;
}

export const BoutiqueLocatorMap: React.FC<BoutiqueLocatorMapProps> = ({
  deliveryPoint,
  heightClass = 'h-[340px] sm:h-[380px]',
}) => {
  const [selectedId, setSelectedId] = useState<string | null>('savar-flagship');
  const [deliveryMarkerRef, deliveryMarker] = useAdvancedMarkerRef();
  const [showDeliveryInfo, setShowDeliveryInfo] = useState(true);

  const handleClose = useCallback(() => setSelectedId(null), []);

  const center = deliveryPoint
    ? { lat: deliveryPoint.lat, lng: deliveryPoint.lng }
    : STORE_LOCATIONS[0].position;

  return (
    <div className={`w-full ${heightClass} rounded-3xl border border-[#D9D9D9] bg-[#F5F5F5] overflow-hidden`}>
      <GoogleMap
        defaultCenter={center}
        center={deliveryPoint ? center : undefined}
        defaultZoom={deliveryPoint ? 14 : 13}
        mapId="DEMO_MAP_ID"
        gestureHandling="greedy"
        disableDefaultUI={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        {STORE_LOCATIONS.map((loc) => (
          <StoreMarkerItem
            key={loc.id}
            loc={loc}
            isSelected={selectedId === loc.id}
            onSelect={setSelectedId}
            onClose={handleClose}
          />
        ))}

        {deliveryPoint && (
          <>
            <AdvancedMarker
              ref={deliveryMarkerRef}
              position={{ lat: deliveryPoint.lat, lng: deliveryPoint.lng }}
              onClick={() => setShowDeliveryInfo(true)}
            >
              <Pin background="#292929" borderColor="#0A0A0A" glyphColor="#FFFFFF" />
            </AdvancedMarker>
            {showDeliveryInfo && deliveryMarker && (
              <InfoWindow
                anchor={deliveryMarker}
                onCloseClick={() => setShowDeliveryInfo(false)}
              >
                <div className="p-1 max-w-[200px]">
                  <p className="text-xs font-semibold text-[#0A0A0A]">
                    Delivery Destination
                  </p>
                  <p className="mt-1 text-[11px] text-[#292929]">
                    {deliveryPoint.label}
                  </p>
                </div>
              </InfoWindow>
            )}
          </>
        )}
      </GoogleMap>
    </div>
  );
};
