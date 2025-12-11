// contexts/TripContext.tsx - Enhanced version with detailed trip detection
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";
import { supabase } from "../lib/supabase";
import { TripDetector } from "../utils/TripDetector";
import { useActivity } from "./ActivityContext";
import { useAuth } from "./AuthContext";
import { useLocation } from "./LocationContext";
import { PhotoService } from "../services/photoService";
import { calculateDistance, areLocationsNearby } from "../utils/gps";

export interface TripItem {
  id: string;
  trip_id: string;
  type: "activity" | "spot";
  data: any;
  added_at: Date;
  added_by?: string;
}

export interface Trip {
  id: string;
  name: string;
  start_date: Date;
  end_date: Date;
  items?: TripItem[];
  cover_photo?: string;
  cover_photo_position?: { x: number; y: number };
  created_at: Date;
  created_by: string;
  tagged_friends?: string[];
  auto_generated?: boolean;
  merged_from?: string[];
  dates_locked?: boolean;
}

interface TripCluster {
  id: string;
  suggestedName: string;
  startDate: Date;
  endDate: Date;
  items: any[];
  spotCount: number;
  activityCount: number;
  primaryLocation?: string;
  totalDistance?: number;
}

interface TripContextType {
  trips: Trip[];
  currentUserId: string | null;
  loading: boolean;
  createTrip: (
    trip: Omit<Trip, "id" | "created_at" | "items">
  ) => Promise<Trip>;
  updateTrip: (tripId: string, updates: Partial<Trip>) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  addToTrip: (
    tripId: string,
    item: any,
    type: "activity" | "spot"
  ) => Promise<void>;
  removeFromTrip: (tripId: string, tripItemId: string) => Promise<void>;
  tagFriend: (tripId: string, friendId: string) => Promise<void>;
  untagFriend: (tripId: string, friendId: string) => Promise<void>;
  mergeTripWithShared: (tripId: string, sharedTripId: string) => Promise<void>;
  getSharedTrips: () => Trip[];
  getMyTrips: () => Trip[];
  runAutoDetection: () => Promise<void>;
  runDetailedAutoDetection: () => Promise<void>;
  refreshTrips: () => Promise<void>;
  canTripsBeJoined: (trip1: Trip, trip2: Trip) => boolean;
  getSuggestedMerges: () => { autoTrip: Trip; sharedTrip: Trip }[];
  triggerAutoDetection: () => Promise<void>;
  checkForAutoTrip: (item: any) => Promise<Trip | null>;
  smartAddToTrip: (item: any, type: "activity" | "spot") => Promise<void>;
  calculateDistance: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => number;
  fixAllTripPhotos: () => Promise<void>;
  showPendingClusters: () => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export const TripProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { activities } = useActivity();
  const { savedSpots } = useLocation();
  const currentUserId = user?.id || null;
  const hasRunAutoDetection = useRef(false);
  const autoDetectionInProgress = useRef(false);
  const rejectedTripIds = useRef<Set<string>>(new Set());
  const [pendingClusters, setPendingClusters] = useState<TripCluster[]>([]);

  const checkDistanceFromPendingClusters = async (currentLocation: {
    latitude: number;
    longitude: number;
  }) => {
    if (pendingClusters.length === 0 || !currentUserId) return;

    const SUGGEST_DISTANCE_KM = 32; // ~20 miles
    const clustersToSuggest: TripCluster[] = [];
    const clustersToKeep: TripCluster[] = [];

    for (const cluster of pendingClusters) {
      // Calculate center of cluster
      const clusterLocations = cluster.items
        .map((item) => item.location)
        .filter((loc) => loc !== null);

      if (clusterLocations.length === 0) {
        // No location data, keep pending
        clustersToKeep.push(cluster);
        continue;
      }

      const centerLat =
        clusterLocations.reduce((sum, loc) => sum + loc.latitude, 0) /
        clusterLocations.length;
      const centerLng =
        clusterLocations.reduce((sum, loc) => sum + loc.longitude, 0) /
        clusterLocations.length;

      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        centerLat,
        centerLng
      );

      if (distance > SUGGEST_DISTANCE_KM) {
        // User has moved away, suggest this cluster
        clustersToSuggest.push(cluster);
      } else {
        // Still nearby, keep pending
        clustersToKeep.push(cluster);
      }
    }

    // Update pending clusters
    setPendingClusters(clustersToKeep);

