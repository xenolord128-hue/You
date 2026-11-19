import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';

export interface SelectedAddressResult {
  formattedAddress: string;
  city: string;
  area: string;
  postalCode: string;
  location?: { lat: number; lng: number };
}

interface PlaceAddressComponent {
  types: string[];
  longText?: string;
}

interface PlaceInstance {
  formattedAddress?: string;
  addressComponents?: PlaceAddressComponent[];
  location?: { lat: () => number; lng: () => number };
  fetchFields: (opts: { fields: string[] }) => Promise<void>;
}

interface PlaceSuggestion {
  placePrediction?: {
    text: { text: string };
    toPlace: () => PlaceInstance;
  };
}

interface DhakaAddressAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSelectAddress: (result: SelectedAddressResult) => void;
  placeholder?: string;
}

export const DhakaAddressAutocomplete: React.FC<DhakaAddressAutocompleteProps> = ({
  value,
  onChange,
  onSelectAddress,
  placeholder = 'Search street, road, or neighborhood in Bangladesh...',
}) => {
  const placesLib = useMapsLibrary('places') as
    | {
        AutocompleteSessionToken: new () => unknown;
        AutocompleteSuggestion: {
          fetchAutocompleteSuggestions: (req: {
            input: string;
            sessionToken: unknown;
            includedRegionCodes: string[];
          }) => Promise<{ suggestions?: PlaceSuggestion[] }>;
        };
      }
    | null;
  const sessionTokenRef = useRef<unknown>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!placesLib || !value || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    const timer = setTimeout(() => {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: value,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ['bd'],
      })
        .then((res) => {
          const list = res.suggestions || [];
          setSuggestions(list);
          setIsOpen(list.length > 0);
        })
        .catch((err: unknown) => {
          console.error('Autocomplete error:', err);
          setSuggestions([]);
        });
    }, 220);

    return () => clearTimeout(timer);
  }, [placesLib, value]);

  const handleSelect = useCallback(
    async (suggestion: PlaceSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: [
            'formattedAddress',
            'addressComponents',
            'location',
            'displayName',
          ],
        });

        let city = 'Dhaka';
        let area = '';
        let postalCode = '';

        const components = place.addressComponents || [];
        for (const comp of components) {
          if (
            comp.types.includes('locality') ||
            comp.types.includes('administrative_area_level_2')
          ) {
            city = comp.longText || city;
          }
          if (
            comp.types.includes('sublocality_level_1') ||
            comp.types.includes('sublocality') ||
            comp.types.includes('neighborhood')
          ) {
            area = comp.longText || area;
          }
          if (comp.types.includes('postal_code')) {
            postalCode = comp.longText || postalCode;
          }
        }

        const formatted =
          place.formattedAddress ||
          suggestion.placePrediction.text.text ||
          value;

        onChange(formatted);
        onSelectAddress({
          formattedAddress: formatted,
          city,
          area: area || city,
          postalCode: postalCode || '1212',
          location: place.location
            ? { lat: place.location.lat(), lng: place.location.lng() }
            : undefined,
        });

        sessionTokenRef.current = null;
        setSuggestions([]);
        setIsOpen(false);
      } catch (err: unknown) {
        console.error('Place fetchFields error:', err);
      }
    },
    [placesLib, onChange, onSelectAddress, value]
  );

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#808080]" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[#D9D9D9] bg-white pl-9 pr-3 py-2.5 text-sm text-[#0A0A0A] placeholder:text-[#808080] focus:border-[#0A0A0A] focus:outline-none"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-[#D9D9D9] bg-white shadow-lg">
          {suggestions.map((s, idx) => (
            <li key={idx}>
              <button
                type="button"
                onClick={() => void handleSelect(s)}
                className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-xs text-[#0A0A0A] hover:bg-[#EEEEEE] border-b border-[#D9D9D9] last:border-b-0"
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#808080]" />
                <span>{s.placePrediction?.text.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
