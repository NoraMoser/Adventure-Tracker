// contexts/LocationContext.tsx - Complete with date support
import * as Location from "expo-location";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { CategoryType } from "../constants/categories";
import { supabase } from "../lib/supabase";
import { PhotoService } from "../services/photoService";
import { useAuth } from "./AuthContext";
import * as MediaLibrary from "expo-media-library";

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface SavedSpot {
  id: string;
  name: string;
  location: LocationCoords;
  locationDate: Date; // When the location was visited
  photos?: string[];
  timestamp: Date; // When saved to DB
  description?: string;
  category: CategoryType;
  rating?: number;
}

interface LocationContextType {
  location: LocationCoords | null;
  savedSpots: SavedSpot[];
  getLocation: () => Promise<void>;
  saveCurrentLocation: (
    name: string,
    description?: string,
    photos?: string[],
    category?: CategoryType,
    locationDate?: Date
  ) => Promise<SavedSpot | null>; // Change return type
  saveManualLocation: (
    name: string,
    coords: LocationCoords,
    description?: string,
    photos?: string[],
    category?: CategoryType,
    locationDate?: Date
  ) => Promise<void>;
  updateSpot: (spotId: string, updatedSpot: SavedSpot) => Promise<void>;
  addPhotoToSpot: (spotId: string, photoUri: string) => Promise<void>;
  deleteSpot: (spotId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  refreshSpots: () => Promise<void>;
  migrateLocalPhotosToSupabase: () => Promise<number | undefined>; // ADD THIS LINE
}

export type { SavedSpot };

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [savedSpots, setSavedSpots] = useState<SavedSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, refreshSession } = useAuth();

  // Initialize photo storage on mount
  useEffect(() => {
    const checkStorage = async () => {
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
      } catch (err) {
        console.log("Could not list buckets:", err);
      }
    };
    checkStorage();
  }, []);

  // Load saved spots when user changes
  useEffect(() => {
    if (user) {
      loadSavedSpots();
    } else {
      setSavedSpots([]);
      setLocation(null);
      setError(null);
    }
  }, [user?.id]);

  // Subscribe to real-time changes
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel("locations_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "locations",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Location change received:", payload);
          loadSavedSpots();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const loadSavedSpots = async () => {
    if (!user) {
      setSavedSpots([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("locations")
        .select("*")
        .eq("user_id", user.id)
        .order("location_date", { ascending: false }) // Order by location date
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Supabase error loading locations:", fetchError);
        throw fetchError;
      }

      if (data && data.length > 0) {
        const transformedSpots: SavedSpot[] = data.map((spot) => ({
          id: spot.id,
          name: spot.name,
          location: {
            latitude: spot.latitude,
            longitude: spot.longitude,
          },
          locationDate: spot.location_date
            ? new Date(spot.location_date)
            : new Date(spot.created_at),
          photos: spot.photos || [],
          timestamp: new Date(spot.created_at),
          description: spot.description,
          category: (spot.category as CategoryType) || "other",
          rating: spot.rating,
        }));
        setSavedSpots(transformedSpots);

        const needsMigration = transformedSpots.some((spot) =>
          spot.photos?.some((photo) => !photo.startsWith("http"))
        );

        if (needsMigration) {
          // Don't await this - let it run in background
          migrateLocalPhotosToSupabase().then((count) => {
            if (count && count > 0) {
              console.log(`Auto-migrated ${count} photos`);
            }
          });
        }
      } else {
        setSavedSpots([]);
      }
    } catch (err) {
      console.error("Error in loadSavedSpots:", err);
      setError("Failed to load saved spots");
    } finally {
      setLoading(false);
    }
  };

  const refreshSpots = async () => {
    await loadSavedSpots();
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (newStatus !== "granted") {
          setError("Location permission denied");
          return;
        }
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    } catch (err) {
      console.error("Error getting location:", err);
      setError("Failed to get location");

      throw new Error("Could not get location");
    } finally {
      setLoading(false);
    }
  };

  const processPhotosForUpload = async (
    photos: string[]
  ): Promise<string[]> => {
    if (!photos || photos.length === 0 || !user) return [];

    const finalUrls: string[] = [];

    for (const photo of photos) {
      if (photo.startsWith("http")) {
        finalUrls.push(photo);
        continue;
      }

      try {
        const uploadedUrl = await PhotoService.uploadPhoto(
          photo,
          "location-photos",
          user.id
        );
        if (uploadedUrl) {
          finalUrls.push(uploadedUrl);
        } else {
        }
      } catch (err) {
        console.error("Error uploading photo:", photo, err);
      }
    }

    return finalUrls;
  };

  const saveSpot = async (
    spot: Omit<SavedSpot, "id" | "timestamp"> & { locationDate?: Date }
  ): Promise<SavedSpot | null> => {
    if (!user) {
      setError("Please sign in to save locations");
      return null;
    }

    if (refreshSession) {
      const sessionValid = await refreshSession();
      if (!sessionValid) {
        setError("Session expired. Please sign in again.");
        return null;
      }
    }

    try {
      const photoUrls = await processPhotosForUpload(spot.photos || []);

      const { data, error: insertError } = await supabase
        .from("locations")
        .insert({
          user_id: user.id,
          name: spot.name,
          location_date: (spot.locationDate || new Date()).toISOString(),
          latitude: spot.location.latitude,
          longitude: spot.location.longitude,
          description: spot.description || null,
          category: spot.category || "other",
          rating: spot.rating || null,
          photos: photoUrls,
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
          locationDate: data.location_date
            ? new Date(data.location_date)
            : new Date(),
          photos: data.photos || [],
          timestamp: new Date(data.created_at),
          description: data.description,
          category: (data.category as CategoryType) || "other",
          rating: data.rating,
        };

        setSavedSpots((prev) => [newSpot, ...prev]);
        await new Promise((resolve) => setTimeout(resolve, 100));

        return newSpot;
      }
      return null;
    } catch (error) {
      console.error("Error saving spot:", error);
      setError("Failed to save location");
      throw error;
    }
  };

  // Add a helper function in the context
  const savePhotosToGallery = async (photos: string[]) => {
    try {
      for (const photoUri of photos) {
        try {
          const asset = await MediaLibrary.createAssetAsync(photoUri);
          const album = await MediaLibrary.getAlbumAsync("explorAble");
          if (album == null) {
            await MediaLibrary.createAlbumAsync("explorAble", asset, false);
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          }
        } catch (err) {
          console.log("Photo might already be saved:", err);
        }
      }
    } catch (error) {
      console.log("Gallery save error:", error);
    }
  };

  const saveCurrentLocation = async (
    name: string,
    description: string,
    photos: string[],
    category: CategoryType,
    locationDate: Date // Add this parameter
  ): Promise<any> => {
    if (!location) {
      setError("No location available to save");
      return;
    }

    if (!user) {
      setError("Please sign in to save locations");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Store the result of saveSpot
      const newLocation = await saveSpot({
        name,
        location,
        locationDate: locationDate || new Date(),
        description,
        photos: photos || [],
        category,
      });

      if (photos.length > 0) {
        await savePhotosToGallery(photos);
      }

      return newLocation; // Now this exists
    } catch (err) {
      console.error("Error saving current location:", err);
      setError("Failed to save location");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const saveManualLocation = async (
    name: string,
    coords: LocationCoords,
    description?: string,
    photos?: string[],
    category: CategoryType = "other",
    locationDate?: Date
  ) => {
    if (!user) {
      setError("Please sign in to save locations");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await saveSpot({
        name,
        location: coords,
        locationDate: locationDate || new Date(),
        description,
        photos: photos || [],
        category,
      });

    } catch (err) {
      console.error("Error saving manual location:", err);
      setError("Failed to save location");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateSpot = async (spotId: string, updatedSpot: SavedSpot) => {
    if (!user) {
      setError("Please sign in to update locations");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const photoUrls = await processPhotosForUpload(updatedSpot.photos || []);

      const { error: updateError } = await supabase
        .from("locations")
        .update({
          name: updatedSpot.name,
          location_date: updatedSpot.locationDate.toISOString(),
          latitude: updatedSpot.location.latitude,
          longitude: updatedSpot.location.longitude,
          description: updatedSpot.description || null,
          category: updatedSpot.category || "other",
          rating: updatedSpot.rating || null,
          photos: photoUrls,
          updated_at: new Date().toISOString(),
        })
        .eq("id", spotId)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setSavedSpots((prev) =>
        prev.map((spot) =>
          spot.id === spotId ? { ...updatedSpot, photos: photoUrls } : spot
        )
      );
    } catch (err) {
      console.error("Error updating spot:", err);
      setError("Failed to update location");
    } finally {
      setLoading(false);
    }
  };

  const addPhotoToSpot = async (spotId: string, photoUri: string) => {
    if (!user) {
      setError("Please sign in to add photos");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const spot = savedSpots.find((s) => s.id === spotId);
      if (!spot) {
        setError("Spot not found");
        return;
      }

      const photoUrl = await PhotoService.uploadPhoto(
        photoUri,
        "location-photos",
        user.id
      );
      if (!photoUrl) {
        throw new Error("Failed to upload photo");
      }

      const updatedPhotos = [...(spot.photos || []), photoUrl];

      const { error: updateError } = await supabase
        .from("locations")
        .update({
          photos: updatedPhotos,
          updated_at: new Date().toISOString(),
        })
        .eq("id", spotId)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setSavedSpots((prev) =>
        prev.map((s) => {
          if (s.id === spotId) {
            return { ...s, photos: updatedPhotos };
          }
          return s;
        })
      );
    } catch (err) {
      console.error("Error adding photo to spot:", err);
      setError("Failed to add photo");
    } finally {
      setLoading(false);
    }
  };

  const deleteSpot = async (spotId: string) => {
    if (!user) {
      setError("Please sign in to delete locations");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from("locations")
        .delete()
        .eq("id", spotId)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      setSavedSpots((prev) => prev.filter((spot) => spot.id !== spotId));

    } catch (err) {
      console.error("Error deleting spot:", err);
      setError("Failed to delete spot");
    } finally {
      setLoading(false);
    }
  };

  const migrateLocalPhotosToSupabase = async () => {
    if (!user) return;

    let migrationCount = 0;
    setLoading(true);

    try {
      for (const spot of savedSpots) {
        if (!spot.photos || spot.photos.length === 0) continue;

        // Check if any photos are still local URIs
        const localPhotos = spot.photos.filter(
          (photo) => !photo.startsWith("http") && !photo.startsWith("https")
        );

        if (localPhotos.length > 0) {

          // Upload all photos (processPhotosForUpload handles both local and remote)
          const updatedPhotoUrls = await processPhotosForUpload(spot.photos);

          // Update in database
          const { error: updateError } = await supabase
            .from("locations")
            .update({
              photos: updatedPhotoUrls,
              updated_at: new Date().toISOString(),
            })
            .eq("id", spot.id)
            .eq("user_id", user.id);

          if (updateError) throw updateError;

          migrationCount += localPhotos.length;
        }
      }

      if (migrationCount > 0) {
        await loadSavedSpots(); // Reload to get updated URLs
      }

      return migrationCount;
    } catch (error) {
      console.error("Migration error:", error);
      throw error;
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
    refreshSpots,
    migrateLocalPhotosToSupabase,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};
