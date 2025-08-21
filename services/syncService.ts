// services/syncService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { supabase } from "../lib/supabase";

export interface SyncStatus {
  lastSync: string | null;
  pending: {
    activities: number;
    locations: number;
    achievements: number;
  };
  inProgress: boolean;
  online: boolean;
}

export interface SyncResult {
  success: boolean;
  synced: {
    activities: number;
    locations: number;
    achievements: number;
  };
  failed: {
    activities: number;
    locations: number;
    achievements: number;
  };
  errors: string[];
}

class SyncService {
  private syncInProgress = false;
  private syncQueue: any[] = [];
  private isOnline = true;

  constructor() {
    // Monitor network status
    NetInfo.addEventListener((state: NetInfoState) => {
      // ← Add type here
      this.isOnline = state.isConnected ?? false;
      if (this.isOnline && this.syncQueue.length > 0) {
        this.processSyncQueue();
      }
    });
  }

  /**
   * Main sync function - call this on app launch and login
   */
  async syncAllData(userId: string): Promise<SyncResult> {
    if (this.syncInProgress) {
      console.log("Sync already in progress");
      return this.createEmptyResult();
    }

    if (!this.isOnline) {
      console.log("Offline - queueing sync for later");
      return this.createEmptyResult();
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      success: true, // ← Add this line
      synced: { activities: 0, locations: 0, achievements: 0 },
      failed: { activities: 0, locations: 0, achievements: 0 },
      errors: [],
    };

    try {
      // Step 1: Get all local data
      const localData = await this.getLocalData();

      // Step 2: Get server data to check what exists
      const serverData = await this.getServerData(userId);

      // Step 3: Find new/updated items
      const toSync = this.findItemsToSync(localData, serverData);

      // Step 4: Sync each type
      await this.syncActivities(userId, toSync.activities, result);
      await this.syncLocations(userId, toSync.locations, result);
      await this.syncAchievements(userId, toSync.achievements, result);

      // Step 5: Update last sync time
      await AsyncStorage.setItem("lastSyncTime", new Date().toISOString());

      // Step 6: Download any new data from server
      await this.downloadServerData(userId);
    } catch (error: any) {
      console.error("Sync error:", error);
      result.success = false;
      result.errors.push(error.message);
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  /**
   * Get all local data from AsyncStorage
   */
  private async getLocalData() {
    const [activities, locations, achievements, wishlist] = await Promise.all([
      AsyncStorage.getItem("activities"),
      AsyncStorage.getItem("savedSpots"),
      AsyncStorage.getItem("achievements"),
      AsyncStorage.getItem("wishlistItems"),
    ]);

    return {
      activities: activities ? JSON.parse(activities) : [],
      locations: locations ? JSON.parse(locations) : [],
      achievements: achievements ? JSON.parse(achievements) : [],
      wishlist: wishlist ? JSON.parse(wishlist) : [],
    };
  }

  /**
   * Get existing data from server to avoid duplicates
   */
  private async getServerData(userId: string) {
    const [activities, locations, achievements] = await Promise.all([
      supabase
        .from("activities")
        .select("id, name, start_time")
        .eq("user_id", userId),
      supabase
        .from("locations")
        .select("id, name, latitude, longitude")
        .eq("user_id", userId),
      supabase
        .from("achievements")
        .select("id, type, earned_at")
        .eq("user_id", userId),
    ]);

    return {
      activities: activities.data || [],
      locations: locations.data || [],
      achievements: achievements.data || [],
    };
  }

  /**
   * Compare local and server data to find items that need syncing
   */
  private findItemsToSync(localData: any, serverData: any) {
    const toSync = {
      activities: [] as any[],
      locations: [] as any[],
      achievements: [] as any[],
    };

    // For activities - check by name and start time
    const serverActivityKeys = new Set(
      serverData.activities.map((a: any) => `${a.name}_${a.start_time}`)
    );

    toSync.activities = localData.activities.filter((activity: any) => {
      const key = `${activity.name}_${activity.startTime}`;
      return !serverActivityKeys.has(key);
    });

    // For locations - check by name and coordinates
    const serverLocationKeys = new Set(
      serverData.locations.map(
        (l: any) =>
          `${l.name}_${l.latitude.toFixed(4)}_${l.longitude.toFixed(4)}`
      )
    );

    toSync.locations = localData.locations.filter((location: any) => {
      const key = `${location.name}_${location.location.latitude.toFixed(
        4
      )}_${location.location.longitude.toFixed(4)}`;
      return !serverLocationKeys.has(key);
    });

    // For achievements - check by type and earned date
    const serverAchievementKeys = new Set(
      serverData.achievements.map((a: any) => `${a.type}_${a.earned_at}`)
    );

    toSync.achievements = localData.achievements.filter((achievement: any) => {
      const key = `${achievement.id}_${achievement.unlockedAt}`;
      return !serverAchievementKeys.has(key);
    });

    return toSync;
  }

  /**
   * Sync activities to Supabase
   */
  private async syncActivities(
    userId: string,
    activities: any[],
    result: SyncResult
  ) {
    for (const activity of activities) {
      try {
        // Transform local format to Supabase format
        const activityForDb = {
          user_id: userId,
          type: activity.type,
          name: activity.name,
          start_time: activity.startTime,
          end_time: activity.endTime,
          duration: activity.duration,
          distance: activity.distance,
          route: activity.route,
          average_speed: activity.averageSpeed,
          max_speed: activity.maxSpeed,
          notes: activity.notes,
          photos: activity.photos || [],
          is_manual_entry: activity.isManualEntry || false,
          privacy: "friends",
        };

        const { error } = await supabase
          .from("activities")
          .insert(activityForDb);

        if (error) throw error;
        result.synced.activities++;
      } catch (error: any) {
        console.error("Failed to sync activity:", error);
        result.failed.activities++;
        result.errors.push(`Activity sync: ${error.message}`);
      }
    }
  }

  /**
   * Sync locations to Supabase
   */
private async syncLocations(userId: string, locations: any[], result: SyncResult) {
  for (const location of locations) {
    try {
      const locationForDb = {
        user_id: userId,
        name: location.name,
        description: location.description || '',
        latitude: location.location.latitude,
        longitude: location.location.longitude,
        category: location.category || 'other',  // ← Add default
        rating: location.rating || null,
        photos: location.photos || [],
        tags: location.tags || [],
        is_public: false
      };

      const { error } = await supabase
        .from('locations')
        .insert(locationForDb);

      if (error) throw error;
      result.synced.locations++;
      
    } catch (error: any) {
      console.error('Failed to sync location:', error);
      result.failed.locations++;
      result.errors.push(`Location sync: ${error.message}`);
    }
  }
}

  /**
   * Sync achievements to Supabase
   */
  private async syncAchievements(
    userId: string,
    achievements: any[],
    result: SyncResult
  ) {
    for (const achievement of achievements) {
      try {
        const achievementForDb = {
          user_id: userId,
          type: achievement.id,
          name: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          earned_at: achievement.unlockedAt,
          data: {
            requirement: achievement.requirement,
            progress: achievement.progress,
          },
        };

        const { error } = await supabase
          .from("achievements")
          .insert(achievementForDb);

        if (error) throw error;
        result.synced.achievements++;
      } catch (error: any) {
        console.error("Failed to sync achievement:", error);
        result.failed.achievements++;
        result.errors.push(`Achievement sync: ${error.message}`);
      }
    }
  }

  /**
   * Download new data from server (for multi-device sync)
   */
  private async downloadServerData(userId: string) {
    try {
      // Get last sync time
      const lastSyncTime = await AsyncStorage.getItem("lastSyncTime");
      if (!lastSyncTime) return;

      // Get new activities from server
      const { data: newActivities } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", userId)
        .gt("created_at", lastSyncTime);

      if (newActivities && newActivities.length > 0) {
        // Merge with local data
        const localActivities = await AsyncStorage.getItem("activities");
        const activities = localActivities ? JSON.parse(localActivities) : [];

        // Transform and add new activities
        for (const activity of newActivities) {
          const exists = activities.some(
            (a: any) =>
              a.name === activity.name && a.startTime === activity.start_time
          );

          if (!exists) {
            activities.push({
              id: activity.id,
              type: activity.type,
              name: activity.name,
              startTime: activity.start_time,
              endTime: activity.end_time,
              duration: activity.duration,
              distance: activity.distance,
              route: activity.route,
              averageSpeed: activity.average_speed,
              maxSpeed: activity.max_speed,
              notes: activity.notes,
              photos: activity.photos,
              isManualEntry: activity.is_manual_entry,
            });
          }
        }

        await AsyncStorage.setItem("activities", JSON.stringify(activities));
      }

      // Similar for locations and achievements...
    } catch (error) {
      console.error("Error downloading server data:", error);
    }
  }

  /**
   * Queue an item for sync when offline
   */
  async queueForSync(type: "activity" | "location" | "achievement", data: any) {
    const queueKey = `syncQueue_${type}`;
    const queue = await AsyncStorage.getItem(queueKey);
    const items = queue ? JSON.parse(queue) : [];

    items.push({
      ...data,
      queuedAt: new Date().toISOString(),
    });

    await AsyncStorage.setItem(queueKey, JSON.stringify(items));

    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  /**
   * Process queued items when coming back online
   */
  private async processSyncQueue() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get all queued items
    const [activities, locations, achievements] = await Promise.all([
      AsyncStorage.getItem("syncQueue_activity"),
      AsyncStorage.getItem("syncQueue_location"),
      AsyncStorage.getItem("syncQueue_achievement"),
    ]);

    const result: SyncResult = {
      // ← Add type annotation
      success: true, // ← Add this line
      synced: { activities: 0, locations: 0, achievements: 0 },
      failed: { activities: 0, locations: 0, achievements: 0 },
      errors: [],
    };

    // Process each queue
    if (activities) {
      const items = JSON.parse(activities);
      await this.syncActivities(user.id, items, result);
      await AsyncStorage.removeItem("syncQueue_activity");
    }

    if (locations) {
      const items = JSON.parse(locations);
      await this.syncLocations(user.id, items, result);
      await AsyncStorage.removeItem("syncQueue_location");
    }

    if (achievements) {
      const items = JSON.parse(achievements);
      await this.syncAchievements(user.id, items, result);
      await AsyncStorage.removeItem("syncQueue_achievement");
    }

    return result;
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const lastSync = await AsyncStorage.getItem("lastSyncTime");

    // Count pending items
    const [activities, locations, achievements] = await Promise.all([
      AsyncStorage.getItem("syncQueue_activity"),
      AsyncStorage.getItem("syncQueue_location"),
      AsyncStorage.getItem("syncQueue_achievement"),
    ]);

    return {
      lastSync,
      pending: {
        activities: activities ? JSON.parse(activities).length : 0,
        locations: locations ? JSON.parse(locations).length : 0,
        achievements: achievements ? JSON.parse(achievements).length : 0,
      },
      inProgress: this.syncInProgress,
      online: this.isOnline,
    };
  }

  /**
   * Handle conflicts (when same data exists on server and local)
   */
  async resolveConflict(
    type: "activity" | "location",
    localItem: any,
    serverItem: any
  ): Promise<"local" | "server" | "merge"> {
    // Default strategy: server wins (most recent)
    // You can customize this or prompt the user

    const localDate = new Date(localItem.updatedAt || localItem.timestamp);
    const serverDate = new Date(serverItem.updated_at);

    if (serverDate > localDate) {
      return "server";
    } else if (localDate > serverDate) {
      return "local";
    } else {
      // If timestamps are equal, you could:
      // 1. Prompt user
      // 2. Merge data
      // 3. Default to server
      return "server";
    }
  }

  private createEmptyResult(): SyncResult {
    return {
      success: false,
      synced: { activities: 0, locations: 0, achievements: 0 },
      failed: { activities: 0, locations: 0, achievements: 0 },
      errors: ["Sync not performed"],
    };
  }
}

// Export singleton instance
export const syncService = new SyncService();
