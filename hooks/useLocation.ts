import * as Location from 'expo-location';
import { useState } from 'react';
import { Alert } from 'react-native';
import { LocationObject, SavedSpot } from '../types';

export const useLocation = () => {
  const [location, setLocation] = useState<LocationObject | null>(null);
  const [savedSpots, setSavedSpots] = useState<SavedSpot[]>([]);

  const getLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return null;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      return currentLocation;
    } catch (error) {
      Alert.alert('Error', 'Could not get location');
      return null;
    }
  };

  const saveCurrentLocation = () => {
    if (!location) {
      Alert.alert('No Location', 'Get your location first!');
      return null;
    }

    const spotName = `Spot ${savedSpots.length + 1}`;
    const newSpot: SavedSpot = {
      id: Date.now().toString(),
      name: spotName,
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      date: new Date().toLocaleDateString(),
      photos: [] // Start with empty photos array
    };

    setSavedSpots(prev => [...prev, newSpot]);
    Alert.alert('Saved!', `${spotName} saved successfully`);
    return newSpot;
  };

  const addPhotoToSpot = (spotId: string, photoUri: string) => {
    setSavedSpots(prev => 
      prev.map(spot => 
        spot.id === spotId 
          ? { ...spot, photos: [...spot.photos, photoUri] }
          : spot
      )
    );
  };

  return {
    location,
    savedSpots,
    getLocation,
    saveCurrentLocation,
    addPhotoToSpot
  };
};