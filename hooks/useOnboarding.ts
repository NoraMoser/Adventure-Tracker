import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

export const useOnboarding = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const onboardingComplete = await AsyncStorage.getItem('onboardingComplete');
      
      if (onboardingComplete !== 'true') {
        setNeedsOnboarding(true);
        // Navigate to onboarding
        router.replace('/onboarding');
      } else {
        setNeedsOnboarding(false);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // If there's an error, assume onboarding is not needed
      setNeedsOnboarding(false);
    } finally {
      setIsLoading(false);
    }
  };

  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem('onboardingComplete');
      await AsyncStorage.removeItem('userName');
      router.replace('/onboarding');
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  };

  return {
    isLoading,
    needsOnboarding,
    resetOnboarding,
  };
};