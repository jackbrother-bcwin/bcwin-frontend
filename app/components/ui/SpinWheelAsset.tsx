"use client";

import React, { useMemo } from "react";

export interface SpinWheelAssetProps {
  /** Size in pixels (width and height). Default 84 */
  size?: number;
  /** Number of radial slices. Default 8 */
  sliceCount?: number;
  /** Custom colors for slices (alternating if fewer than sliceCount) */
  sliceColors?: string[];
  /** Text in center button. Default "GO" */
  centerText?: string;
  /** Custom gradient/color for center button */
  centerBgColor?: string;
  /** Color of center text. Default "#FFFFFF" */
  centerTextColor?: string;
  /** Number of golden studs on the outer rim. Default 10 */
  studCount?: number;
  /** Show top diamond pointer badge. Default true */
  showPointer?: boolean;
  /** Rotation angle in degrees (for spin animation) */
  rotation?: number;
  /** Continuous slow rotation animation for idle state */
  isSpinning?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Style overrides */
  style?: React.CSSProperties;
  /** Click handler */
  onClick?: () => void;
}

const DEFAULT_COLORS = [
  "#FFF176", // Bright Light Yellow
  "#FFB74D", // Warm Amber/Orange
  "#FFEE58", // Sunny Yellow
  "#FFA726", // Deep Golden Orange
  "#FFF59D", // Soft Yellow
  "#FF9800", // Bright Orange
  "#FFFF8D", // High Glow Yellow
  "#FB8C00", // Rich Amber
];

/**
 * High-fidelity 3D Golden Spin Wheel Asset.
 * Scalable SVG asset designed for bottom bar embedding & spin wheel components.
 */
