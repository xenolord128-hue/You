import React, { useState } from 'react';
import { BRAND_LOGO_URL } from '../config/storeConfig';

interface BrandLogoProps {
  className?: string;
  surface?: 'light' | 'dark';
  rounded?: boolean;
  zoomOnly?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'h-10 sm:h-11',
  surface = 'light',
  rounded = true,
  zoomOnly = false,
}) => {
  const [failed, setFailed] = useState(false);

  if (zoomOnly) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 overflow-hidden rounded-[10px] ${className}`}
      >
        {!failed ? (
          <img
            src={BRAND_LOGO_URL}
            alt="PYTHOX WORLD Logo"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover object-center scale-[1.35] block"
          />
        ) : (
          <span className="font-editorial text-xs font-bold tracking-[0.12em] text-[#fbf9f5] whitespace-nowrap">
            PW
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden ${
        rounded ? 'rounded-[13px]' : ''
      } ${surface === 'dark' ? 'bg-white p-1 border border-[#D9D9D9]' : 'bg-white border border-[#D9D9D9] p-0.5'}`}
    >
      {!failed ? (
        <img
          src={BRAND_LOGO_URL}
          alt="PYTHOX WORLD Logo"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={`${className} w-auto object-contain block ${
            rounded ? 'rounded-[10px]' : ''
          }`}
        />
      ) : (
        <span className="font-editorial px-2 text-base font-bold tracking-[0.14em] text-[#0A0A0A] whitespace-nowrap">
          PYTHOX WORLD
        </span>
      )}
    </span>
  );
};
