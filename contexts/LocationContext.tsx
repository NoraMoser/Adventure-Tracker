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
import { Visit } from "../types/visits";
import { Alert } from "react-native"; // ADD THIS LINE

const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface SavedSpot {
  id: string;
  name: string;
  location: LocationCoords;
  visits?: Visit[]; // NEW - replaces single locationDate
  timestamp: Date; // When first saved to DB
  description?: string; // Overall description
  category: CategoryType;
  rating?: number; // Overall rating

  // DEPRECATED - keep for backward compatibility during transition
  locationDate?: Date;
  photos?: string[];
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
    locationDate?: Date,
  ) => Promise<SavedSpot | null>; // Change return type
  saveManualLocation: (
    name: string,
    coords: LocationCoords,
    description?: string,
    photos?: string[],
    category?: CategoryType,
    locationDate?: Date,
  ) => Promise<void>;
  updateSpot: (spotId: string, updatedSpot: SavedSpot) => Promise<void>;
  addPhotoToSpot: (spotId: string, photoUri: string) => Promise<void>;
  deleteSpot: (spotId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  refreshSpots: () => Promise<void>;
  migrateLocalPhotosToSupabase: () => Promise<number | undefined>;
  addVisitToSpot: (
    spotId: string,
    visitDate: Date,
    photos?: string[],
    notes?: string,
  ) => Promise<SavedSpot | null>;
  deleteVisit: (spotId: string, visitId: string) => Promise<void>;
}

export type { SavedSpot };

