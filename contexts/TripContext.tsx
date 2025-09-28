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
  created_at: Date;
  created_by: string;
  tagged_friends?: string[];
  auto_generated?: boolean;
  merged_from?: string[];
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

  // Helper function to calculate distance between two locations
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const areLocationsNearby = (
    loc1: any,
    loc2: any,
    thresholdKm: number = 50
  ): boolean => {
    if (!loc1 || !loc2) return false;
    const distance = calculateDistance(
      loc1.latitude,
      loc1.longitude,
      loc2.latitude,
      loc2.longitude
    );
    return distance <= thresholdKm;
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
          console.log("Trip change detected:", payload);
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
          console.log("Trip tag change detected:", payload);
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
        tagged_friends: tagsByTrip[trip.id] || [],
        items: itemsByTrip[trip.id] || [],
        created_at: trip.created_at,
        merged_from: trip.merged_from || [],
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
      console.log("Item already in trip:", existingTripItem.trip_id);
      return null; // Don't add to any trip if already in one
    }

    // Check if location is near home (if configured)
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("home_location, home_radius")
        .eq("id", user.id)
        .single();

      if (profile?.home_location) {
        const homeRadius = profile.home_radius || 2; // Default 2km
        const itemLocation = item.location || (item.route && item.route[0]);
        if (itemLocation) {
          const distanceFromHome = calculateDistance(
            itemLocation.latitude,
            itemLocation.longitude,
            profile.home_location.latitude,
            profile.home_location.longitude
          );

          if (distanceFromHome <= homeRadius) {
            console.log("Item is within home area, not suggesting trip");
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
      // Skip old trips (older than 90 days)
      const tripAge = Math.abs(now.getTime() - trip.end_date.getTime());
      const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
      if (tripAge > maxAge) return false;

      // Check date proximity (within 7 days)
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

      // Check location proximity if we have location data
      if (itemLocation && trip.items && trip.items.length > 0) {
        // Check if any item in the trip is nearby (within 100km)
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

      // If no location data or empty trip, just use date
      return isDateNearby;
    });

    if (candidateTrips.length > 0) {
      console.log("Found existing trip for item based on date/location");
      return candidateTrips[0];
    }

    // No matching trip exists - ASK USER before creating a new one
    console.log("No matching trip found, asking user about creating new trip");

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

      // Add tagged friends if any
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

      // Update local state immediately
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

      const { error } = await supabase
        .from("trips")
        .update(updateData)
        .eq("id", tripId);

      if (error) throw error;

      // Handle tagged_friends updates
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

      // UPDATE LOCAL STATE IMMEDIATELY
      setTrips((prevTrips) =>
        prevTrips.map((trip) =>
          trip.id === tripId
            ? {
                ...trip,
                ...updates,
                // Ensure dates are Date objects in local state
                start_date: updates.start_date || trip.start_date,
                end_date: updates.end_date || trip.end_date,
              }
            : trip
        )
      );

      // Optional: Still reload from database to ensure consistency
      await loadTrips();
    } catch (error) {
      console.error("Error updating trip:", error);
      Alert.alert("Error", "Failed to update trip");
    }
  };

  const deleteTrip = async (tripId: string) => {
    try {
      // First delete all trip items
      await supabase.from("trip_items").delete().eq("trip_id", tripId);

      // Delete trip tags
      await supabase.from("trip_tags").delete().eq("trip_id", tripId);

      // Delete the trip itself
      const { error } = await supabase.from("trips").delete().eq("id", tripId);

      if (error) throw error;

      // Update local state
      setTrips((prev) => prev.filter((t) => t.id !== tripId));

      Alert.alert("Success", "Trip deleted successfully");
    } catch (error) {
      console.error("Error deleting trip:", error);
      Alert.alert("Error", "Failed to delete trip");
      throw error;
    }
  };

  const addToTrip = async (
    tripId: string,
    itemData: any,
    itemType: "activity" | "spot"
  ) => {
    if (!currentUserId) return;

    let targetTripId = tripId;

    // If tripId is 'auto', check for or create auto-trip
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

      const { error } = await supabase.from("trip_items").insert({
        trip_id: targetTripId,
        type: itemType,
        data: itemData,
        added_by: currentUserId,
      });

      if (error) throw error;

      // Auto-adjust trip dates if the new item falls outside current range
      const trip = trips.find((t) => t.id === targetTripId);
      if (trip) {
        let itemDate: Date | null = null;

        if (itemType === "activity" && itemData.activityDate) {
          itemDate = new Date(itemData.activityDate);
        } else if (
          itemType === "spot" &&
          (itemData.locationDate || itemData.timestamp)
        ) {
          itemDate = new Date(itemData.locationDate || itemData.timestamp);
        }

        if (itemDate) {
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
            await updateTrip(targetTripId, {
              start_date: newStartDate,
              end_date: newEndDate,
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

    // Check location overlap if both trips have items
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
          return loc2 && areLocationsNearby(loc1, loc2, 100); // 100km threshold for merging
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

  // Enhanced auto-detection with detailed trip information
  const runDetailedAutoDetection = async () => {
    if (
      !currentUserId ||
      !activities ||
      !savedSpots ||
      autoDetectionInProgress.current
    ) {
      console.log("Exiting runDetailedAutoDetection early");
      return;
    }

    try {
      autoDetectionInProgress.current = true;
      console.log("Running detailed trip auto-detection...");

      // Combine all items with dates and locations
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
      ].filter((item) => item.date);

      // Check which items are already in trips
      const itemsNotInTrips = [];
      for (const item of allItems) {
        const { data: existingTripItem } = await supabase
          .from("trip_items")
          .select("id")
          .eq("type", item.type)
          .eq("data->>id", item.data.id)
          .single();

        if (!existingTripItem) {
          itemsNotInTrips.push(item);
        }
      }

      console.log(`Found ${itemsNotInTrips.length} items not in any trip`);

      if (itemsNotInTrips.length === 0) {
        console.log("All items already in trips");
        autoDetectionInProgress.current = false;
        return;
      }

      // Create enhanced clusters with more details
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

          // Check if item date is within 7 days of cluster
          const expandedStart = new Date(clusterStart);
          expandedStart.setDate(expandedStart.getDate() - 7);
          const expandedEnd = new Date(clusterEnd);
          expandedEnd.setDate(expandedEnd.getDate() + 7);

          if (itemDate >= expandedStart && itemDate <= expandedEnd) {
            // Check location proximity
            if (item.location) {
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
            } else {
              // No location, just use date proximity
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

      // Enhance clusters with metadata
      for (const cluster of clusters) {
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

        // Generate a suggested name
        const dateRange =
          cluster.startDate.toDateString() === cluster.endDate.toDateString()
            ? cluster.startDate.toLocaleDateString()
            : `${cluster.startDate.toLocaleDateString()} - ${cluster.endDate.toLocaleDateString()}`;
        cluster.suggestedName = `Trip ${dateRange}`;

        // Try to identify primary location (most common location area)
        const locations = cluster.items
          .filter((i: any) => i.location)
          .map((i: any) => i.location);
        if (locations.length > 0) {
          // Simple approach: use the first location's general area
          // You could enhance this with reverse geocoding
          cluster.primaryLocation = "Multiple locations";
        }

        // Calculate total distance for activities
        cluster.totalDistance = cluster.items
          .filter((i: any) => i.type === "activity" && i.data.distance)
          .reduce((sum: number, i: any) => sum + (i.data.distance || 0), 0);
      }

      console.log(`Created ${clusters.length} enhanced trip clusters`);

      if (clusters.length === 0) {
        autoDetectionInProgress.current = false;
        return;
      }

      // Show individual trip selection
      await showTripSelectionUI(clusters);
    } catch (error) {
      console.error("Error in detailed auto-detection:", error);
      autoDetectionInProgress.current = false;
    }
  };

  // Fixed showTripSelectionUI function for TripContext.tsx
  // This properly stores rejections without requiring a trip_id

  const showTripSelectionUI = async (clusters: TripCluster[]) => {
    let currentIndex = 0;
    const selectedClusters: TripCluster[] = [];

    // First, we need to modify the trip_item_rejections table to make trip_id optional
    // Run this SQL in Supabase:
    /*
  ALTER TABLE trip_item_rejections 
  DROP CONSTRAINT trip_item_rejections_trip_id_fkey;
  
  ALTER TABLE trip_item_rejections 
  ALTER COLUMN trip_id DROP NOT NULL;
  
  -- Update the unique constraint to work without trip_id for cluster rejections
  ALTER TABLE trip_item_rejections 
  DROP CONSTRAINT trip_item_rejections_user_id_item_id_item_type_trip_id_key;
  
  ALTER TABLE trip_item_rejections 
  ADD CONSTRAINT trip_item_rejections_unique 
  UNIQUE(user_id, item_id, item_type);
  */

    // Check if any items in cluster were previously rejected
    const checkIfClusterRejected = async (
      cluster: TripCluster
    ): Promise<boolean> => {
      if (!currentUserId) return false;

      try {
        // Get all item IDs from the cluster
        const itemIds = cluster.items.map((item) => item.data.id);

        // Check if ANY of these items were rejected
        const { data: rejections, error } = await supabase
          .from("trip_item_rejections")
          .select("item_id")
          .eq("user_id", currentUserId)
          .in("item_id", itemIds);

        if (error) {
          console.error("Error checking rejections:", error);
          return false;
        }

        // If we found any rejections, skip this cluster
        return rejections && rejections.length > 0;
      } catch (error) {
        console.error("Error in checkIfClusterRejected:", error);
        return false;
      }
    };

    // Store rejection for all items in a cluster
    const rejectCluster = async (cluster: TripCluster) => {
      if (!currentUserId) return;

      console.log(`Rejecting cluster with ${cluster.items.length} items`);

      try {
        // Insert each item rejection individually
        for (const item of cluster.items) {
          const { error } = await supabase
            .from("trip_item_rejections")
            .insert({
              user_id: currentUserId,
              item_id: item.data.id,
              item_type: item.type,
              trip_id: null, // No specific trip, just rejecting the auto-detection
              rejected_at: new Date().toISOString(),
            })
            .select(); // Add select to see if insert succeeded

          if (error) {
            // If already exists, that's fine
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
      // Skip already rejected clusters
      while (currentIndex < clusters.length) {
        const cluster = clusters[currentIndex];
        const isRejected = await checkIfClusterRejected(cluster);

        if (!isRejected) {
          break; // Found a non-rejected cluster to show
        }

        console.log(`Skipping previously rejected cluster ${currentIndex + 1}`);
        currentIndex++;
      }

      if (currentIndex >= clusters.length) {
        // All clusters reviewed or rejected
        if (selectedClusters.length === 0) {
          console.log("No trips to create (all rejected or skipped)");
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
            // Store rejection for all items in this cluster
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

    // Helper function to create selected trips
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

          // Add all items to the trip
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

    // Start the selection process
    showNextCluster();
  };

  // Add this helper function to the TripContext to clear rejections if needed
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
      console.log("Cleared trip rejections");
    } catch (error) {
      console.error("Error clearing rejections:", error);
    }
  };
  // Keep the original runAutoDetection for backward compatibility
  const runAutoDetection = async () => {
    // Redirect to the enhanced version
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
