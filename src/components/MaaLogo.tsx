import React from 'react';

interface MaaLogoProps {
  size?: number;
  className?: string;
}

/**
 * Refined Maa Durga-inspired lotus & sacred trishul-kalash vector emblem.
 * Scales crisply for sidebar headers, digital receipts, and print templates.
 */
export const MaaLogo: React.FC<MaaLogoProps> = ({ size = 40, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="MAA Emblem"
    >
      <circle cx="32" cy="32" r="30" fill="#0F2143" stroke="#C6922C" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="25.5" stroke="#EA580C" strokeWidth="0.9" strokeDasharray="2 2" />
      {/* Lotus Petals */}
      <path
        d="M32 45C24 41 20 35 20 29C24 30 28 33 32 39C36 33 40 30 44 29C44 35 40 41 32 45Z"
        fill="#EA580C"
        fillOpacity="0.88"
        stroke="#F6D37A"
        strokeWidth="1.2"
      />
      <path
        d="M32 45C26 44 17 41 14 35C19 34 25 36 32 45Z"
        fill="#C6922C"
        fillOpacity="0.85"
      />
      <path
        d="M32 45C38 44 47 41 50 35C45 34 39 36 32 45Z"
        fill="#C6922C"
        fillOpacity="0.85"
      />
      {/* Sacred Trishul & Third Eye Motif */}
      <path
        d="M32 13V42"
        stroke="#F6D37A"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M23 19C23 25 27 28 32 28C37 28 41 25 41 19"
        stroke="#F6D37A"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M32 11L34.5 16H29.5L32 11Z"
        fill="#F6D37A"
      />
      {/* Tilak / Bindu */}
      <circle cx="32" cy="22" r="2.2" fill="#EA580C" stroke="#F6D37A" strokeWidth="1" />
      {/* Base Kalash Curve */}
      <path
        d="M24 49H40"
        stroke="#F6D37A"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};
