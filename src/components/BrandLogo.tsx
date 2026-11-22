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
        className={`inline-flex items-center justify-center shrink-0 overflow-hidden rounded-[12px] bg-white p-[3px] border border-white/90 shadow-[0_4px_14px_rgba(0,0,0,0.3)] ring-1 ring-black/15 ${className}`}
      >
        {!failed ? (
          <img
            src={BRAND_LOGO_URL}
            alt="PYTHOX WORLD Logo"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="h-full w-full object-contain object-center rounded-[9px] block"
          />
        ) : (
          <span className="font-editorial text-xs font-bold tracking-[0.12em] text-[#0A0A0A] whitespace-nowrap">
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
