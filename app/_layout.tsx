// app/_layout.tsx - Updated with Friends Provider
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { ActivityProvider } from '../contexts/ActivityContext';
import { FriendsProvider } from '../contexts/FriendsContext';
import { LocationProvider } from '../contexts/LocationContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { WishlistProvider } from '../contexts/WishlistContext';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Add any pre-loading tasks here (fonts, assets, etc.)
        // For now, just a small delay to show the splash
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // This tells the splash screen to hide immediately
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SettingsProvider>
        <LocationProvider>
          <ActivityProvider>
            <WishlistProvider>
              <FriendsProvider>
                <SafeAreaProvider>
                  <StatusBar style="light" backgroundColor={theme.colors.forest} />
                  <Stack
                    screenOptions={{
                      headerStyle: {
                        backgroundColor: theme.colors.forest,
                      },
                      headerTintColor: '#fff',
                      headerTitleStyle: {
                        fontWeight: 'bold',
                      },
                      contentStyle: {
                        backgroundColor: theme.colors.offWhite,
                      },
                    }}
                  >
                    <Stack.Screen 
                      name="index" 
                      options={{
                        title: 'Home',
                        headerShown: false,
                      }}
                    />
                    
                    <Stack.Screen 
                      name="splash" 
                      options={{
                        headerShown: false,
                      }}
                    />
                    
                    <Stack.Screen 
                      name="onboarding" 
                      options={{
                        headerShown: false,
                      }}
                    />
                    
                    <Stack.Screen 
                      name="save-location" 
                      options={{
                        title: 'Save Location',
                        presentation: 'modal',
                        headerLeft: () => null,
                      }}
                    />
                    
                    <Stack.Screen 
                      name="saved-spots" 
                      options={{
                        title: 'Saved Spots',
                      }}
                    />
                    
                    <Stack.Screen 
                      name="edit-location" 
                      options={{
                        title: 'Edit Location',
                      }}
                    />
                    
                    <Stack.Screen 
                      name="add-location" 
                      options={{
                        title: 'Add Location',
                        presentation: 'modal',
                      }}
                    />
                    
                    <Stack.Screen 
                      name="track-activity" 
                      options={{
                        title: 'Track Activity',
                      }}
                    />
                    
                    <Stack.Screen 
                      name="past-activities" 
                      options={{
                        title: 'Past Activities',
                      }}
                    />
                    
                    <Stack.Screen 
                      name="add-activity" 
                      options={{
                        title: 'Add Activity',
                        presentation: 'modal',
                      }}
                    />
                    
                    <Stack.Screen 
                      name="statistics" 
                      options={{
                        title: 'Statistics',
                      }}
                    />
                    
                    <Stack.Screen 
                      name="wishlist" 
                      options={{
                        title: 'Wishlist',
                      }}
                    />
                    
                    <Stack.Screen 
                      name="settings" 
                      options={{
                        title: 'Settings',
                      }}
                    />
                    
                    {/* New Friends Routes */}
                    <Stack.Screen 
                      name="friends-feed" 
                      options={{
                        title: 'Friends Feed',
                      }}
                    />
                    
                    <Stack.Screen 
                      name="friends" 
                      options={{
                        title: 'Friends',
                      }}
                    />
                    
                    <Stack.Screen 
                      name="friend-requests" 
                      options={{
                        title: 'Friend Requests',
                      }}
                    />
                    
                    <Stack.Screen 
                      name="friend-profile/[id]" 
                      options={{
                        title: 'Friend Profile',
                      }}
                    />
                  </Stack>
                </SafeAreaProvider>
              </FriendsProvider>
            </WishlistProvider>
          </ActivityProvider>
        </LocationProvider>
      </SettingsProvider>
    </View>
  );
}