// scripts/generateAppIcon.tsx
// Run this to generate your app icons
// You'll need to install: npm install react-native-svg

import React from 'react';
import Svg, { Path, Polygon, Rect } from 'react-native-svg';

// Icon Component - Your geometric tree
const ExplorableAppIcon = ({ size = 1024, withBackground = true }) => {
  const forestGreen = '#2d5a3d';
  const burntOrange = '#cc5500';
  const navy = '#1e3a5f';
  const offWhite = '#faf8f5';
  
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      {/* Background - for regular icon */}
      {withBackground && (
        <Rect
          x="0"
          y="0"
          width="1024"
          height="1024"
          fill={forestGreen}
        />
      )}
      
      {/* Geometric tree triangle - centered and sized for icon */}
      <Polygon
        points="512,280 720,680 304,680"
        fill={withBackground ? offWhite : forestGreen}
        stroke={burntOrange}
        strokeWidth="24"
        strokeLinejoin="round"
      />
      
      {/* Trunk */}
      <Path
        d="M 460 680 L 460 780 L 564 780 L 564 680"
        fill={navy}
      />
    </Svg>
  );
};

// Adaptive Icon for Android (foreground only)
const ExplorableAdaptiveIcon = ({ size = 1024 }) => {
  const forestGreen = '#2d5a3d';
  const burntOrange = '#cc5500';
  const navy = '#1e3a5f';
  
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      {/* No background - Android will add it */}
      {/* Tree is slightly smaller for adaptive icon safe zone */}
      <Polygon
        points="512,340 680,620 344,620"
        fill={forestGreen}
        stroke={burntOrange}
        strokeWidth="20"
        strokeLinejoin="round"
      />
      
      {/* Trunk */}
      <Path
        d="M 470 620 L 470 700 L 554 700 L 554 620"
        fill={navy}
      />
    </Svg>
  );
};

// Export the SVG code for manual use
console.log('=== App Icon SVG (1024x1024) ===');
console.log(`
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <!-- Forest Green Background -->
  <rect x="0" y="0" width="1024" height="1024" fill="#2d5a3d"/>
  
  <!-- White Tree with Burnt Orange Outline -->
  <polygon 
    points="512,280 720,680 304,680" 
    fill="#faf8f5" 
    stroke="#cc5500" 
    stroke-width="24" 
    stroke-linejoin="round"
  />
  
  <!-- Navy Trunk -->
  <path 
    d="M 460 680 L 460 780 L 564 780 L 564 680" 
    fill="#1e3a5f"
  />
</svg>
`);

console.log('\n=== Adaptive Icon SVG (1024x1024) - Foreground Only ===');
console.log(`
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <!-- No background - transparent -->
  
  <!-- Forest Green Tree with Burnt Orange Outline -->
  <polygon 
    points="512,340 680,620 344,620" 
    fill="#2d5a3d" 
    stroke="#cc5500" 
    stroke-width="20" 
    stroke-linejoin="round"
  />
  
  <!-- Navy Trunk -->
  <path 
    d="M 470 620 L 470 700 L 554 700 L 554 620" 
    fill="#1e3a5f"
  />
</svg>
`);

export { ExplorableAdaptiveIcon, ExplorableAppIcon };
