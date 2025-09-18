// services/friendDataService.ts
import { Activity } from "../contexts/ActivityContext";
import { SavedSpot } from "../contexts/LocationContext";
import { supabase } from "../lib/supabase";

export class FriendDataService {
  /**
   * Load a friend's activities from the database
   */
  static async loadFriendActivities(friendId: string): Promise<Activity[]> {
    try {
      console.log("Loading activities for friend:", friendId);

      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", friendId)
        .order("start_time", { ascending: false });

      if (error) {
        console.error("Error loading friend activities:", error);
        throw error;
      }

      if (!data) return [];

      // Transform database format to app format
      const activities: Activity[] = data.map((act) => ({
        id: act.id,
        type: act.type,
        name: act.name,
        startTime: new Date(act.start_time),
        endTime: new Date(act.end_time),
        duration: act.duration,
        distance: act.distance,
        route: act.route || [],
        averageSpeed: act.average_speed,
        maxSpeed: act.max_speed,
        elevationGain: act.elevation_gain,
        notes: act.notes,
        photos: act.photos || [],
        isManualEntry: act.is_manual_entry,
        activityDate: new Date(act.activity_date || act.start_time), // ADD THIS
        createdAt: new Date(act.created_at || act.start_time),
      }));

      return activities;
    } catch (error) {
      console.error("Error loading friend activities:", error);
      return [];
    }
  }

  /**
   * Load a friend's saved locations from the database
   */
  static async loadFriendLocations(friendId: string): Promise<SavedSpot[]> {
    try {
      console.log("Loading locations for friend:", friendId);

      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("user_id", friendId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading friend locations:", error);
        throw error;
      }

      if (!data) return [];

      // Transform database format to app format
      const locations: SavedSpot[] = data.map((spot) => ({
        id: spot.id,
        name: spot.name,
        location: {
          latitude: spot.latitude,
          longitude: spot.longitude,
        },
        photos: spot.photos || [],
        timestamp: new Date(spot.created_at),
        description: spot.description,
        category: spot.category,
        rating: spot.rating,
        locationDate: new Date(spot.location_date || spot.created_at), // ADD THIS

        // reviews: spot.reviews || [], // Removed - column doesn't exist
      }));
      return locations;
    } catch (error) {
      console.error("Error loading friend locations:", error);
      return [];
    }
  }

  /**
   * Load friend's profile statistics
   */
  static async loadFriendStats(friendId: string) {
    try {
      // Get counts in parallel
      const [activitiesCount, locationsCount] = await Promise.all([
        supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("user_id", friendId),
        supabase
          .from("locations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", friendId),
      ]);

      return {
        totalActivities: activitiesCount.count || 0,
        totalLocations: locationsCount.count || 0,
      };
    } catch (error) {
      console.error("Error loading friend stats:", error);
      return {
        totalActivities: 0,
        totalLocations: 0,
      };
    }
  }

  /**
   * Check privacy settings between two users
   */
  static async checkPrivacySettings(currentUserId: string, friendId: string) {
    try {
      // Check if they are actually friends
      const { data: friendship } = await supabase
        .from("friendships")
        .select("*")
        .or(
          `and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`
        )
        .eq("status", "accepted")
        .single();

      if (!friendship) {
        return {
          canViewActivities: false,
          canViewLocations: false,
          canViewFullRoute: false,
        };
      }

      // Get friend's privacy settings
      const { data: friendProfile } = await supabase
        .from("profiles")
        .select("privacy_settings")
        .eq("id", friendId)
        .single();

      const privacySettings = friendProfile?.privacy_settings || {};

      return {
        canViewActivities: privacySettings.share_activities !== false,
        canViewLocations: privacySettings.share_locations !== false,
        canViewFullRoute: false, // Default to false for privacy
      };
    } catch (error) {
      console.error("Error checking privacy settings:", error);
      return {
        canViewActivities: true,
        canViewLocations: true,
        canViewFullRoute: false,
      };
    }
  }
}
