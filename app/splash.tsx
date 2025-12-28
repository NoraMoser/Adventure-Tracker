import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExplorableIcon, ExplorableLogo } from '../components/Logo';
import { theme } from '../constants/theme';

// Keep the splash screen visible while we load
ExpoSplashScreen.preventAutoHideAsync();

export default function CustomSplashScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animate logo in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 10,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    // Add a subtle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Check onboarding status after animation
    setTimeout(() => {
      checkOnboardingAndNavigate();
    }, 2000);
  }, []);

  const checkOnboardingAndNavigate = async () => {
    try {
      // Hide the native splash screen
      await ExpoSplashScreen.hideAsync();
      
      const onboardingComplete = await AsyncStorage.getItem('onboardingComplete');
      
      // Fade out animation before navigating
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        if (onboardingComplete === 'true') {
          router.replace('/');
        } else {
          router.replace('/onboarding');
        }
      });
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
        }} 
      />
      
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { scale: pulseAnim }
            ],
          },
        ]}
      >
        <ExplorableIcon size={120} />
        
        <View style={styles.logoContainer}>
          <ExplorableLogo width={280} showTagline={true} />
        </View>
        
        <View style={styles.loadingContainer}>
          <View style={styles.loadingBar}>
            <Animated.View 
              style={[
                styles.loadingProgress,
                {
                  width: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.loadingText}>Loading your adventures...</Text>
        </View>
      </Animated.View>
      
      <Text style={styles.version}>Version 1.0.0</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.forest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    marginTop: 30,
    marginBottom: 50,
  },
  loadingContainer: {
    alignItems: 'center',
    width: 200,
  },
  loadingBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingProgress: {
    height: '100%',
    backgroundColor: theme.colors.white,
    borderRadius: 2,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: theme.colors.white,
    opacity: 0.8,
  },
  version: {
    position: 'absolute',
    bottom: 30,
    fontSize: 12,
    color: theme.colors.white,
    opacity: 0.6,
  },
});