export default function SpinWheelAsset({
  size = 84,
  sliceCount = 8,
  sliceColors = DEFAULT_COLORS,
  centerText = "GO",
  centerTextColor = "#FFFFFF",
  studCount = 10,
  showPointer = true,
  rotation = 0,
  isSpinning = false,
  className = "",
  style,
  onClick,
}: SpinWheelAssetProps) {
  // Generate radial slices SVG paths
  const slices = useMemo(() => {
    const radius = 79;
    const center = 100;
    const angleStep = 360 / sliceCount;

    return Array.from({ length: sliceCount }).map((_, i) => {
      const startAngle = (i * angleStep - 90) * (Math.PI / 180);
      const endAngle = ((i + 1) * angleStep - 90) * (Math.PI / 180);

      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);

      const largeArcFlag = angleStep > 180 ? 1 : 0;
      const pathData = `M ${center} ${center} L ${x1.toFixed(2)} ${y1.toFixed(
        2
      )} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2.toFixed(
        2
      )} ${y2.toFixed(2)} Z`;

      const color = sliceColors[i % sliceColors.length];

      return {
        id: i,
        d: pathData,
        fill: color,
      };
    });
  }, [sliceCount, sliceColors]);

  // Generate outer rim 3D golden studs (rivets)
  const studs = useMemo(() => {
    const studRadius = 88.5;
    const center = 100;
    const angleStep = 360 / studCount;

    return Array.from({ length: studCount }).map((_, i) => {
      const angle = (i * angleStep - 90) * (Math.PI / 180);
      const x = center + studRadius * Math.cos(angle);
      const y = center + studRadius * Math.sin(angle);
      return { id: i, x: x.toFixed(2), y: y.toFixed(2) };
    });
  }, [studCount]);

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{
        width: size,
        height: size,
        ...style,
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full overflow-visible drop-shadow-lg"
        style={{
          filter: "drop-shadow(0px 4px 12px rgba(0, 0, 0, 0.45))",
        }}
        aria-hidden="true"
      >
        <defs>
          {/* Outer Metallic Gold Rim Gradient */}
          <linearGradient id="swGoldRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF4AD" />
            <stop offset="25%" stopColor="#FFC82E" />
            <stop offset="50%" stopColor="#E69500" />
            <stop offset="75%" stopColor="#FFAE1A" />
            <stop offset="100%" stopColor="#FFE57F" />
          </linearGradient>

          {/* Inner Gold Rim Ring */}
          <linearGradient id="swGoldInnerRim" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFECB3" />
            <stop offset="50%" stopColor="#FFC107" />
            <stop offset="100%" stopColor="#B26A00" />
          </linearGradient>

          {/* 3D Stud (Sphere) Radial Gradient */}
          <radialGradient
            id="swStudGrad"
            cx="35%"
            cy="35%"
            r="65%"
            fx="30%"
            fy="30%"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#FFF176" />
            <stop offset="70%" stopColor="#FFB300" />
            <stop offset="100%" stopColor="#8D5100" />
          </radialGradient>

          {/* Center Button Ring Bevel */}
          <radialGradient id="swCenterRing" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFDE7" />
            <stop offset="40%" stopColor="#FFE082" />
            <stop offset="80%" stopColor="#FFB300" />
            <stop offset="100%" stopColor="#9C5D00" />
          </radialGradient>

          {/* Center Red/Orange Glossy Button */}
          <radialGradient id="swCenterBtn" cx="38%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#FF7A50" />
            <stop offset="45%" stopColor="#FF3D00" />
            <stop offset="85%" stopColor="#D50000" />
            <stop offset="100%" stopColor="#8E0000" />
          </radialGradient>

          {/* Button Gloss Overlay */}
          <linearGradient id="swGlossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Top Diamond Pointer Gradient */}
          <linearGradient id="swPointerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF9C4" />
            <stop offset="50%" stopColor="#FFC107" />
            <stop offset="100%" stopColor="#E65100" />
          </linearGradient>

          {/* Stud Drop Shadow */}
          <filter id="swStudShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* 1. OUTER GOLDEN METALLIC RIM */}
        <circle
          cx="100"
          cy="100"
          r="96"
          fill="url(#swGoldRim)"
          stroke="#945800"
          strokeWidth="1.2"
        />

        {/* Inner Gold Shadow Ring */}
        <circle
          cx="100"
          cy="100"
          r="80.5"
          fill="none"
          stroke="url(#swGoldInnerRim)"
          strokeWidth="3.5"
        />

        {/* 2. ROTATING SLICES DISK */}
        <g
          style={{
            transformOrigin: "100px 100px",
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning
              ? "none"
              : "transform 0.4s cubic-bezier(0.15, 0.85, 0.35, 1.2)",
          }}
          className={isSpinning ? "animate-spin-slow" : ""}
        >
          {slices.map((slice) => (
            <path key={slice.id} d={slice.d} fill={slice.fill} />
          ))}

          {/* Slice Dividing Lines */}
          {slices.map((slice) => {
            const angle =
              (slice.id * (360 / sliceCount) - 90) * (Math.PI / 180);
            const x2 = 100 + 79 * Math.cos(angle);
            const y2 = 100 + 79 * Math.sin(angle);
            return (
              <line
                key={`line-${slice.id}`}
                x1="100"
                y1="100"
                x2={x2.toFixed(2)}
                y2={y2.toFixed(2)}
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="1.2"
              />
            );
          })}
        </g>

        {/* Outer Rim Inner Shadow overlay */}
        <circle
          cx="100"
          cy="100"
          r="79"
          fill="none"
          stroke="rgba(0, 0, 0, 0.18)"
          strokeWidth="2"
        />

        {/* 3. GOLDEN STUDS / RIVETS */}
        {studs.map((stud) => (
          <circle
            key={stud.id}
            cx={stud.x}
            cy={stud.y}
            r="4.2"
            fill="url(#swStudGrad)"
            stroke="#8E5600"
            strokeWidth="0.6"
            filter="url(#swStudShadow)"
          />
        ))}

        {/* 4. TOP DIAMOND POINTER / ACCENT */}
        {showPointer && (
          <g transform="translate(0, -2)">
            {/* Pointer Shadow */}
            <polygon
              points="100,2 109,14 100,21 91,14"
              fill="rgba(0,0,0,0.3)"
            />
            {/* Pointer Body */}
            <polygon
              points="100,1 108,12 100,19 92,12"
              fill="url(#swPointerGrad)"
              stroke="#FFFFFF"
              strokeWidth="0.9"
            />
            {/* Center Gem Dot */}
            <circle cx="100" cy="11" r="2.2" fill="#FFFFFF" />
          </g>
        )}

        {/* 5. CENTER GLOSSY "GO" BUTTON */}
        <g>
          {/* Outer Bevel Ring */}
          <circle
            cx="100"
            cy="100"
            r="34"
            fill="url(#swCenterRing)"
            stroke="#7C4800"
            strokeWidth="1"
          />
          {/* White Accent Border Ring */}
          <circle
            cx="100"
            cy="100"
            r="29"
            fill="#FFFFFF"
            stroke="#FFB300"
            strokeWidth="0.8"
          />
          {/* Inner Glossy Red Circle */}
          <circle cx="100" cy="100" r="26" fill="url(#swCenterBtn)" />
          {/* Top Gloss Highlight */}
          <path
            d="M 75 97 A 25 25 0 0 1 125 97 A 26 13 0 0 0 75 97 Z"
            fill="url(#swGlossGrad)"
          />
          {/* "GO" Text */}
          <text
            x="100"
            y="106"
            textAnchor="middle"
            fill={centerTextColor}
            fontSize="17"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            style={{
              letterSpacing: "0.5px",
              filter: "drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.6))",
            }}
          >
            {centerText}
          </text>
        </g>
      </svg>
    </div>
  );
}
