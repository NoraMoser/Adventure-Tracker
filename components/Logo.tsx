// components/Logo.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

interface LogoProps {
  width?: number;
  height?: number;
  showText?: boolean;
  showTagline?: boolean;
  variant?: 'default' | 'dark' | 'white';
}

export const ExplorableLogo: React.FC<LogoProps> = ({ 
  width = 300, 
  height = 80,
  showText = true,
  showTagline = false,
  variant = 'default'
}) => {
  const aspectRatio = 300 / 80;
  const actualWidth = width;
  const actualHeight = width / aspectRatio;
  
  const forestGreen = '#2d5a3d';
  const burntOrange = '#cc5500';
  const offWhite = '#faf8f5';
  const fogGray = '#d3ddd6';
  
  // Adjust colors based on variant
  const textColor = variant === 'dark' ? burntOrange : burntOrange;
  const treeColor = variant === 'dark' ? forestGreen : forestGreen;
  const bgColor = variant === 'dark' ? forestGreen : 'transparent';
  const crossbarColor = offWhite;

  if (!showText) {
    // Icon only version
    return (
      <Svg width={height} height={height} viewBox="0 0 80 80">
        <Defs>
          <RadialGradient id="iconBg">
            <Stop offset="0%" stopColor={offWhite} />
            <Stop offset="100%" stopColor="#f0ebe5" />
          </RadialGradient>
        </Defs>
        
        {/* Background */}
        <Rect x="5" y="5" width="70" height="70" rx="15" fill="url(#iconBg)" />
        
        {/* Centered tree */}
        <G transform="translate(40, 40)">
          {/* More organic tree shape - no Christmas tree! */}
          <Path 
            d="M 0 -18 L -3 -11 L -2.5 -11 L -4.5 -7 L -3.5 -7 L -5.5 -3 L -4.5 -3 L -6.5 1 L -5.5 1 L -7.5 5 L -6.5 5 L -9 10 L 9 10 L 6.5 5 L 7.5 5 L 5.5 1 L 6.5 1 L 4.5 -3 L 5.5 -3 L 3.5 -7 L 4.5 -7 L 2.5 -11 L 3 -11 L 0 -18 Z"
            fill={treeColor}
            stroke={burntOrange}
            strokeWidth="1"
          />
          
          {/* Trunk */}
          <Rect x="-1.5" y="10" width="3" height="5" fill={treeColor} stroke={burntOrange} strokeWidth="0.5" />
          
          {/* Crossbar - white only, no orange */}
          <Rect x="-6" y="3" width="12" height="1.5" fill={crossbarColor} />
        </G>
      </Svg>
    );
  }

  return (
    <Svg width={actualWidth} height={actualHeight} viewBox="0 0 300 80">
      {/* Subtle fog effect */}
      <Ellipse cx="150" cy="15" rx="100" ry="8" fill={fogGray} opacity="0.2" />
      
      {/* "explor" with lowercase 'e' */}
      <SvgText
        x="20"
        y="58"
        fontSize="42"
        fontWeight="400"
        fill={textColor}
        fontFamily="Playfair Display, Georgia, serif"
      >
        explor
      </SvgText>
      
      {/* Pine Tree as 'A' */}
      <G transform="translate(145, 18)">
        {/* Layered tree */}
        <Path 
          d="M 15 5 L 10 16 L 12 16 L 8 24 L 11 24 L 6 32 L 10 32 L 4 40 L 26 40 L 20 32 L 24 32 L 19 24 L 22 24 L 18 16 L 20 16 L 15 5 Z"
          fill={treeColor}
          stroke={burntOrange}
          strokeWidth="1.5"
        />
        
        {/* Tree trunk */}
        <Rect x="13" y="40" width="4" height="7" fill={treeColor} stroke={burntOrange} strokeWidth="1" />
        
        {/* Crossbar - white only, no orange stroke */}
        <Rect x="8" y="28" width="14" height="2.5" fill={crossbarColor} />
      </G>
      
      {/* "ble" */}
      <SvgText
        x="180"
        y="58"
        fontSize="42"
        fontWeight="400"
        fill={textColor}
        fontFamily="Playfair Display, Georgia, serif"
      >
        ble
      </SvgText>
      
      {/* Optional tagline */}
      {showTagline && (
        <SvgText
          x="150"
          y="72"
          fontSize="9"
          fontWeight="300"
          fill={forestGreen}
          textAnchor="middle"
          letterSpacing="3"
          fontFamily="Helvetica, Arial, sans-serif"
        >
          TRACK • EXPLORE • SHARE
        </SvgText>
      )}
    </Svg>
  );
};

// App Icon Component
export const ExplorableIcon: React.FC<{ size?: number; color?: string }> = ({ 
  size = 60,
  color // add this but don't use it, or use it if you want to customize colors
}) => {
  const forestGreen = '#2d5a3d';
  const burntOrange = '#cc5500';
  const offWhite = '#faf8f5';
  
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs>
        <RadialGradient id="iconBgGradient">
          <Stop offset="0%" stopColor={offWhite} />
          <Stop offset="100%" stopColor="#f0ebe5" />
        </RadialGradient>
      </Defs>
      
      {/* Rounded square background */}
      <Rect x="5" y="5" width="70" height="70" rx="15" fill="url(#iconBgGradient)" />
      
      {/* Tree icon */}
      <G transform="translate(40, 40)">
        {/* Organic pine tree shape */}
        <Path 
          d="M 0 -18 L -3 -11 L -2.5 -11 L -4.5 -7 L -3.5 -7 L -5.5 -3 L -4.5 -3 L -6.5 1 L -5.5 1 L -7.5 5 L -6.5 5 L -9 10 L 9 10 L 6.5 5 L 7.5 5 L 5.5 1 L 6.5 1 L 4.5 -3 L 5.5 -3 L 3.5 -7 L 4.5 -7 L 2.5 -11 L 3 -11 L 0 -18 Z"
          fill={forestGreen}
          stroke={burntOrange}
          strokeWidth="1"
        />
        
        {/* Trunk */}
        <Rect x="-1.5" y="10" width="3" height="5" fill={forestGreen} stroke={burntOrange} strokeWidth="0.5" />
        
        {/* Crossbar - white only */}
        <Rect x="-6" y="3" width="12" height="1.5" fill={offWhite} />
      </G>
    </Svg>
  );
};

// Header Logo Component (smaller for navigation)
export const HeaderLogo: React.FC<{ width?: number }> = ({ width = 140 }) => {
  return <ExplorableLogo width={width} showText={true} showTagline={false} />;
};

// Usage Examples
export const LogoShowcase: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Main logo */}
      <View style={styles.logoContainer}>
        <ExplorableLogo width={280} showTagline={true} />
      </View>
      
      {/* Header version */}
      <View style={styles.logoContainer}>
        <HeaderLogo />
      </View>
      
      {/* Icon only */}
      <View style={styles.logoContainer}>
        <ExplorableIcon size={80} />
      </View>
      
      {/* Small icon */}
      <View style={styles.logoContainer}>
        <ExplorableIcon size={40} />
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
});

export default ExplorableLogo;