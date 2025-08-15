import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface SavedSpot {
  id: string;
  name: string;
  location: LocationCoords;
  photos?: string[];
  timestamp: Date;
  description?: string;
}

interface LocationContextType {
  location: LocationCoords | null;
  savedSpots: SavedSpot[];
  getLocation: () => Promise<void>;
  saveCurrentLocation: (name: string, description?: string) => Promise<void>;
  saveManualLocation: (name: string, coords: LocationCoords, description?: string, photos?: string[]) => Promise<void>;
  addPhotoToSpot: (spotId: string, photoUri: string) => Promise<void>;
  deleteSpot: (spotId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [savedSpots, setSavedSpots] = useState<SavedSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved spots from AsyncStorage on mount
  useEffect(() => {
    loadSavedSpots();
  }, []);

  const loadSavedSpots = async () => {
    try {
      const spotsJson = await AsyncStorage.getItem('savedSpots');
      if (spotsJson) {
        setSavedSpots(JSON.parse(spotsJson));
      }
    } catch (err) {
      console.error('Error loading saved spots:', err);
      setError('Failed to load saved spots');
    }
  };

  const saveSpotsToStorage = async (spots: SavedSpot[]) => {
    try {
      await AsyncStorage.setItem('savedSpots', JSON.stringify(spots));
    } catch (err) {
      console.error('Error saving spots:', err);
      setError('Failed to save spots');
    }
  };

  const getLocation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access location was denied');
        return;
      }

      // Get current location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    } catch (err) {
      console.error('Error getting location:', err);
      setError('Failed to get location');
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentLocation = async (name: string, description?: string) => {
    if (!location) {
      setError('No location available to save');
      return;
    }

    try {
      const newSpot: SavedSpot = {
        id: Date.now().toString(),
        name,
        location,
        timestamp: new Date(),
        description,
        photos: [],
      };

      const updatedSpots = [...savedSpots, newSpot];
      setSavedSpots(updatedSpots);
      await saveSpotsToStorage(updatedSpots);
    } catch (err) {
      console.error('Error saving location:', err);
      setError('Failed to save location');
    }
  };

  const saveManualLocation = async (name: string, coords: LocationCoords, description?: string, photos?: string[]) => {
    try {
      const newSpot: SavedSpot = {
        id: Date.now().toString(),
        name,
        location: coords,
        timestamp: new Date(),
        description,
        photos: photos || [],
      };

      const updatedSpots = [...savedSpots, newSpot];
      setSavedSpots(updatedSpots);
      await saveSpotsToStorage(updatedSpots);
    } catch (err) {
      console.error('Error saving manual location:', err);
      setError('Failed to save location');
    }
  };

  const addPhotoToSpot = async (spotId: string, photoUri: string) => {
    try {
      const updatedSpots = savedSpots.map(spot => {
        if (spot.id === spotId) {
          return {
            ...spot,
            photos: [...(spot.photos || []), photoUri],
          };
        }
        return spot;
      });

      setSavedSpots(updatedSpots);
      await saveSpotsToStorage(updatedSpots);
    } catch (err) {
      console.error('Error adding photo to spot:', err);
      setError('Failed to add photo');
    }
  };

  const deleteSpot = async (spotId: string) => {
    try {
      const updatedSpots = savedSpots.filter(spot => spot.id !== spotId);
      setSavedSpots(updatedSpots);
      await saveSpotsToStorage(updatedSpots);
    } catch (err) {
      console.error('Error deleting spot:', err);
      setError('Failed to delete spot');
    }
  };

  const value: LocationContextType = {
    location,
    savedSpots,
    getLocation,
    saveCurrentLocation,
    saveManualLocation,
    addPhotoToSpot,
    deleteSpot,
    loading,
    error,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

// Custom hook to use the location context
export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};