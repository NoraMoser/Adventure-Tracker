import { Stack } from 'expo-router';
import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ActionButtons from '../components/ActionButtons';
import type { MapRef } from '../components/Map';
import Map from '../components/Map';
import { useLocation } from '../hooks/useLocation';

export default function SaveLocationScreen() {
  const { location, savedSpots, getLocation, saveCurrentLocation } = useLocation();
  const mapRef = useRef<MapRef>(null);

  const handleGetLocation = async () => {
    const currentLocation = await getLocation();
    if (currentLocation && mapRef.current) {
      mapRef.current.setLocation(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude
      );
    }
  };

  const handleSaveLocation = () => {
    const savedSpot = saveCurrentLocation();
    if (savedSpot && mapRef.current) {
      mapRef.current.addSavedSpot(savedSpot);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Save Location', headerShown: true }} />
      <View style={styles.container}>
        <ActionButtons
          location={location}
          savedSpotsCount={savedSpots.length}
          onGetLocation={handleGetLocation}
          onSaveLocation={handleSaveLocation}
        />
        
        <Map ref={mapRef} style={styles.map} />
        
        {location && (
          <View style={styles.locationInfo}>
            <Text>Lat: {location.coords.latitude.toFixed(6)}</Text>
            <Text>Lng: {location.coords.longitude.toFixed(6)}</Text>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  locationInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
});