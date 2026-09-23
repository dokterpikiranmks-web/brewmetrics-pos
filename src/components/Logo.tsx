"use client";

import React from "react";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  subtitle?: string;
  className?: string;
  iconOnly?: boolean;
}

const SIZE_MAP = {
  xs: { iconSize: "size-6", textTitle: "text-sm", textSub: "text-[8px]" },
  sm: { iconSize: "size-8 sm:size-9", textTitle: "text-[15px] sm:text-base", textSub: "text-[9px]" },
  md: { iconSize: "size-10 sm:size-11", textTitle: "text-lg sm:text-xl", textSub: "text-[10px]" },
  lg: { iconSize: "size-12 sm:size-14", textTitle: "text-2xl sm:text-3xl", textSub: "text-xs" },
  xl: { iconSize: "size-16 sm:size-20", textTitle: "text-3xl sm:text-4xl", textSub: "text-sm" },
};

export function DoiTaIcon({ className = "size-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0`}
      aria-label="DOI TA Logo"
    >
      <defs>
        <linearGradient id="doiTaGold" x1="10" y1="10" x2="110" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="25%" stopColor="#F59E0B" />
          <stop offset="65%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>

        <linearGradient id="doiTaEmerald" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="50%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>

        <filter id="doiTaShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Outer Coin Rim */}
      <circle cx="60" cy="60" r="54" fill="#18181B" stroke="url(#doiTaGold)" strokeWidth="4.5" filter="url(#doiTaShadow)" />

      {/* Inner Emerald Dashed Ring */}
      <circle cx="60" cy="60" r="46" fill="#09090B" stroke="url(#doiTaEmerald)" strokeWidth="2" strokeDasharray="4 2" />

      {/* 4 Cardinal Coin Accent Nodes */}
      <circle cx="60" cy="18" r="1.8" fill="#F59E0B" />
      <circle cx="60" cy="102" r="1.8" fill="#F59E0B" />
      <circle cx="18" cy="60" r="1.8" fill="#F59E0B" />
      <circle cx="102" cy="60" r="1.8" fill="#F59E0B" />

      {/* Monogram 'D' Bold Spine */}
      <rect x="36" y="32" width="13" height="56" rx="4" fill="url(#doiTaGold)" />

      {/* Monogram 'D' Curve */}
      <path
        d="M47 32 H65 C78.5 32 89 42.5 89 60 C89 77.5 78.5 88 65 88 H47 V75 H63 C71 75 76 69 76 60 C76 51 71 45 63 45 H47 V32 Z"
        fill="url(#doiTaGold)"
      />

      {/* Digital POS Receipt Lines inside D */}
      <rect x="52" y="52" width="16" height="3" rx="1.5" fill="#10B981" />
      <rect x="52" y="58" width="22" height="3" rx="1.5" fill="#34D399" />
      <rect x="52" y="64" width="12" height="3" rx="1.5" fill="#10B981" />

      {/* Digital Receipt Cutting Edge Indicator */}
      <path
        d="M49 88 L52 83 L55 88 L58 83 L61 88"
        stroke="#F59E0B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({
  size = "md",
  showText = true,
  subtitle = "Smart POS & Management",
  className = "",
  iconOnly = false,
}: LogoProps) {
  const cfg = SIZE_MAP[size] || SIZE_MAP.md;

  if (iconOnly || !showText) {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <DoiTaIcon className={cfg.iconSize} />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 ${className}`}>
      <DoiTaIcon className={cfg.iconSize} />
      <div className="leading-none select-none">
        <div className="flex items-center gap-1">
          <span className={`font-display ${cfg.textTitle} font-extrabold tracking-tight text-cream uppercase`}>
            DOI TA
          </span>
          <span className="size-1.5 rounded-full bg-brand animate-pulse" />
        </div>
        {subtitle && (
          <p className={`${cfg.textSub} font-medium uppercase tracking-[0.2em] text-sand mt-0.5`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