const LocationContext = createContext<LocationContextType | undefined>(
  undefined,
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
          loadSavedSpots();
        },
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
        .order("created_at", { ascending: false }); // We'll sort by visit dates in memory

      if (fetchError) {
        console.error("Supabase error loading locations:", fetchError);
        throw fetchError;
      }

      if (data && data.length > 0) {
        const transformedSpots: SavedSpot[] = data.map((spot) => {
          // Handle visits - either from new visits column or migrate from old fields
          let visits: Visit[] = [];

          if (
            spot.visits &&
            Array.isArray(spot.visits) &&
            spot.visits.length > 0
          ) {
            // New format - transform JSONB visits to Visit objects
            visits = spot.visits.map((v: any) => ({
              id: v.id,
              date: new Date(v.date),
              photos: v.photos || [],
              notes: v.notes || undefined,
            }));
          } else {
            // Old format - create single visit from old fields
            visits = [
              {
                id: `legacy-${spot.id}`,
                date: spot.location_date
                  ? new Date(spot.location_date)
                  : new Date(spot.created_at),
                photos: spot.photos || [],
                notes: undefined,
              },
            ];
          }

          return {
            id: spot.id,
            name: spot.name,
            location: {
              latitude: spot.latitude,
              longitude: spot.longitude,
            },
            visits,
            timestamp: new Date(spot.created_at),
            description: spot.description,
            category: (spot.category as CategoryType) || "other",
            rating: spot.rating,

            // Keep deprecated fields for fallback
            locationDate: spot.location_date
              ? new Date(spot.location_date)
              : new Date(spot.created_at),
            photos: spot.photos || [],
          };
        });

        // Sort by most recent visit date
        transformedSpots.sort((a, b) => {
          const aLatest =
            a.visits.length > 0
              ? Math.max(...a.visits.map((v) => v.date.getTime()))
              : a.timestamp.getTime();
          const bLatest =
            b.visits.length > 0
              ? Math.max(...b.visits.map((v) => v.date.getTime()))
              : b.timestamp.getTime();
          return bLatest - aLatest;
        });

        setSavedSpots(transformedSpots);

        const needsMigration = transformedSpots.some((spot) =>
          spot.visits.some((visit) =>
            visit.photos.some((photo) => !photo.startsWith("http")),
          ),
        );

        if (needsMigration) {
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
    photos: string[],
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
          user.id,
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
    spot: Omit<SavedSpot, "id" | "timestamp"> & { locationDate?: Date },
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
      // Upload photos
      const photoUrls = await processPhotosForUpload(spot.photos || []);

      // Create the first visit
      const firstVisit = {
        id: generateId(),
        date: (spot.locationDate || new Date()).toISOString(),
        photos: photoUrls,
        notes: null,
      };

      const { data, error: insertError } = await supabase
        .from("locations")
        .insert({
          user_id: user.id,
          name: spot.name,
          latitude: spot.location.latitude,
          longitude: spot.location.longitude,
          description: spot.description || null,
          category: spot.category || "other",
          rating: spot.rating || null,
          visits: [firstVisit], // NEW - save as visits array
          // Keep old fields for backward compatibility
          location_date: firstVisit.date,
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
          visits: [
            {
              id: firstVisit.id,
              date: new Date(firstVisit.date),
              photos: photoUrls,
              notes: undefined,
            },
          ],
          timestamp: new Date(data.created_at),
          description: data.description,
          category: (data.category as CategoryType) || "other",
          rating: data.rating,
          // Deprecated fields
          locationDate: new Date(firstVisit.date),
          photos: photoUrls,
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

  const addVisitToSpot = async (
    spotId: string,
    visitDate: Date,
    photos: string[] = [],
    notes?: string,
  ): Promise<SavedSpot | null> => {
    console.log("🔵 addVisitToSpot called:", {
      spotId,
      visitDate,
      photosCount: photos.length,
    });

    if (!user) {
      setError("Please sign in to add visits");
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const spot = savedSpots.find((s) => s.id === spotId);
      if (!spot) {
        setError("Spot not found");
        return null;
      }

      // Upload photos
      const photoUrls = await processPhotosForUpload(photos);

      // Create new visit
      const newVisit = {
        id: generateId(),
        date: visitDate.toISOString(),
        photos: photoUrls,
        notes: notes || null,
      };

      // Combine with existing visits
      const existingVisits = spot.visits.map((v) => ({
        id: v.id,
        date: v.date.toISOString(),
        photos: v.photos,
        notes: v.notes || null,
      }));

      const updatedVisits = [...existingVisits, newVisit];
      console.log("📋 Total visits after adding:", updatedVisits.length);

      // Update database
      const { error: updateError } = await supabase
        .from("locations")
        .update({
          visits: updatedVisits,
          updated_at: new Date().toISOString(),
        })
        .eq("id", spotId)
        .eq("user_id", user.id);

      if (updateError) {
        console.log("❌ Database update error:", updateError);
        throw updateError;
      }
      console.log("✅ Database updated successfully");

      // SYNC TO TRIP ITEMS - Update all trip items that reference this spot
      console.log("🔍 Looking for trip items with spotId:", spotId);

      const { data: tripItems, error: tripItemsError } = await supabase
        .from("trip_items")
        .select("id, data")
        .eq("type", "spot")
        .eq("data->>id", spotId);
      console.log("🎯 Found trip items:", tripItems?.length || 0);

      if (tripItems) {
        console.log(
          "Trip items details:",
          tripItems.map((ti) => ({
            id: ti.id,
            spotName: ti.data.name,
            currentVisitsCount: ti.data.visits?.length || 0,
          })),
        );
      }

      if (!tripItemsError && tripItems && tripItems.length > 0) {
        console.log("🔄 Updating", tripItems.length, "trip items...");

        // Update each trip item with new visits data
        for (const tripItem of tripItems) {
          const updatedData = {
            ...tripItem.data,
            visits: updatedVisits, // Add the updated visits array
          };

          console.log(
            "Updating trip item:",
            tripItem.id,
            "with",
            updatedVisits.length,
            "visits",
          );

          const { error: tripUpdateError } = await supabase
            .from("trip_items")
            .update({ data: updatedData })
            .eq("id", tripItem.id);

          if (tripUpdateError) {
            console.log("❌ Trip item update error:", tripUpdateError);
          } else {
            console.log("✅ Trip item updated:", tripItem.id);
          }
        }
      }

      // Create the updated spot object
      const updatedSpot = {
        ...spot,
        visits: [
          ...spot.visits,
          {
            id: newVisit.id,
            date: new Date(newVisit.date),
            photos: photoUrls,
            notes: notes,
          },
        ],
      };

      // Update local state
      setSavedSpots((prev) =>
        prev.map((s) => (s.id === spotId ? updatedSpot : s)),
      );
      console.log(
        "✅ Local state updated, returning spot with",
        updatedSpot.visits.length,
        "visits",
      );

      return updatedSpot;
    } catch (err) {
      console.error("Error adding visit to spot:", err);
      setError("Failed to add visit");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteVisit = async (spotId: string, visitId: string) => {
    if (!user) {
      setError("Please sign in to delete visits");
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

      console.log("🗑️ Deleting visit:", visitId, "from spot:", spotId);

      // Remove the visit from the array
      const updatedVisits = spot.visits
        .filter((v) => v.id !== visitId)
        .map((v) => ({
          id: v.id,
          date: v.date.toISOString(),
          photos: v.photos,
          notes: v.notes || null,
        }));

      console.log("📋 Remaining visits:", updatedVisits.length);

      // Don't allow deleting the last visit
      if (updatedVisits.length === 0) {
        Alert.alert(
          "Cannot Delete",
          "You must keep at least one visit. Delete the entire spot instead if you want to remove it.",
        );
        setLoading(false);
        return;
      }

      // Update database
      const { error: updateError } = await supabase
        .from("locations")
        .update({
          visits: updatedVisits,
          updated_at: new Date().toISOString(),
        })
        .eq("id", spotId)
        .eq("user_id", user.id);

      if (updateError) {
        console.log("❌ Database update error:", updateError);
        throw updateError;
      }

      console.log("✅ Database updated successfully");

      // SYNC TO TRIP ITEMS
      const { data: tripItems, error: tripItemsError } = await supabase
        .from("trip_items")
        .select("id, data")
        .eq("type", "spot")
        .eq("data->>id", spotId);

      console.log("🎯 Found trip items to update:", tripItems?.length || 0);

      if (!tripItemsError && tripItems && tripItems.length > 0) {
        for (const tripItem of tripItems) {
          const updatedData = {
            ...tripItem.data,
            visits: updatedVisits,
          };

          await supabase
            .from("trip_items")
            .update({ data: updatedData })
            .eq("id", tripItem.id);

          console.log("✅ Trip item updated:", tripItem.id);
        }
      }

      // Update local state
      setSavedSpots((prev) =>
        prev.map((s) =>
          s.id === spotId
            ? {
                ...s,
                visits: s.visits.filter((v) => v.id !== visitId),
              }
            : s,
        ),
      );

      console.log("✅ Local state updated");
    } catch (err) {
      console.error("❌ Error deleting visit:", err);
      setError("Failed to delete visit");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Add a helper function in the context
  const savePhotosToGallery = async (photos: string[]) => {
    try {
      for (const photoUri of photos) {
        try {
          await MediaLibrary.createAssetAsync(photoUri);
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
    locationDate: Date,
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

      return newLocation;
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
    locationDate?: Date,
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

      // Update in locations table
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

      // SYNC TO TRIP ITEMS - Update all trip items that reference this spot
      const { data: tripItems, error: tripItemsError } = await supabase
        .from("trip_items")
        .select("id, data")
        .eq("type", "spot")
        .eq("data->>id", spotId);

      if (!tripItemsError && tripItems && tripItems.length > 0) {
        // Update each trip item with new data
        for (const tripItem of tripItems) {
          const updatedData = {
            ...tripItem.data,
            name: updatedSpot.name,
            description: updatedSpot.description,
            category: updatedSpot.category,
            rating: updatedSpot.rating,
            photos: photoUrls, // Updated photos sync to trips
            location: {
              latitude: updatedSpot.location.latitude,
              longitude: updatedSpot.location.longitude,
            },
          };

          await supabase
            .from("trip_items")
            .update({ data: updatedData })
            .eq("id", tripItem.id);
        }
      }

      setSavedSpots((prev) =>
        prev.map((spot) =>
          spot.id === spotId ? { ...updatedSpot, photos: photoUrls } : spot,
        ),
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
        user.id,
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
        }),
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
          (photo) => !photo.startsWith("http") && !photo.startsWith("https"),
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
    addVisitToSpot,
    deleteVisit,
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
