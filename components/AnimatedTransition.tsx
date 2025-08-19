import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface AnimatedTransitionProps {
  children: React.ReactNode;
  style?: ViewStyle;
  type?: 'fade' | 'slide' | 'scale';
  duration?: number;
  delay?: number;
}

export const AnimatedTransition: React.FC<AnimatedTransitionProps> = ({
  children,
  style,
  type = 'fade',
  duration = 300,
  delay = 0,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  const getAnimatedStyle = () => {
    switch (type) {
      case 'slide':
        return {
          opacity: animatedValue,
          transform: [
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        };
      case 'scale':
        return {
          opacity: animatedValue,
          transform: [
            {
              scale: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
        };
      case 'fade':
      default:
        return {
          opacity: animatedValue,
        };
    }
  };

  return (
    <Animated.View style={[style, getAnimatedStyle()]}>
      {children}
    </Animated.View>
  );
};