    // Show suggestions for clusters user has moved away from
    if (clustersToSuggest.length > 0) {
      await showTripSelectionUI(clustersToSuggest);
    }
  };

  // Load trips on mount and when user changes
  useEffect(() => {
    if (currentUserId) {
      loadTrips();
      const unsubscribe = subscribeToTrips();
      return () => {
        unsubscribe?.();
      };
    } else {
      setTrips([]);
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    hasRunAutoDetection.current = false;
    rejectedTripIds.current.clear();
  }, [currentUserId]);

  // Export a function to trigger auto-detection manually
  const triggerAutoDetection = async () => {
    if (!hasRunAutoDetection.current && !autoDetectionInProgress.current) {
      hasRunAutoDetection.current = true;
      await runDetailedAutoDetection();
    }
  };

  const subscribeToTrips = () => {
    if (!currentUserId) return;

    const subscription = supabase
      .channel("trips_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `created_by=eq.${currentUserId}`,
        },
        (payload) => {
          loadTrips();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_tags",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          loadTrips();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const loadTrips = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load trips where user is creator or tagged
      const { data: myTrips, error: tripsError } = await supabase
        .from("trips")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (tripsError) throw tripsError;

      // Load trips where user is tagged
      const { data: taggedTripIds, error: tagError } = await supabase
        .from("trip_tags")
        .select("trip_id")
        .eq("user_id", user.id);

      if (tagError) throw tagError;

      let sharedTrips: any[] = [];
      if (taggedTripIds && taggedTripIds.length > 0) {
        const tripIds = taggedTripIds.map((t) => t.trip_id);
        const { data: shared, error: sharedError } = await supabase
          .from("trips")
          .select("*")
          .in("id", tripIds)
          .order("created_at", { ascending: false });

        if (sharedError) throw sharedError;
        sharedTrips = shared || [];
      }

      // Combine all trips
      const allTrips = [...(myTrips || []), ...sharedTrips];
      const uniqueTripIds = [...new Set(allTrips.map((t) => t.id))];

      // Load all tags for these trips
      const { data: allTags, error: tagsError } = await supabase
        .from("trip_tags")
        .select("trip_id, user_id")
        .in("trip_id", uniqueTripIds);

      if (tagsError) throw tagsError;

      // Group tags by trip_id
      const tagsByTrip = (allTags || []).reduce((acc, tag) => {
        if (!acc[tag.trip_id]) acc[tag.trip_id] = [];
        acc[tag.trip_id].push(tag.user_id);
        return acc;
      }, {} as Record<string, string[]>);

      // Load trip items
      const { data: items, error: itemsError } = await supabase
        .from("trip_items")
        .select("*")
        .in("trip_id", uniqueTripIds);

      if (itemsError) throw itemsError;

      // Group items by trip_id
      const itemsByTrip = (items || []).reduce((acc, item) => {
        if (!acc[item.trip_id]) acc[item.trip_id] = [];
        acc[item.trip_id].push({
          id: item.id,
          trip_id: item.trip_id,
          type: item.type as "activity" | "spot",
          data: item.data,
          added_at: item.added_at,
          added_by: item.added_by,
        });
        return acc;
      }, {} as Record<string, TripItem[]>);

      // Build complete trip objects
      const completeTrips = allTrips.map((trip) => ({
        id: trip.id,
        name: trip.name,
        start_date: new Date(trip.start_date),
        end_date: new Date(trip.end_date),
        created_by: trip.created_by,
        auto_generated: trip.auto_generated || false,
        cover_photo: trip.cover_photo,
        cover_photo_position: trip.cover_photo_position,
        tagged_friends: tagsByTrip[trip.id] || [],
        items: itemsByTrip[trip.id] || [],
        created_at: trip.created_at,
        merged_from: trip.merged_from || [],
        dates_locked: trip.dates_locked || false,
      }));

      // Remove duplicates (in case user is both creator and tagged)
      const uniqueTrips = completeTrips.filter(
        (trip, index, self) => index === self.findIndex((t) => t.id === trip.id)
      );

      setTrips(uniqueTrips);
    } catch (error) {
      console.error("Error loading trips:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshTrips = async () => {
    await loadTrips();
  };

  const checkForAutoTrip = async (item: any): Promise<Trip | null> => {
    if (!currentUserId) return null;

    // First check if this item is already in ANY trip
    const { data: existingTripItem } = await supabase
      .from("trip_items")
      .select("trip_id")
      .eq("type", item.type || "spot")
      .eq("data->>id", item.id)
      .single();

    if (existingTripItem) {
      return null;
    }

    // Check if location is near home (if configured)
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("home_location, home_radius")
        .eq("id", user.id)
        .single();

      if (profile?.home_location) {
        const homeRadius = profile.home_radius || 2;
        const itemLocation = item.location || (item.route && item.route[0]);
        if (itemLocation) {
          const distanceFromHome = calculateDistance(
            itemLocation.latitude,
            itemLocation.longitude,
            profile.home_location.latitude,
            profile.home_location.longitude
          );

          if (distanceFromHome <= homeRadius) {
            return null;
          }
        }
      }
    }

    // Get item date and location
    const itemDate =
      item.activityDate || item.locationDate || item.date || new Date();
    const itemLocation = item.location || (item.route && item.route[0]) || null;

    // Find trips that could match based on date AND location proximity
    const now = new Date();
    const candidateTrips = trips.filter((trip) => {
      const tripAge = Math.abs(now.getTime() - trip.end_date.getTime());
      const maxAge = 90 * 24 * 60 * 60 * 1000;
      if (tripAge > maxAge) return false;

      const tripStart = new Date(trip.start_date);
      const tripEnd = new Date(trip.end_date);
      const itemDateObj = new Date(itemDate);

      const expandedStart = new Date(tripStart);
      expandedStart.setDate(expandedStart.getDate() - 7);
      const expandedEnd = new Date(tripEnd);
      expandedEnd.setDate(expandedEnd.getDate() + 7);

      const isDateNearby =
        itemDateObj >= expandedStart && itemDateObj <= expandedEnd;

      if (!isDateNearby) return false;

      if (itemLocation && trip.items && trip.items.length > 0) {
        const hasNearbyItem = trip.items.some((tripItem) => {
          const tripItemLocation =
            tripItem.data.location ||
            (tripItem.data.route && tripItem.data.route[0]);
          return (
            tripItemLocation &&
            areLocationsNearby(itemLocation, tripItemLocation, 100)
          );
        });

        return hasNearbyItem;
      }

      return isDateNearby;
    });

    if (candidateTrips.length > 0) {
      return candidateTrips[0];
    }

    return new Promise((resolve) => {
      const tripName = `Trip on ${new Date(itemDate).toLocaleDateString()}`;

      Alert.alert(
        "Create New Trip?",
        `No existing trip matches this item. Would you like to create a new trip "${tripName}"?`,
        [
          {
            text: "Not now",
            style: "cancel",
            onPress: () => resolve(null),
          },
          {
            text: "Yes, create trip",
            onPress: async () => {
              try {
                const newTrip = await createTrip({
                  name: tripName,
                  start_date: new Date(itemDate),
                  end_date: new Date(itemDate),
                  created_by: currentUserId,
                  auto_generated: true,
                  tagged_friends: [],
                });
                resolve(newTrip);
              } catch (error) {
                console.error("Failed to create auto-trip:", error);
                resolve(null);
              }
            },
          },
        ]
      );
    });
  };

  const smartAddToTrip = async (item: any, type: "activity" | "spot") => {
    if (!currentUserId) return;

    try {
      const autoTrip = await checkForAutoTrip(item);
      if (autoTrip) {
        await addToTrip(autoTrip.id, item, type);
      }
    } catch (error) {
      console.error("Error in smartAddToTrip:", error);
    }
  };

  const createTrip = async (
    tripData: Omit<Trip, "id" | "created_at" | "items">
  ): Promise<Trip> => {
    if (!currentUserId) throw new Error("User not authenticated");

    try {
      const startDate =
        tripData.start_date instanceof Date
          ? tripData.start_date
          : new Date(tripData.start_date);
      const endDate =
        tripData.end_date instanceof Date
          ? tripData.end_date
          : new Date(tripData.end_date);

      const { data, error } = await supabase
        .from("trips")
        .insert({
          name: tripData.name,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          cover_photo: tripData.cover_photo,
          created_by: tripData.created_by || currentUserId,
          auto_generated: tripData.auto_generated || false,
          merged_from: tripData.merged_from,
        })
        .select()
        .single();

      if (error) throw error;

      if (tripData.tagged_friends && tripData.tagged_friends.length > 0) {
        const tags = tripData.tagged_friends.map((friendId) => ({
          trip_id: data.id,
          user_id: friendId,
        }));

        const { error: tagError } = await supabase
          .from("trip_tags")
          .insert(tags);

        if (tagError) {
          console.error("Error tagging friends:", tagError);
        }
      }

      const newTrip = {
        ...data,
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date),
        created_at: new Date(data.created_at),
        items: [],
        tagged_friends: tripData.tagged_friends || [],
      };

      setTrips((prev) => [...prev, newTrip]);

      return newTrip;
    } catch (error) {
      console.error("Error creating trip:", error);
      Alert.alert("Error", "Failed to create trip");
      throw error;
    }
  };

  const updateTrip = async (tripId: string, updates: Partial<Trip>) => {
    try {
      const updateData: any = {};

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.start_date !== undefined) {
        updateData.start_date =
          updates.start_date instanceof Date
            ? updates.start_date.toISOString()
            : updates.start_date;
      }
      if (updates.end_date !== undefined) {
        updateData.end_date =
          updates.end_date instanceof Date
            ? updates.end_date.toISOString()
            : updates.end_date;
      }
      if (updates.cover_photo !== undefined) {
        updateData.cover_photo = updates.cover_photo;
      }
      if (updates.cover_photo_position !== undefined) {
        updateData.cover_photo_position = updates.cover_photo_position;
      }
      if (updates.dates_locked !== undefined) {
        updateData.dates_locked = updates.dates_locked;
      }

      const { error } = await supabase
        .from("trips")
        .update(updateData)
        .eq("id", tripId);

      if (error) throw error;

      if (updates.tagged_friends !== undefined) {
        await supabase.from("trip_tags").delete().eq("trip_id", tripId);

        if (updates.tagged_friends.length > 0) {
          const tags = updates.tagged_friends.map((friendId) => ({
            trip_id: tripId,
            user_id: friendId,
          }));

          const { error: tagError } = await supabase
            .from("trip_tags")
            .insert(tags);

          if (tagError) {
            console.error("Error updating tags:", tagError);
          }
        }
      }

      setTrips((prevTrips) =>
        prevTrips.map((trip) =>
          trip.id === tripId
            ? {
                ...trip,
                ...updates,
                start_date: updates.start_date || trip.start_date,
                end_date: updates.end_date || trip.end_date,
              }
            : trip
        )
      );

      await loadTrips();
    } catch (error) {
      console.error("Error updating trip:", error);
      Alert.alert("Error", "Failed to update trip");
    }
  };

  const deleteTrip = async (tripId: string) => {
    try {
      await supabase.from("trip_items").delete().eq("trip_id", tripId);
      await supabase.from("trip_tags").delete().eq("trip_id", tripId);
      const { error } = await supabase.from("trips").delete().eq("id", tripId);

      if (error) throw error;

      setTrips((prev) => prev.filter((t) => t.id !== tripId));

      Alert.alert("Success", "Trip deleted successfully");
    } catch (error) {
      console.error("Error deleting trip:", error);
      Alert.alert("Error", "Failed to delete trip");
      throw error;
    }
  };

  const fixAllTripPhotos = async () => {
    if (!currentUserId) return;

    const { data: tripItems, error } = await supabase
      .from("trip_items")
      .select("*")
      .eq("type", "spot");

    if (error || !tripItems) {
      console.error("Failed to load trip items:", error);
      return;
    }

    let fixedCount = 0;

    for (const item of tripItems) {
      if (item.data.photos?.some((p: string) => p.startsWith("file://"))) {
        if (item.data.id) {
          const { data: spotFromDb } = await supabase
            .from("locations")
            .select("photos")
            .eq("id", item.data.id)
            .single();

          if (spotFromDb?.photos) {
            const updatedData = {
              ...item.data,
              photos: spotFromDb.photos,
            };

            await supabase
              .from("trip_items")
              .update({ data: updatedData })
              .eq("id", item.id);

            fixedCount++;
          }
        }
      }
    }

    Alert.alert(
      "Success",
      `Fixed ${fixedCount} trip items with local photo URLs`
    );
    await loadTrips();
  };

  const addToTrip = async (
    tripId: string,
    itemData: any,
    itemType: "activity" | "spot"
  ) => {
    if (!currentUserId) return;

    let targetTripId = tripId;

    if (tripId === "auto") {
      const autoTrip = await checkForAutoTrip(itemData);
      if (!autoTrip) {
        console.error("Failed to create auto-trip");
        return;
      }
      targetTripId = autoTrip.id;
    }

    try {
      // Check if item already exists in trip
      const { data: existing } = await supabase
        .from("trip_items")
        .select("id")
        .eq("trip_id", targetTripId)
        .eq("type", itemType)
        .eq("data->>id", itemData.id)
        .single();

      if (existing) {
        Alert.alert("Already Added", "This item is already in the trip");
        return;
      }

      let processedItemData = { ...itemData };

      // CRITICAL FIX: Fetch the item from database to get proper Supabase URLs
      if (itemData.id) {
        if (itemType === "spot") {
          const { data: spotFromDb } = await supabase
            .from("locations")
            .select("*")
            .eq("id", itemData.id)
            .single();

          if (spotFromDb) {
            processedItemData = { ...spotFromDb };
          }
        } else if (itemType === "activity") {
          const { data: activityFromDb } = await supabase
            .from("activities")
            .select("*")
            .eq("id", itemData.id)
            .single();

          if (activityFromDb) {
            processedItemData = { ...activityFromDb };
          }
        }
      }

      // Only upload photos if they're still local (shouldn't happen with above fix, but kept as fallback)
      if (processedItemData.photos && processedItemData.photos.length > 0) {
        const hasLocalPhotos = processedItemData.photos.some((p: string) =>
          p.startsWith("file://")
        );

        if (hasLocalPhotos) {
          const uploadedPhotos = [];
          for (const photo of processedItemData.photos) {
            if (photo.startsWith("http://") || photo.startsWith("https://")) {
              uploadedPhotos.push(photo);
            } else {
              try {
                const uploadedUrl = await PhotoService.uploadPhoto(
                  photo,
                  itemType === "spot" ? "location-photos" : "activity-photos",
                  currentUserId
                );
                if (uploadedUrl) {
                  uploadedPhotos.push(uploadedUrl);
                }
              } catch (err) {
                console.error("Failed to upload photo to trip:", err);
              }
            }
          }
          processedItemData.photos = uploadedPhotos;
        }
      }

      const { error } = await supabase.from("trip_items").insert({
        trip_id: targetTripId,
        type: itemType,
        data: processedItemData,
        added_by: currentUserId,
      });

      if (error) throw error;

      // Auto-adjust trip dates if not locked
      const trip = trips.find((t) => t.id === targetTripId);
      if (trip && !trip.dates_locked) {
        let itemDate: Date | null = null;

        if (itemType === "activity") {
          itemDate = processedItemData.activityDate
            ? new Date(processedItemData.activityDate)
            : processedItemData.activity_date
            ? new Date(processedItemData.activity_date)
            : processedItemData.startTime
            ? new Date(processedItemData.startTime)
            : processedItemData.start_time
            ? new Date(processedItemData.start_time)
            : null;
        } else if (itemType === "spot") {
          itemDate = processedItemData.locationDate
            ? new Date(processedItemData.locationDate)
            : processedItemData.location_date
            ? new Date(processedItemData.location_date)
            : processedItemData.timestamp
            ? new Date(processedItemData.timestamp)
            : null;
        }

        if (itemDate && !isNaN(itemDate.getTime())) {
          const tripStart = new Date(trip.start_date);
          const tripEnd = new Date(trip.end_date);
          let needsUpdate = false;
          let newStartDate = tripStart;
          let newEndDate = tripEnd;

          if (itemDate < tripStart) {
            newStartDate = itemDate;
            needsUpdate = true;
          }
          if (itemDate > tripEnd) {
            newEndDate = itemDate;
            needsUpdate = true;
          }

          if (needsUpdate) {
            // Normalize to avoid timezone shifts
            const normalizeToLocal = (d: Date) =>
              new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);

            await updateTrip(targetTripId, {
              start_date: normalizeToLocal(newStartDate),
              end_date: normalizeToLocal(newEndDate),
            });
          }
        }
      }

      await loadTrips();
      Alert.alert("Success", "Added to trip!");
    } catch (error) {
      console.error("Error adding to trip:", error);
      Alert.alert("Error", "Failed to add item to trip");
    }
  };

  const removeFromTrip = async (tripId: string, tripItemId: string) => {
    try {
      const { error } = await supabase
        .from("trip_items")
        .delete()
        .eq("id", tripItemId);

      if (error) throw error;

      // Recalculate trip dates if not locked
      const trip = trips.find((t) => t.id === tripId);
      if (trip && !trip.dates_locked) {
        // Get remaining items (excluding the one we just deleted)
        const remainingItems = (trip.items || []).filter(
          (item) => item.id !== tripItemId
        );

        if (remainingItems.length > 0) {
          const itemDates: Date[] = [];

          for (const item of remainingItems) {
            let itemDate: Date | null = null;

            if (item.type === "activity") {
              itemDate = item.data.activityDate
                ? new Date(item.data.activityDate)
                : item.data.activity_date
                ? new Date(item.data.activity_date)
                : item.data.startTime
                ? new Date(item.data.startTime)
                : item.data.start_time
                ? new Date(item.data.start_time)
                : null;
            } else if (item.type === "spot") {
              itemDate = item.data.locationDate
                ? new Date(item.data.locationDate)
                : item.data.location_date
                ? new Date(item.data.location_date)
                : item.data.timestamp
                ? new Date(item.data.timestamp)
                : null;
            }

            if (itemDate && !isNaN(itemDate.getTime())) {
              itemDates.push(itemDate);
            }
          }

          if (itemDates.length > 0) {
            const earliestDate = new Date(
              Math.min(...itemDates.map((d) => d.getTime()))
            );
            const latestDate = new Date(
              Math.max(...itemDates.map((d) => d.getTime()))
            );

            const tripStart = new Date(trip.start_date);
            const tripEnd = new Date(trip.end_date);

            // Only update if dates would actually change
            if (
              earliestDate.getTime() !== tripStart.getTime() ||
              latestDate.getTime() !== tripEnd.getTime()
            ) {
              // Normalize to avoid timezone shifts
              const normalizeToLocal = (d: Date) =>
                new Date(
                  d.getFullYear(),
                  d.getMonth(),
                  d.getDate(),
                  12,
                  0,
                  0,
                  0
                );

              await updateTrip(tripId, {
                start_date: normalizeToLocal(earliestDate),
                end_date: normalizeToLocal(latestDate),
              });
            }
          }
        }
      }

      await loadTrips();
    } catch (error) {
      console.error("Error removing from trip:", error);
      Alert.alert("Error", "Failed to remove item from trip");
    }
  };

  const tagFriend = async (tripId: string, friendId: string) => {
    try {
      const { error } = await supabase.from("trip_tags").insert({
        trip_id: tripId,
        user_id: friendId,
      });

      if (error) throw error;

      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId
            ? { ...t, tagged_friends: [...(t.tagged_friends || []), friendId] }
            : t
        )
      );
    } catch (error) {
      console.error("Error tagging friend:", error);
    }
  };

  const untagFriend = async (tripId: string, friendId: string) => {
    try {
      const { error } = await supabase
        .from("trip_tags")
        .delete()
        .eq("trip_id", tripId)
        .eq("user_id", friendId);

      if (error) throw error;
      await loadTrips();
    } catch (error) {
      console.error("Error untagging friend:", error);
      Alert.alert("Error", "Failed to untag friend");
    }
  };

  const mergeTripWithShared = async (tripId: string, sharedTripId: string) => {
    try {
      const { data: sharedItems, error: fetchError } = await supabase
        .from("trip_items")
        .select("*")
        .eq("trip_id", sharedTripId);

      if (fetchError) throw fetchError;

      for (const sharedItem of sharedItems || []) {
        const { data: existing } = await supabase
          .from("trip_items")
          .select("id")
          .eq("trip_id", tripId)
          .eq("type", sharedItem.type)
          .eq("data->>id", sharedItem.data.id)
          .single();

        if (!existing) {
          await supabase.from("trip_items").insert({
            trip_id: tripId,
            type: sharedItem.type,
            data: sharedItem.data,
            added_by: sharedItem.added_by,
          });
        }
      }

      const trip = trips.find((t) => t.id === tripId);
      const mergedFrom = [...(trip?.merged_from || []), sharedTripId];
      await updateTrip(tripId, { merged_from: mergedFrom });

      Alert.alert("Success", "Trips merged successfully!");
    } catch (error) {
      console.error("Error merging trips:", error);
      Alert.alert("Error", "Failed to merge trips");
    }
  };

  const getSharedTrips = (): Trip[] => {
    if (!currentUserId) return [];
    return trips.filter(
      (trip) =>
        trip.tagged_friends?.includes(currentUserId) &&
        trip.created_by !== currentUserId
    );
  };

  const getMyTrips = (): Trip[] => {
    if (!currentUserId) return [];
    return trips.filter((trip) => trip.created_by === currentUserId);
  };

  const canTripsBeJoined = (trip1: Trip, trip2: Trip): boolean => {
    const start1 = new Date(trip1.start_date).getTime();
    const end1 = new Date(trip1.end_date).getTime();
    const start2 = new Date(trip2.start_date).getTime();
    const end2 = new Date(trip2.end_date).getTime();

    const hasDateOverlap = start1 <= end2 && end1 >= start2;

    if (
      trip1.items &&
      trip1.items.length > 0 &&
      trip2.items &&
      trip2.items.length > 0
    ) {
      const hasLocationOverlap = trip1.items.some((item1) => {
        const loc1 =
          item1.data.location || (item1.data.route && item1.data.route[0]);
        if (!loc1) return false;

        return trip2.items!.some((item2) => {
          const loc2 =
            item2.data.location || (item2.data.route && item2.data.route[0]);
          return loc2 && areLocationsNearby(loc1, loc2, 100);
        });
      });

      return hasDateOverlap && hasLocationOverlap;
    }

    return hasDateOverlap;
  };

  const getSuggestedMerges = (): { autoTrip: Trip; sharedTrip: Trip }[] => {
    const suggestions: { autoTrip: Trip; sharedTrip: Trip }[] = [];

    if (!currentUserId) return suggestions;

    const myAutoTrips = trips.filter(
      (t) => t.created_by === currentUserId && t.auto_generated
    );

    const sharedWithMe = trips.filter(
      (t) =>
        t.tagged_friends?.includes(currentUserId) &&
        t.created_by !== currentUserId
    );

    for (const autoTrip of myAutoTrips) {
      for (const sharedTrip of sharedWithMe) {
        if (canTripsBeJoined(autoTrip, sharedTrip)) {
          suggestions.push({ autoTrip, sharedTrip });
        }
      }
    }

    return suggestions;
  };

  const runDetailedAutoDetection = async () => {
    if (
      !currentUserId ||
      !activities ||
      !savedSpots ||
      autoDetectionInProgress.current
    ) {
      return;
    }

    try {
      autoDetectionInProgress.current = true;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const allItems = [
        ...activities.map((a) => ({
          type: "activity" as const,
          data: a,
          date: a.activityDate || a.startTime,
          location: a.route?.[0] || null,
        })),
        ...savedSpots.map((s) => ({
          type: "spot" as const,
          data: s,
          date: s.locationDate || s.timestamp || new Date(),
          location: s.location,
        })),
      ].filter((item) => {
        if (!item.date) return false;
        const itemDate = new Date(item.date);
        return itemDate >= thirtyDaysAgo && itemDate <= now;
      });

      const itemsNotInTrips = [];
      for (const item of allItems) {
        const { data: existingTripItem } = await supabase
          .from("trip_items")
          .select("id")
          .eq("type", item.type)
          .eq("data->>id", item.data.id)
          .single();

        const { data: rejection } = await supabase
          .from("trip_items_rejection")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("item_id", item.data.id)
          .eq("item_type", item.type)
          .single();

        if (!existingTripItem && !rejection) {
          itemsNotInTrips.push(item);
        }
      }

      if (itemsNotInTrips.length === 0) {
        autoDetectionInProgress.current = false;
        return;
      }

      const clusters: TripCluster[] = [];

      for (const item of itemsNotInTrips) {
        let addedToCluster = false;

        for (const cluster of clusters) {
          const clusterStart = new Date(
            Math.min(
              ...cluster.items.map((i: any) => new Date(i.date).getTime())
            )
          );
          const clusterEnd = new Date(
            Math.max(
              ...cluster.items.map((i: any) => new Date(i.date).getTime())
            )
          );
          const itemDate = new Date(item.date);

          const daysBetween =
            Math.abs(clusterEnd.getTime() - clusterStart.getTime()) /
            (1000 * 60 * 60 * 24);
          const maxDaysForClustering = daysBetween <= 7 ? 7 : 14; // Changed from 2:7

          const expandedStart = new Date(clusterStart);
          expandedStart.setDate(expandedStart.getDate() - maxDaysForClustering);
          const expandedEnd = new Date(clusterEnd);
          expandedEnd.setDate(expandedEnd.getDate() + maxDaysForClustering);

          if (itemDate >= expandedStart && itemDate <= expandedEnd) {
            if (item.location && cluster.items.some((ci: any) => ci.location)) {
              const isNearby = cluster.items.some(
                (ci: any) =>
                  ci.location &&
                  areLocationsNearby(item.location, ci.location, 50)
              );
              if (isNearby) {
                cluster.items.push(item);
                addedToCluster = true;
                break;
              }
            } else if (
              !item.location ||
              cluster.items.every((ci: any) => !ci.location)
            ) {
              cluster.items.push(item);
              addedToCluster = true;
              break;
            }
          }
        }

        if (!addedToCluster) {
          clusters.push({
            id: `cluster-${Date.now()}-${Math.random()}`,
            suggestedName: "",
            startDate: new Date(item.date),
            endDate: new Date(item.date),
            items: [item],
            spotCount: 0,
            activityCount: 0,
          });
        }
      }

      const validClusters = clusters.filter((cluster) => {
        if (cluster.items.length < 2) {
          return false;
        }

        const clusterDates = cluster.items.map((i: any) => new Date(i.date));
        const earliestDate = new Date(
          Math.min(...clusterDates.map((d) => d.getTime()))
        );
        const latestDate = new Date(
          Math.max(...clusterDates.map((d) => d.getTime()))
        );
        const daySpan =
          Math.abs(latestDate.getTime() - earliestDate.getTime()) /
          (1000 * 60 * 60 * 24);

        if (daySpan <= 1) {
          const fourteenDaysAgo = new Date(
            now.getTime() - 14 * 24 * 60 * 60 * 1000
          );
          if (latestDate < fourteenDaysAgo) {
            return false;
          }
        }

        return true;
      });

      for (const cluster of validClusters) {
        const dates = cluster.items.map((i: any) => new Date(i.date));
        cluster.startDate = new Date(
          Math.min(...dates.map((d) => d.getTime()))
        );
        cluster.endDate = new Date(Math.max(...dates.map((d) => d.getTime())));
        cluster.spotCount = cluster.items.filter(
          (i: any) => i.type === "spot"
        ).length;
        cluster.activityCount = cluster.items.filter(
          (i: any) => i.type === "activity"
        ).length;

        const daySpan =
          Math.abs(cluster.endDate.getTime() - cluster.startDate.getTime()) /
          (1000 * 60 * 60 * 24);

        if (daySpan <= 1) {
          cluster.suggestedName = `Day Trip - ${cluster.startDate.toLocaleDateString()}`;
        } else if (daySpan <= 3) {
          cluster.suggestedName = `Weekend Trip - ${cluster.startDate.toLocaleDateString()}`;
        } else {
          const dateRange = `${cluster.startDate.toLocaleDateString()} - ${cluster.endDate.toLocaleDateString()}`;
          cluster.suggestedName = `Trip ${dateRange}`;
        }

        cluster.totalDistance = cluster.items
          .filter((i: any) => i.type === "activity" && i.data.distance)
          .reduce((sum: number, i: any) => sum + (i.data.distance || 0), 0);
      }

      if (validClusters.length > 0) {
        setPendingClusters((prev) => [...prev, ...validClusters]);
      } else {
        console.log("❌ No valid clusters to add");
      }

      autoDetectionInProgress.current = false;
    } catch (error) {
      console.error("💥 Error in detailed auto-detection:", error);
      autoDetectionInProgress.current = false;
    }
  };
  // Add this function to manually show pending clusters
  const showPendingClusters = async () => {
    if (pendingClusters.length > 0) {
      await showTripSelectionUI(pendingClusters);
      setPendingClusters([]); // Clear after showing
    } else {
      // If no pending clusters, run detection first
      await runDetailedAutoDetection();
      // Then show any newly detected clusters
      if (pendingClusters.length > 0) {
        await showTripSelectionUI(pendingClusters);
        setPendingClusters([]);
      } else {
        Alert.alert(
          "No trips to organize",
          "All your adventures are already organized into trips!"
        );
      }
    }
  };

  const showTripSelectionUI = async (clusters: TripCluster[]) => {
    let currentIndex = 0;
    const selectedClusters: TripCluster[] = [];

    const checkIfClusterRejected = async (
      cluster: TripCluster
    ): Promise<boolean> => {
      if (!currentUserId) return false;

      try {
        const itemIds = cluster.items.map((item) => item.data.id);

        const { data: rejections, error } = await supabase
          .from("trip_item_rejections")
          .select("item_id")
          .eq("user_id", currentUserId)
          .in("item_id", itemIds);

        if (error) {
          console.error("Error checking rejections:", error);
          return false;
        }

        return rejections && rejections.length > 0;
      } catch (error) {
        console.error("Error in checkIfClusterRejected:", error);
        return false;
      }
    };

    const rejectCluster = async (cluster: TripCluster) => {
      if (!currentUserId) return;

      try {
        for (const item of cluster.items) {
          const { error } = await supabase
            .from("trip_item_rejections")
            .insert({
              user_id: currentUserId,
              item_id: item.data.id,
              item_type: item.type,
              trip_id: null,
              rejected_at: new Date().toISOString(),
            })
            .select();

          if (error) {
            if (!error.message.includes("duplicate")) {
              console.error(`Error rejecting item ${item.data.id}:`, error);
            }
          } else {
            console.log(`Rejected item ${item.data.id}`);
          }
        }
      } catch (error) {
        console.error("Error storing cluster rejections:", error);
      }
    };

    const showNextCluster = async () => {
      while (currentIndex < clusters.length) {
        const cluster = clusters[currentIndex];
        const isRejected = await checkIfClusterRejected(cluster);

        if (!isRejected) {
          break;
        }

        currentIndex++;
      }

      if (currentIndex >= clusters.length) {
        if (selectedClusters.length === 0) {
          autoDetectionInProgress.current = false;
          return;
        }
        finalizeTripCreation(selectedClusters);
        return;
      }

      const cluster = clusters[currentIndex];
      const itemList = cluster.items
        .slice(0, 5)
        .map((item: any) => {
          const name =
            item.data.name || item.data.description || "Unnamed item";
          const type = item.type === "activity" ? "🏃" : "📍";
          const date = new Date(item.date).toLocaleDateString();
          return `${type} ${name} (${date})`;
        })
        .join("\n");

      const moreItems =
        cluster.items.length > 5
          ? `\n... and ${cluster.items.length - 5} more items`
          : "";

      const message =
        `📅 ${cluster.suggestedName}\n` +
        `📊 ${cluster.spotCount} spots, ${cluster.activityCount} activities\n` +
        `${
          cluster.totalDistance
            ? `🏃 Total distance: ${(cluster.totalDistance / 1000).toFixed(
                1
              )}km\n`
            : ""
        }` +
        `\nItems:\n${itemList}${moreItems}`;

      const remainingCount = clusters.length - currentIndex;
      const title =
        remainingCount > 1
          ? `Trip ${currentIndex + 1} of ${clusters.length}`
          : "Suggested Trip";

      Alert.alert(title, message, [
        {
          text: "Don't Ask Again",
          style: "destructive",
          onPress: async () => {
            await rejectCluster(cluster);
            currentIndex++;
            showNextCluster();
          },
        },
        {
          text: "Skip For Now",
          style: "cancel",
          onPress: () => {
            currentIndex++;
            showNextCluster();
          },
        },
        {
          text: "Create Trip",
          style: "default",
          onPress: () => {
            selectedClusters.push(cluster);
            currentIndex++;
            showNextCluster();
          },
        },
      ]);
    };

    const finalizeTripCreation = async (selected: TripCluster[]) => {
      if (selected.length === 0) {
        autoDetectionInProgress.current = false;
        return;
      }

      try {
        for (const cluster of selected) {
          const newTrip = await createTrip({
            name: cluster.suggestedName,
            start_date: cluster.startDate,
            end_date: cluster.endDate,
            created_by: currentUserId!,
            auto_generated: true,
            tagged_friends: [],
          });

          for (const item of cluster.items) {
            await supabase.from("trip_items").insert({
              trip_id: newTrip.id,
              type: item.type,
              data: item.data,
              added_by: currentUserId,
            });
          }
        }

        await loadTrips();
        Alert.alert(
          "Success",
          `Created ${selected.length} trip${selected.length > 1 ? "s" : ""}!`
        );
      } catch (error) {
        console.error("Error creating trips:", error);
        Alert.alert("Error", "Failed to create some trips");
      } finally {
        autoDetectionInProgress.current = false;
      }
    };

    showNextCluster();
  };

  const clearTripRejections = async (itemIds?: string[]) => {
    if (!currentUserId) return;

    try {
      let query = supabase
        .from("trip_item_rejections")
        .delete()
        .eq("user_id", currentUserId);

      if (itemIds && itemIds.length > 0) {
        query = query.in("item_id", itemIds);
      }

      const { error } = await query;

      if (error) throw error;
    } catch (error) {
      console.error("Error clearing rejections:", error);
    }
  };

  const runAutoDetection = async () => {
    await runDetailedAutoDetection();
  };

  return (
    <TripContext.Provider
      value={{
        trips,
        currentUserId,
        loading,
        createTrip,
        updateTrip,
        deleteTrip,
        addToTrip,
        removeFromTrip,
        tagFriend,
        untagFriend,
        mergeTripWithShared,
        getSharedTrips,
        getMyTrips,
        runAutoDetection,
        runDetailedAutoDetection,
        refreshTrips,
        canTripsBeJoined,
        getSuggestedMerges,
        triggerAutoDetection,
        checkForAutoTrip,
        smartAddToTrip,
        calculateDistance,
        fixAllTripPhotos,
        showPendingClusters,
      }}
    >
      {children}
    </TripContext.Provider>
  );
};

export const useTrips = () => {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error("useTrips must be used within a TripProvider");
  }
  return context;
};
