// hooks/useFriendProfile.ts

import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Activity } from "../contexts/ActivityContext";
import { useAuth } from "../contexts/AuthContext";
import { Friend, useFriends } from "../contexts/FriendsContext";
import { SavedSpot, useLocation } from "../contexts/LocationContext";
import { supabase } from "../lib/supabase";
import { FriendDataService } from "../services/friendDataService";

interface FriendStats {
  totalActivities: number;
  totalLocations: number;
  totalTrips: number;
}

interface UseFriendProfileReturn {
  // Friend data
  friend: Friend | undefined;
  friendActivities: Activity[];
  friendLocations: SavedSpot[];
  friendTrips: any[];
  friendStats: FriendStats;

  // Mutual data
  mutualFriends: Friend[];
  mutualTrips: any[];
  mutualActivities: Activity[];
  mutualSpots: SavedSpot[];

  // State
  loadingData: boolean;

  // Actions
  handleRemoveFriend: () => void;
  handleBlockUser: () => void;
}

export function useFriendProfile(
  friendId: string,
  onRemoveSuccess: () => void
): UseFriendProfileReturn {
  const { user } = useAuth();
  const { friends, removeFriend, blockUser } = useFriends();
  const { savedSpots } = useLocation();

  const [friendActivities, setFriendActivities] = useState<Activity[]>([]);
  const [friendLocations, setFriendLocations] = useState<SavedSpot[]>([]);
  const [friendTrips, setFriendTrips] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [friendStats, setFriendStats] = useState<FriendStats>({
    totalActivities: 0,
    totalLocations: 0,
    totalTrips: 0,
  });
  const [mutualFriends, setMutualFriends] = useState<Friend[]>([]);
  const [mutualTrips, setMutualTrips] = useState<any[]>([]);
  const [mutualActivities, setMutualActivities] = useState<Activity[]>([]);

  const friend = friends.find((f) => f.id === friendId);

  useEffect(() => {
    if (friend && user && friends.length > 0) {
      loadFriendData();
      loadMutualFriends();
    }
  }, [friend?.id, friends.length, user?.id]);

  // Load mutual data after friend activities are loaded
  useEffect(() => {
    if (friend && user && friendActivities.length >= 0) {
      loadMutualData();
    }
  }, [friend?.id, user?.id, friendActivities]);

  const loadFriendData = async () => {
    if (!friend) return;

    setLoadingData(true);
    try {
      const [activities, locations, stats] = await Promise.all([
        FriendDataService.loadFriendActivities(friend.id),
        FriendDataService.loadFriendLocations(friend.id),
        FriendDataService.loadFriendStats(friend.id),
      ]);

      // Load friend's trips (created by them OR shared with them)
      const { data: createdTrips } = await supabase
        .from("trips")
        .select(
          `
          *,
          trip_items (
            id,
            type,
            data
          )
        `
        )
        .eq("created_by", friend.id)
        .order("start_date", { ascending: false });

      // Also get trips shared with them
      const { data: sharedTripTags } = await supabase
        .from("trip_tags")
        .select("trip_id")
        .eq("user_id", friend.id);

      let trips = createdTrips || [];

      if (sharedTripTags && sharedTripTags.length > 0) {
        const sharedTripIds = sharedTripTags.map((t) => t.trip_id);
        const { data: sharedTrips } = await supabase
          .from("trips")
          .select(
            `
            *,
            trip_items (
              id,
              type,
              data
            )
          `
          )
          .in("id", sharedTripIds)
          .order("start_date", { ascending: false });

        if (sharedTrips) {
          // Merge and deduplicate
          const tripIds = new Set(trips.map((t) => t.id));
          sharedTrips.forEach((trip) => {
            if (!tripIds.has(trip.id)) {
              trips.push(trip);
            }
          });
          // Re-sort by start_date
          trips.sort(
            (a, b) =>
              new Date(b.start_date).getTime() -
              new Date(a.start_date).getTime()
          );
        }
      }

      setFriendActivities(activities);
      setFriendLocations(locations);
      setFriendTrips(trips || []);
      setFriendStats({
        ...stats,
        totalTrips: trips?.length || 0,
      });
    } catch (error) {
      console.error("Error loading friend data:", error);
      Alert.alert("Error", "Failed to load friend data");
    } finally {
      setLoadingData(false);
    }
  };

  const loadMutualFriends = async () => {
    if (!friend || !user) return;

    try {
      const { data: friendsFriendships } = await supabase
        .from("friendships")
        .select("user_id, friend_id, status")
        .or(`user_id.eq.${friend.id},friend_id.eq.${friend.id}`)
        .eq("status", "accepted");

      if (!friendsFriendships) return;

      const profileFriendIds = new Set<string>();
      friendsFriendships.forEach((f) => {
        if (f.user_id === friend.id) {
          profileFriendIds.add(f.friend_id);
        } else if (f.friend_id === friend.id) {
          profileFriendIds.add(f.user_id);
        }
      });

      profileFriendIds.delete(user.id);

      const mutuals = friends.filter(
        (f) => f.id !== friend.id && profileFriendIds.has(f.id)
      );

      setMutualFriends(mutuals);
    } catch (error) {
      console.error("Error loading mutual friends:", error);
    }
  };

  const loadMutualData = async () => {
    if (!friend || !user) return;

    try {
      // Get all trips and their items
      const { data: allTrips, error } = await supabase.from("trips").select(`
          *,
          trip_items (
            id,
            type,
            data,
            added_by
          )
        `);

      if (error || !allTrips) return;

      // Find trips that have items from both users
      const sharedTrips = allTrips.filter((trip) => {
        const addedByUsers = new Set(
          trip.trip_items.map((item: any) => item.added_by)
        );
        return addedByUsers.has(user.id) && addedByUsers.has(friend.id);
      });

      setMutualTrips(sharedTrips);

      // Get activities from mutual trips
      const mutualActivityIds = new Set();
      sharedTrips.forEach((trip) => {
        trip.trip_items.forEach((item: any) => {
          if (item.type === "activity") {
            mutualActivityIds.add(item.data.id);
          }
        });
      });

      // Filter friend's activities that are in mutual trips
      const sharedActivities = friendActivities.filter((activity) =>
        mutualActivityIds.has(activity.id)
      );

      setMutualActivities(sharedActivities);
    } catch (error) {
      console.error("Error loading mutual data:", error);
    }
  };

  // Calculate mutual spots
  const mutualSpots = savedSpots.filter((mySpot) =>
    friendLocations.some(
      (friendLoc) =>
        Math.abs(friendLoc.location.latitude - mySpot.location.latitude) <
          0.001 &&
        Math.abs(friendLoc.location.longitude - mySpot.location.longitude) <
          0.001
    )
  );

  const handleRemoveFriend = () => {
    if (!friend) return;
    
    Alert.alert(
      "Remove Friend",
      `Are you sure you want to remove ${friend.displayName} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await removeFriend(friend.id);
            onRemoveSuccess();
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    if (!friend) return;
    
    Alert.alert(
      "Block User",
      `Are you sure you want to block ${friend.displayName}? They won't be able to see your content or send you friend requests.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            await blockUser(friend.id);
            onRemoveSuccess();
          },
        },
      ]
    );
  };

  return {
    friend,
    friendActivities,
    friendLocations,
    friendTrips,
    friendStats,
    mutualFriends,
    mutualTrips,
    mutualActivities,
    mutualSpots,
    loadingData,
    handleRemoveFriend,
    handleBlockUser,
  };
}