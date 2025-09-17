// contexts/TripContext.tsx
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
  refreshTrips: () => Promise<void>;
  canTripsBeJoined: (trip1: Trip, trip2: Trip) => boolean;
  getSuggestedMerges: () => { autoTrip: Trip; sharedTrip: Trip }[];
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

  // Run auto-detection periodically
  useEffect(() => {
    if (
      currentUserId &&
      !hasRunAutoDetection.current &&
      !loading &&
      trips.length === 0 &&
      (activities?.length > 0 || savedSpots?.length > 0)
    ) {
      hasRunAutoDetection.current = true;
      setTimeout(() => {
        runAutoDetection();
      }, 1000);
    }
  }, [
    currentUserId,
    loading,
    trips.length,
    activities?.length,
    savedSpots?.length,
  ]);

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
    if (!currentUserId) return;

    try {
      setLoading(true);

      // Get trips created by user
      const { data: myTrips, error: myTripsError } = await supabase
        .from("trips")
        .select(
          `
          *,
          trip_items (
            id,
            trip_id,
            type,
            data,
            added_at,
            added_by
          ),
          trip_tags (
            user_id
          )
        `
        )
        .eq("created_by", currentUserId);

      if (myTripsError) throw myTripsError;

      // Get trips where user is tagged
      const { data: tagData } = await supabase
        .from("trip_tags")
        .select("trip_id")
        .eq("user_id", currentUserId);

      let taggedTrips: any[] = [];
      if (tagData && tagData.length > 0) {
        const taggedTripIds = tagData.map((t) => t.trip_id);

        const { data: taggedTripsData, error: taggedError } = await supabase
          .from("trips")
          .select(
            `
            *,
            trip_items (
              id,
              trip_id,
              type,
              data,
              added_at,
              added_by
            ),
            trip_tags (
              user_id
            )
          `
          )
          .in("id", taggedTripIds)
          .neq("created_by", currentUserId);

        if (taggedError && taggedError.code !== "PGRST116") throw taggedError;
        taggedTrips = taggedTripsData || [];
      }

      // Combine and format trips
      const allTrips = [...(myTrips || []), ...taggedTrips];

      const formattedTrips: Trip[] = allTrips.map((trip) => ({
        id: trip.id,
        name: trip.name,
        start_date: new Date(trip.start_date),
        end_date: new Date(trip.end_date),
        items:
          trip.trip_items?.map((item: any) => ({
            ...item,
            added_at: new Date(item.added_at),
          })) || [],
        cover_photo: trip.cover_photo,
        created_at: new Date(trip.created_at),
        created_by: trip.created_by,
        tagged_friends: trip.trip_tags?.map((tag: any) => tag.user_id) || [],
        auto_generated: trip.auto_generated,
        merged_from: trip.merged_from,
      }));

      setTrips(formattedTrips);
    } catch (error) {
      console.error("Error loading trips:", error);
      Alert.alert("Error", "Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  const refreshTrips = async () => {
    await loadTrips();
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
          throw tagError;
        }
      }

      await loadTrips();
      return {
        ...data,
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date),
        created_at: new Date(data.created_at),
        items: [],
        tagged_friends: tripData.tagged_friends || [],
      };
    } catch (error) {
      console.error("Error creating trip:", error);
      Alert.alert("Error", "Failed to create trip");
      throw error;
    }
  };

  const updateTrip = async (tripId: string, updates: Partial<Trip>) => {
    try {
      console.log("updateTrip called with:", { tripId, updates });

      const updateData: any = {};

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.start_date !== undefined) {
        updateData.start_date =
          updates.start_date instanceof Date
            ? updates.start_date.toISOString()
            : updates.start_date;
        console.log("Setting start_date to:", updateData.start_date);
      }
      if (updates.end_date !== undefined) {
        updateData.end_date =
          updates.end_date instanceof Date
            ? updates.end_date.toISOString()
            : updates.end_date;
        console.log("Setting end_date to:", updateData.end_date);
      }

      console.log("Final updateData being sent to Supabase:", updateData);

      const { data, error } = await supabase
        .from("trips")
        .update(updateData)
        .eq("id", tripId)
        .select(); // Add .select() to see what comes back

      console.log("Supabase response:", { data, error });

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
            throw tagError;
          }
        }
      }

      await loadTrips();
    } catch (error) {
      console.error("Error updating trip:", error);
      Alert.alert("Error", "Failed to update trip");
    }
  };

  const deleteTrip = async (tripId: string) => {
    try {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;
      await loadTrips();
    } catch (error) {
      console.error("Error deleting trip:", error);
      Alert.alert("Error", "Failed to delete trip");
    }
  };

  const addToTrip = async (
    tripId: string,
    item: any,
    type: "activity" | "spot"
  ) => {
    if (!currentUserId) return;

    try {
      const { data: existing } = await supabase
        .from("trip_items")
        .select("id")
        .eq("trip_id", tripId)
        .eq("type", type)
        .eq("data->>id", item.id)
        .single();

      if (existing) {
        Alert.alert("Already Added", "This item is already in the trip");
        return;
      }

      const { error } = await supabase.from("trip_items").insert({
        trip_id: tripId,
        type,
        data: item,
        added_by: currentUserId,
      });

      if (error) throw error;

      // Auto-adjust trip dates if the new item falls outside current range
      const trip = trips.find((t) => t.id === tripId);
      if (trip) {
        let itemDate: Date | null = null;

        if (type === "activity" && item.activityDate) {
          itemDate = new Date(item.activityDate);
        } else if (type === "spot" && (item.locationDate || item.timestamp)) {
          itemDate = new Date(item.locationDate || item.timestamp);
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
            await updateTrip(tripId, {
              start_date: newStartDate,
              end_date: newEndDate,
            });
          }
        }
      }

      await loadTrips();
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
      const { data: existing } = await supabase
        .from("trip_tags")
        .select("*")
        .eq("trip_id", tripId)
        .eq("user_id", friendId)
        .single();

      if (existing) {
        Alert.alert(
          "Already Tagged",
          "This friend is already tagged in the trip"
        );
        return;
      }

      const { error } = await supabase.from("trip_tags").insert({
        trip_id: tripId,
        user_id: friendId,
      });

      if (error) throw error;
      await loadTrips();
    } catch (error) {
      console.error("Error tagging friend:", error);
      Alert.alert("Error", "Failed to tag friend");
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
    const hasLocationOverlap = true; // Simplified for now

    return hasDateOverlap && hasLocationOverlap;
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

  const runAutoDetection = async () => {
    if (!currentUserId || !activities || !savedSpots) return;

    try {
      console.log("Running trip auto-detection...");

      const detectedTrips = TripDetector.detectTrips(
        activities,
        savedSpots,
        trips
      );

      for (const detectedTrip of detectedTrips) {
        const newTrip = await createTrip({
          name: detectedTrip.name,
          start_date: detectedTrip.start_date,
          end_date: detectedTrip.end_date,
          cover_photo: detectedTrip.cover_photo,
          created_by: currentUserId,
          auto_generated: true,
          tagged_friends: [],
        });

        for (const item of detectedTrip.items) {
          await addToTrip(newTrip.id, item.data, item.type);
        }
      }

      if (detectedTrips.length > 0) {
        console.log(`Auto-detected and created ${detectedTrips.length} trips`);
        Alert.alert(
          "Trips Detected!",
          `Found ${detectedTrips.length} potential trip${
            detectedTrips.length > 1 ? "s" : ""
          } from your activities and saved spots.`
        );
      }
    } catch (error) {
      console.error("Error in auto-detection:", error);
    }
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
        refreshTrips,
        canTripsBeJoined,
        getSuggestedMerges,
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
