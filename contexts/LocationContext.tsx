// contexts/LocationContext.tsx - Fixed version without reviews column
import * as Location from 'expo-location';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { CategoryType } from '../constants/categories';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

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
  category: CategoryType;
  rating?: number;
}

interface LocationContextType {
  location: LocationCoords | null;
  savedSpots: SavedSpot[];
  getLocation: () => Promise<void>;
  saveCurrentLocation: (name: string, description?: string, photos?: string[], category?: CategoryType) => Promise<void>;
  saveManualLocation: (name: string, coords: LocationCoords, description?: string, photos?: string[], category?: CategoryType) => Promise<void>;
  updateSpot: (spotId: string, updatedSpot: SavedSpot) => Promise<void>;
  addPhotoToSpot: (spotId: string, photoUri: string) => Promise<void>;
  deleteSpot: (spotId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

// Export the SavedSpot type
export type { SavedSpot };

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [savedSpots, setSavedSpots] = useState<SavedSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Load saved spots from Supabase when user changes
  useEffect(() => {
    if (user) {
      loadSavedSpots();
    } else {
      setSavedSpots([]);
    }
  }, [user]);

  // Subscribe to real-time changes (optional but cool!)
  useEffect(() => {
    if (!user) return;

    // Subscribe to changes in locations table
    const subscription = supabase
      .channel('locations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'locations',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Location change received:', payload);
          // Reload spots when changes occur
          loadSavedSpots();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const loadSavedSpots = async () => {
    if (!user) {
      setSavedSpots([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      if (data) {
        // Transform database format to app format
        const transformedSpots: SavedSpot[] = data.map(spot => ({
          id: spot.id,
          name: spot.name,
          location: {
            latitude: spot.latitude,
            longitude: spot.longitude,
          },
          photos: spot.photos || [],
          timestamp: new Date(spot.created_at),
          description: spot.description,
          category: spot.category as CategoryType || 'other',
          rating: spot.rating,
        }));
        setSavedSpots(transformedSpots);
      }
    } catch (err) {
      console.error('Error loading saved spots:', err);
      setError('Failed to load saved spots');
    } finally {
      setLoading(false);
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

  const saveSpot = async (spot: Omit<SavedSpot, 'id' | 'timestamp'>): Promise<SavedSpot | null> => {
    if (!user) {
      setError('Please sign in to save locations');
      return null;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('locations')
        .insert({
          user_id: user.id,
          name: spot.name,
          latitude: spot.location.latitude,
          longitude: spot.location.longitude,
          description: spot.description || null,
          category: spot.category || 'other',
          rating: spot.rating || null,
          photos: spot.photos || [],
          // removed reviews field
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        const newSpot: SavedSpot = {
          id: data.id,
          name: data.name,
          location: {
            latitude: data.latitude,
            longitude: data.longitude,
          },
          photos: data.photos || [],
          timestamp: new Date(data.created_at),
          description: data.description,
          category: data.category as CategoryType || 'other',
          rating: data.rating,
        };
        
        // Update local state
        setSavedSpots(prev => [newSpot, ...prev]);
        return newSpot;
      }
      return null;
    } catch (error) {
      console.error('Error saving spot:', error);
      setError('Failed to save location');
      throw error;
    }
  };

  const saveCurrentLocation = async (
    name: string,
    description?: string,
    photos?: string[],
    category: CategoryType = 'other'
  ) => {
    if (!location) {
      setError('No location available to save');
      return;
    }

    if (!user) {
      setError('Please sign in to save locations');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await saveSpot({
        name,
        location,
        description,
        photos: photos || [],
        category,
      });

      console.log('Location saved successfully');
    } catch (err) {
      console.error('Error saving current location:', err);
      setError('Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const saveManualLocation = async (
    name: string,
    coords: LocationCoords,
    description?: string,
    photos?: string[],
    category: CategoryType = 'other'
  ) => {
    if (!user) {
      setError('Please sign in to save locations');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await saveSpot({
        name,
        location: coords,
        description,
        photos: photos || [],
        category,
      });

      console.log('Manual location saved successfully');
    } catch (err) {
      console.error('Error saving manual location:', err);
      setError('Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const updateSpot = async (spotId: string, updatedSpot: SavedSpot) => {
    if (!user) {
      setError('Please sign in to update locations');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('locations')
        .update({
          name: updatedSpot.name,
          latitude: updatedSpot.location.latitude,
          longitude: updatedSpot.location.longitude,
          description: updatedSpot.description || null,
          category: updatedSpot.category || 'other',
          rating: updatedSpot.rating || null,
          photos: updatedSpot.photos || [],
          // removed reviews field
          updated_at: new Date().toISOString(),
        })
        .eq('id', spotId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Update local state
      setSavedSpots(prev =>
        prev.map(spot => (spot.id === spotId ? updatedSpot : spot))
      );

      console.log('Spot updated successfully');
    } catch (err) {
      console.error('Error updating spot:', err);
      setError('Failed to update location');
    } finally {
      setLoading(false);
    }
  };

  const addPhotoToSpot = async (spotId: string, photoUri: string) => {
    if (!user) {
      setError('Please sign in to add photos');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Find the spot
      const spot = savedSpots.find(s => s.id === spotId);
      if (!spot) {
        setError('Spot not found');
        return;
      }

      const updatedPhotos = [...(spot.photos || []), photoUri];

      const { error: updateError } = await supabase
        .from('locations')
        .update({
          photos: updatedPhotos,
          updated_at: new Date().toISOString(),
        })
        .eq('id', spotId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Update local state
      setSavedSpots(prev =>
        prev.map(s => {
          if (s.id === spotId) {
            return { ...s, photos: updatedPhotos };
          }
          return s;
        })
      );

      console.log('Photo added successfully');
    } catch (err) {
      console.error('Error adding photo to spot:', err);
      setError('Failed to add photo');
    } finally {
      setLoading(false);
    }
  };

  const deleteSpot = async (spotId: string) => {
    if (!user) {
      setError('Please sign in to delete locations');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('locations')
        .delete()
        .eq('id', spotId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Update local state
      setSavedSpots(prev => prev.filter(spot => spot.id !== spotId));

      console.log('Spot deleted successfully');
    } catch (err) {
      console.error('Error deleting spot:', err);
      setError('Failed to delete spot');
    } finally {
      setLoading(false);
    }
  };

  const value: LocationContextType = {
    location,
    savedSpots,
    getLocation,
    saveCurrentLocation,
    saveManualLocation,
    updateSpot,
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