import React from 'react';

interface DayledgeIconProps {
  className?: string;
  size?: number;
}

export function DayledgeIcon({ className = '', size = 32 }: DayledgeIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Main Container Stroke */}
      <rect 
        x="12" 
        y="12" 
        width="76" 
        height="76" 
        rx="22" 
        stroke="currentColor" 
        strokeWidth="9" 
        className="text-neutral-900 dark:text-white"
      />
      
      {/* Bookmark Ribbon on top-left */}
      <path 
        d="M 25 12 V 36 L 33 29 L 41 36 V 12 Z" 
        fill="#26BBA3" 
      />
      
      {/* Bar Chart Columns */}
      <rect x="27" y="52" width="10" height="18" rx="4" fill="#26BBA3" />
      <rect x="42" y="42" width="10" height="28" rx="4" fill="#26BBA3" />
      <rect x="57" y="32" width="10" height="38" rx="4" fill="#26BBA3" />

      {/* Smooth Dark Wave Fill at bottom */}
      <path 
        d="M 12 66 C 25 66 45 84 88 56 V 66 C 88 78 78 88 66 88 H 34 C 22 88 12 78 12 66 Z" 
        fill="currentColor"
        className="text-neutral-900 dark:text-white" 
      />
    </svg>
  );
}

interface DayledgeLogoProps {
  className?: string;
  iconSize?: number;
  showWordmark?: boolean;
  textClassName?: string;
}

export function DayledgeLogo({ 
  className = '', 
  iconSize = 32, 
  showWordmark = true,
  textClassName = 'text-xl font-extrabold tracking-tight'
}: DayledgeLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <DayledgeIcon size={iconSize} />
      {showWordmark && (
        <div className={`relative flex items-center ${textClassName}`}>
          <span className="text-neutral-900 dark:text-white font-sans tracking-tight">
            Dayled<span className="relative">g<span className="absolute -top-1 right-0 w-2 h-2 rounded-full bg-[#26BBA3]" /></span>e
          </span>
        </div>
      )}
    </div>
  );
}
