import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface AppLogoProps {
  size?: number;
}

export default function AppLogo({ size = 48 }: AppLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Defs>
        <LinearGradient id="infinityGrad1" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#24389c" />
          <Stop offset="50%" stopColor="#3f51b5" />
          <Stop offset="100%" stopColor="#00897b" />
        </LinearGradient>
        <LinearGradient id="infinityGrad2" x1="48" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#3f51b5" />
          <Stop offset="100%" stopColor="#24389c" />
        </LinearGradient>
      </Defs>
      
      {/* Background soft shadow container */}
      <Path
        d="M16 8h16c4.4 0 8 3.6 8 8v16c0 4.4-3.6 8-8 8H16c-4.4 0-8-3.6-8-8V16c0-4.4 3.6-8 8-8z"
        fill="#ffffff"
      />

      {/* Intersecting infinity ribbon left loop */}
      <Path
        d="M17 18c-3.3 0-6 2.7-6 6s2.7 6 6 6c3.1 0 5.4-2.1 7-4.5 1.6 2.4 3.9 4.5 7 4.5 3.3 0 6-2.7 6-6s-2.7-6-6-6c-3.1 0-5.4 2.1-7 4.5-1.6-2.4-3.9-4.5-7-4.5z"
        stroke="url(#infinityGrad1)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Node overlap accent */}
      <Path
        d="M24 21.5c.8 1.2 1.6 2.5 2.5 3.5"
        stroke="url(#infinityGrad2)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </Svg>
  );
}
