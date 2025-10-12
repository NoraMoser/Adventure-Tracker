// services/syncService.ts - Fixed to prevent duplicates

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

class SyncService {
  async syncAllData(userId: string) {
    console.log('🔄 Starting sync for user:', userId);
    
    const result = {
      success: true,
      synced: {
        activities: 0,
        locations: 0,
        achievements: 0,
      },
      errors: [] as string[],
    };

    try {
      // Get last sync time
      const lastSyncTime = await AsyncStorage.getItem('lastSyncTime');

      // Sync activities
      const activitiesResult = await this.syncActivities(userId, lastSyncTime);
      result.synced.activities = activitiesResult.count;
      
      // Sync locations - WITH DUPLICATE CHECK
      const locationsResult = await this.syncLocations(userId, lastSyncTime);
      result.synced.locations = locationsResult.count;
      
      // Sync achievements
      const achievementsResult = await this.syncAchievements(userId, lastSyncTime);
      result.synced.achievements = achievementsResult.count;

      // Update last sync time
      await AsyncStorage.setItem('lastSyncTime', new Date().toISOString());
      
    } catch (error) {
      result.success = false;
      result.errors.push(String(error));
    }

    return result;
  }

  private async syncActivities(userId: string, lastSyncTime: string | null) {
    try {
      // Get local activities
      const localData = await AsyncStorage.getItem('activities');
      if (!localData) return { count: 0 };

      const activities = JSON.parse(localData);
      let syncedCount = 0;

      // Get existing activities from database to check for duplicates
      const { data: existingActivities } = await supabase
        .from('activities')
        .select('id, name, start_time')
        .eq('user_id', userId);

      const existingMap = new Map(
        (existingActivities || []).map(a => [
          `${a.name}_${new Date(a.start_time).getTime()}`,
          a.id
        ])
      );

      for (const activity of activities) {
        // Skip if already synced (has a UUID)
        if (activity.id && activity.id.includes('-')) {
          continue;
        }

        // Check for duplicate based on name and start time
        const activityKey = `${activity.name}_${new Date(activity.startTime).getTime()}`;
        if (existingMap.has(activityKey)) {
          continue;
        }

        // Only sync activities that haven't been synced or are newer than last sync
        if (!lastSyncTime || new Date(activity.startTime) > new Date(lastSyncTime)) {
          const { error } = await supabase.from('activities').insert({
            user_id: userId,
            name: activity.name,
            type: activity.type,
            start_time: activity.startTime,
            end_time: activity.endTime,
            duration: activity.duration,
            distance: activity.distance,
            average_speed: activity.averageSpeed,
            max_speed: activity.maxSpeed,
            elevation_gain: activity.elevationGain,
            route: activity.route,
            notes: activity.notes,
            photos: activity.photos,
            is_manual_entry: activity.isManualEntry,
          });

          if (!error) {
            syncedCount++;
          } else {
            console.error('🔄 Error syncing activity:', error);
          }
        }
      }

      return { count: syncedCount };
    } catch (error) {
      console.error('🔄 Error syncing activities:', error);
      return { count: 0 };
    }
  }

  private async syncLocations(userId: string, lastSyncTime: string | null) {
    try {
      // Get local locations
      const localData = await AsyncStorage.getItem('savedSpots');
      if (!localData) return { count: 0 };

      const locations = JSON.parse(localData);
      let syncedCount = 0;

      // Get existing locations from database to check for duplicates
      const { data: existingLocations } = await supabase
        .from('locations')
        .select('id, name, latitude, longitude, created_at')
        .eq('user_id', userId);

      // Create a map of existing locations using coordinates as key
      const existingMap = new Map(
        (existingLocations || []).map(loc => [
          `${loc.latitude.toFixed(6)}_${loc.longitude.toFixed(6)}`,
          loc
        ])
      );

      for (const location of locations) {
        // Skip if already synced (has a UUID)
        if (location.id && location.id.includes('-')) {
          continue;
        }

        // Check for duplicate based on coordinates
        const locationKey = `${location.location.latitude.toFixed(6)}_${location.location.longitude.toFixed(6)}`;
        
        if (existingMap.has(locationKey)) {
          const existing = existingMap.get(locationKey);
          
          // Optional: Update the local ID to match the database ID
          if (existing) {
            location.id = existing.id;
          }
          
          continue;
        }

        // Only sync locations that haven't been synced or are newer than last sync
        const locationTime = location.timestamp || new Date().toISOString();
        if (!lastSyncTime || new Date(locationTime) > new Date(lastSyncTime)) {
          const { data, error } = await supabase
            .from('locations')
            .insert({
              user_id: userId,
              name: location.name,
              latitude: location.location.latitude,
              longitude: location.location.longitude,
              description: location.description,
              category: location.category,
              rating: location.rating,
              photos: location.photos || [],
              created_at: locationTime,
            })
            .select()
            .single();

          if (!error && data) {
            // Update local location with the database ID
            location.id = data.id;
            syncedCount++;
          } else if (error) {
            console.error('🔄 Error syncing location:', error);
          }
        }
      }

      // Save updated locations back to AsyncStorage with proper IDs
      await AsyncStorage.setItem('savedSpots', JSON.stringify(locations));

      return { count: syncedCount };
    } catch (error) {
      console.error('🔄 Error syncing locations:', error);
      return { count: 0 };
    }
  }

  private async syncAchievements(userId: string, lastSyncTime: string | null) {
    try {
      // Get local achievements
      const localData = await AsyncStorage.getItem('achievements');
      if (!localData) return { count: 0 };

      const achievements = JSON.parse(localData);
      let syncedCount = 0;

      // Get existing achievements to check for duplicates
      const { data: existingAchievements } = await supabase
        .from('achievements')
        .select('id, type, name')
        .eq('user_id', userId);

      const existingMap = new Map(
        (existingAchievements || []).map(a => [`${a.type}_${a.name}`, a.id])
      );

      for (const achievement of achievements) {
        // Check for duplicate
        const achievementKey = `${achievement.type}_${achievement.name}`;
        if (existingMap.has(achievementKey)) {
          console.log('🔄 Skipping duplicate achievement:', achievement.name);
          continue;
        }

        const achievementTime = achievement.earnedAt || new Date().toISOString();
        if (!lastSyncTime || new Date(achievementTime) > new Date(lastSyncTime)) {
          const { error } = await supabase.from('achievements').insert({
            user_id: userId,
            type: achievement.type,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            earned_at: achievementTime,
            data: achievement.data,
          });

          if (!error) {
            syncedCount++;
          } else {
            console.error('🔄 Error syncing achievement:', error);
          }
        }
      }

      return { count: syncedCount };
    } catch (error) {
      console.error('🔄 Error syncing achievements:', error);
      return { count: 0 };
    }
  }

  // Method to manually trigger sync
  async manualSync(userId: string) {
    // Clear last sync time to force full sync
    await AsyncStorage.removeItem('lastSyncTime');
    return this.syncAllData(userId);
  }

  // Method to reset sync (use with caution!)
  async resetSync() {
    await AsyncStorage.removeItem('lastSyncTime');
    console.log('🔄 Sync reset - next sync will check all data');
  }
}

export const syncService = new SyncService();