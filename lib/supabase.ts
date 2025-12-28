import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'https://cmglwzchvfkysotbbvab.supabase.co';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtZ2x3emNodmZreXNvdGJidmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NDQwODYsImV4cCI6MjA3MTIyMDA4Nn0.UxFZeEWReK8cM8wMf6AzESH8JGJKcUUyPjzcSi0sp_U';

// Create Supabase client with AsyncStorage for auth persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types (generated from your schema)
export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
  last_active: string;
  privacy_settings: {
    share_activities: boolean;
    share_locations: boolean;
    allow_friend_requests: boolean;
  };
};

export type Activity = {
  id: string;
  user_id: string;
  type: string;
  name: string;
  start_time: string;
  end_time: string;
  duration: number;
  distance: number;
  route?: any;
  average_speed?: number;
  max_speed?: number;
  notes?: string;
  photos?: string[];
  is_manual_entry: boolean;
  privacy: 'private' | 'friends' | 'public';
  created_at: string;
};

export type Location = {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  category: string;
  rating?: number;
  photos?: string[];
  tags?: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  requested_at: string;
  accepted_at?: string;
  privacy_settings?: any;
};

export type FeedPost = {
  id: string;
  user_id: string;
  type: 'activity' | 'location' | 'achievement';
  content_id?: string;
  content: any;
  privacy: 'private' | 'friends' | 'public';
  created_at: string;
};

// Helper functions for common operations
export const supabaseHelpers = {
  // Upload photo to storage
  async uploadPhoto(
    bucket: 'activity-photos' | 'location-photos' | 'profile-avatars',
    path: string,
    base64Data: string
  ) {
    try {
      // Convert base64 to blob
      const base64str = base64Data.includes('base64,') 
        ? base64Data.split('base64,')[1] 
        : base64Data;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, decode(base64str), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  },

  // Get current user profile
  async getCurrentProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  },

  // Get friends list
  async getFriends(userId: string) {
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          *,
          friend:friend_id(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching friends:', error);
      return [];
    }
  },

  // Get activities with pagination
  async getActivities(userId: string, limit = 20, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching activities:', error);
      return [];
    }
  },

  // Get friend feed
  async getFriendFeed(userId: string, limit = 20) {
    try {
      // First get friend IDs
      const friends = await this.getFriends(userId);
      const friendIds = friends.map(f => f.friend_id);
      
      if (friendIds.length === 0) return [];

      // Get feed posts from friends
      const { data, error } = await supabase
        .from('feed_posts')
        .select(`
          *,
          user:user_id(*),
          likes(count),
          comments(*)
        `)
        .in('user_id', friendIds)
        .in('privacy', ['friends', 'public'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching feed:', error);
      return [];
    }
  },

  // Create activity and optionally share to feed
  async createActivity(activity: Omit<Activity, 'id' | 'created_at'>, shareToFeed = false) {
    try {
      // Insert activity
      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .insert(activity)
        .select()
        .single();

      if (activityError) throw activityError;

      // Share to feed if requested
      if (shareToFeed && activityData) {
        const { error: feedError } = await supabase
          .from('feed_posts')
          .insert({
            user_id: activity.user_id,
            type: 'activity',
            content_id: activityData.id,
            content: activityData,
            privacy: activity.privacy || 'friends',
          });

        if (feedError) console.error('Error sharing to feed:', feedError);
      }

      return activityData;
    } catch (error) {
      console.error('Error creating activity:', error);
      throw error;
    }
  },

  // Sync local data to cloud
  async syncLocalData(localData: {
    activities?: any[],
    locations?: any[],
    achievements?: any[]
  }) {
    const results = {
      activities: { synced: 0, failed: 0 },
      locations: { synced: 0, failed: 0 },
      achievements: { synced: 0, failed: 0 },
    };

    // Sync activities
    if (localData.activities) {
      for (const activity of localData.activities) {
        try {
          await this.createActivity(activity);
          results.activities.synced++;
        } catch (error) {
          results.activities.failed++;
        }
      }
    }

    // Similar for locations and achievements...

    return results;
  },
};

// Decode base64 to array buffer
function decode(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}