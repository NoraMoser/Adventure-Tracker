import { Stack } from 'expo-router';
import React from 'react';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="save-location" options={{ title: 'Save Location' }} />
      <Stack.Screen name="track-ride" options={{ title: 'Track Bike Ride' }} />
      <Stack.Screen name="saved-spots" options={{ title: 'Saved Spots' }} />
      <Stack.Screen name="past-rides" options={{ title: 'Past Rides' }} />
      <Stack.Screen name="wishlist" options={{ title: 'Wishlist' }} />
    </Stack>
  );
}