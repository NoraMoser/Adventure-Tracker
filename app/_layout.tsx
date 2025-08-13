import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocationProvider } from '../contexts/LocationContext';

export default function RootLayout() {
  return (
    <LocationProvider>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#007AFF',
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
              presentation: 'modal',
              headerLeft: () => null, // Removes back button for modal
            }}
          />
          <Stack.Screen 
            name="saved-spots" 
            options={{
              title: 'Saved Spots',
            }}
          />
          <Stack.Screen 
            name="spot-details" 
            options={{
              title: 'Spot Details',
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
              presentation: 'card',
            }}
          />
          <Stack.Screen 
            name="settings" 
            options={{
              title: 'Settings',
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </LocationProvider>
  );
}