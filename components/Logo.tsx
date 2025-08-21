// components/Logo.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path, Polygon, Text as SvgText } from 'react-native-svg';

interface LogoProps {
  width?: number;
  height?: number;
  showText?: boolean;
  showTagline?: boolean;
  variant?: 'default' | 'dark' | 'white';
}

export const ExplorableLogo: React.FC<LogoProps> = ({ 
  width = 200, 
  height = 50,
  showText = true,
  showTagline = false,
  variant = 'default'
}) => {
  const aspectRatio = 200 / 50;
  const actualWidth = width;
  const actualHeight = width / aspectRatio;
  
  const navy = '#1e3a5f';
  const forestGreen = '#2d5a3d';
  const burntOrange = '#cc5500';
  const offWhite = '#faf8f5';
  
  // Adjust colors based on variant
  const textColor = variant === 'white' ? offWhite : navy;
  const treeColor = variant === 'white' ? offWhite : forestGreen;
  const outlineColor = variant === 'white' ? offWhite : burntOrange;

  if (!showText) {
    // Icon only version - just the geometric tree
    return (
      <Svg width={height} height={height} viewBox="0 0 50 50">
        {/* Background circle for icon */}
        {variant !== 'white' && (
          <Path
            d="M 25 5 A 20 20 0 1 1 25 45 A 20 20 0 1 1 25 5"
            fill={offWhite}
          />
        )}
        
        {/* Geometric tree triangle */}
        <Polygon
          points="25,12 35,33 15,33"
          fill={treeColor}
          stroke={outlineColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        
        {/* Optional small trunk */}
        <Path
          d="M 22 33 L 22 38 L 28 38 L 28 33"
          fill={navy}
        />
      </Svg>
    );
  }

  return (
    <Svg width={actualWidth} height={actualHeight} viewBox="0 0 200 50">
      {/* "explor" text */}
      <SvgText
        x="13"
        y="35"
        fontSize="32"
        fontWeight="500"
        fill={textColor}
        fontFamily="System, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >
        explor
      </SvgText>
      
      {/* Geometric Pine Tree as 'A' - properly positioned after "explor" */}
      <G transform="translate(103, 8)">
        {/* Main triangle */}
        <Polygon
          points="12,0 24,28 0,28"
          fill={forestGreen}
          stroke={burntOrange}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        
        {/* Small trunk at bottom */}
        <Path
          d="M 9 28 L 9 32 L 15 32 L 15 28"
          fill={navy}
        />
      </G>
      
      {/* "ble" text - positioned after the tree */}
      <SvgText
        x="130"
        y="35"
        fontSize="32"
        fontWeight="500"
        fill={textColor}
        fontFamily="System, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >
        ble
      </SvgText>
      
      {/* Optional tagline */}
      {showTagline && (
        <SvgText
          x="100"
          y="47"
          fontSize="8"
          fontWeight="300"
          fill={textColor}
          textAnchor="middle"
          letterSpacing="2"
          opacity="0.7"
          fontFamily="System, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        >
          TRACK • EXPLORE • SHARE
        </SvgText>
      )}
    </Svg>
  );
};

// App Icon Component - Geometric tree only
export const ExplorableIcon: React.FC<{ size?: number; color?: string }> = ({ 
  size = 60,
  color
}) => {
  const forestGreen = color || '#2d5a3d';
  const burntOrange = '#cc5500';
  const navy = '#1e3a5f';
  const offWhite = '#faf8f5';
  
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Rounded square background */}
      <Path
        d="M 15 5 L 45 5 Q 55 5 55 15 L 55 45 Q 55 55 45 55 L 15 55 Q 5 55 5 45 L 5 15 Q 5 5 15 5"
        fill={offWhite}
      />
      
      {/* Geometric tree triangle - centered */}
      <Polygon
        points="30,15 42,40 18,40"
        fill={forestGreen}
        stroke={burntOrange}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      
      {/* Small trunk */}
      <Path
        d="M 27 40 L 27 45 L 33 45 L 33 40"
        fill={navy}
      />
    </Svg>
  );
};

// Header Logo Component (smaller for navigation)
export const HeaderLogo: React.FC<{ width?: number }> = ({ width = 140 }) => {
  return <ExplorableLogo width={width} showText={true} showTagline={false} />;
};

// Large Logo with Tagline (for splash/onboarding)
export const SplashLogo: React.FC<{ width?: number }> = ({ width = 280 }) => {
  return <ExplorableLogo width={width} showText={true} showTagline={true} />;
};

// Usage Examples/Showcase Component
export const LogoShowcase: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Main logo */}
      <View style={styles.logoContainer}>
        <ExplorableLogo width={240} />
      </View>
      
      {/* Logo with tagline */}
      <View style={styles.logoContainer}>
        <SplashLogo width={280} />
      </View>
      
      {/* Header version */}
      <View style={styles.logoContainer}>
        <HeaderLogo width={160} />
      </View>
      
      {/* Icon only */}
      <View style={styles.logoContainer}>
        <ExplorableIcon size={80} />
      </View>
      
      {/* Small icon */}
      <View style={styles.logoContainer}>
        <ExplorableIcon size={40} />
      </View>
      
      {/* White variant for dark backgrounds */}
      <View style={[styles.logoContainer, styles.darkBg]}>
        <ExplorableLogo width={200} variant="white" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#faf8f5',
  },
  logoContainer: {
    marginVertical: 20,
    padding: 20,
    alignItems: 'center',
  },
  darkBg: {
    backgroundColor: '#1e3a5f',
    width: '100%',
    borderRadius: 12,
  },
});

export default ExplorableLogo;