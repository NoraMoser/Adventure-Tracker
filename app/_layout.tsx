// app/_layout.tsx - Complete version with all screens

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { ActivityProvider } from '../contexts/ActivityContext';
import { LocationProvider } from '../contexts/LocationContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { WishlistProvider } from '../contexts/WishlistContext';

export default function RootLayout() {
  return (
     <SettingsProvider>
    <LocationProvider>
      <ActivityProvider>
        <WishlistProvider>
          <SafeAreaProvider>
            <StatusBar style="auto" />
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
                  backgroundColor: '#f5f5f5',
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
                name="save-location" 
                options={{
                  title: 'Save Location',
                  headerStyle: {
                    backgroundColor: theme.colors.forest,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                  presentation: 'modal',
                  headerLeft: () => null,
                }}
              />
              
              <Stack.Screen 
                name="saved-spots" 
                options={{
                  title: 'Saved Spots',
                  headerStyle: {
                    backgroundColor: theme.colors.forest,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                }}
              />
              
              <Stack.Screen 
                name="edit-location" 
                options={{
                  title: 'Edit Location',
                  headerStyle: {
                    backgroundColor: theme.colors.forest,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                }}
              />
              
              <Stack.Screen 
                name="add-location" 
                options={{
                  title: 'Add Location',
                  headerStyle: {
                    backgroundColor: theme.colors.forest,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                  presentation: 'modal',
                }}
              />
              
              <Stack.Screen 
                name="track-activity" 
                options={{
                  title: 'Track Activity',
                  headerStyle: {
                    backgroundColor: theme.colors.forest,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                }}
              />
              
              <Stack.Screen 
                name="past-activities" 
                options={{
                  title: 'Past Activities',
                  headerStyle: {
                    backgroundColor: theme.colors.forest,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                }}
              />
              
              <Stack.Screen 
                name="add-activity" 
                options={{
                  title: 'Add Activity',
                  headerStyle: {
                    backgroundColor: theme.colors.forest,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                  presentation: 'modal',
                }}
              />
              
              <Stack.Screen 
                name="statistics" 
                options={{
                  title: 'Statistics',
                  headerStyle: {
                    backgroundColor: theme.colors.forest,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                }}
              />
              
              <Stack.Screen 
                name="wishlist" 
                options={{
                  title: 'Wishlist',
                  headerStyle: {
                    backgroundColor: theme.colors.forest,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                }}
              />
              
              <Stack.Screen 
                name="settings" 
                options={{
                  title: 'Settings',
                  headerStyle: {
                    backgroundColor: theme.colors.forest,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                }}
              />
              
              <Stack.Screen 
                name="spot-details" 
                options={{
                  title: 'Spot Details',
                  headerStyle: {
                    backgroundColor: theme.colors.forest,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                  presentation: 'card',
                }}
              />
              
              <Stack.Screen 
                name="camera" 
                options={{
                  title: 'Take Photo',
                  presentation: 'fullScreenModal',
                  headerShown: false,
                }}
              />
              
              <Stack.Screen 
                name="map" 
                options={{
                  title: 'Map View',
                  headerStyle: {
                    backgroundColor: theme.colors.forest,
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                  presentation: 'card',
                }}
              />
            </Stack>
          </SafeAreaProvider>
        </WishlistProvider>
      </ActivityProvider>
    </LocationProvider>
    </SettingsProvider>
  );
}