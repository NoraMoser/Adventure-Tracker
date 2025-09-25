// services/memoryNotificationService.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
// Only import BackgroundFetch if not in Expo Go
let BackgroundFetch: any = null;
try {
  BackgroundFetch = require('expo-background-fetch');
} catch (e) {
  console.log('BackgroundFetch not available in Expo Go');
}
import { supabase } from '../lib/supabase';
import { NotificationService, PushNotificationHelper } from '../lib/notifications';

const BACKGROUND_FETCH_TASK = 'background-fetch-memories';
const LOCATION_TASK = 'background-location-task';
const PROXIMITY_THRESHOLD = 100; // meters
const CHECK_INTERVAL = 15 * 60; // 15 minutes in seconds

interface MemoryItem {
  id: string;
  type: 'activity' | 'spot' | 'trip';
  title: string;
  description?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  photos?: string[];
  date: Date;
  friends?: string[];
}

interface ProximityPlace {
  id: string;
  type: 'spot' | 'activity_start' | 'activity_end';
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  lastVisited: Date;
  visitCount: number;
  distance: number;
}

export class MemoryNotificationService {
  private static lastProximityCheck: Date | null = null;
  private static notifiedPlaces = new Set<string>(); // Track places we've already notified about today

  /**
   * Initialize memory and proximity services
   */
  static async initialize(userId: string) {
    try {
      // Register background fetch for daily memories
      await this.registerBackgroundFetch();
      
      // Register location tracking for proximity alerts
      await this.registerLocationTracking(userId);
      
      console.log('Memory notification services initialized');
    } catch (error) {
      console.error('Error initializing memory services:', error);
    }
  }

  /**
   * Register background fetch for daily memory checks
   */
  private static async registerBackgroundFetch() {
    if (!BackgroundFetch) {
      console.log('BackgroundFetch not available in this environment');
      return;
    }
    
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 60 * 60 * 24, // Daily check
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (err) {
      console.log('Background fetch registration failed:', err);
    }
  }

  /**
   * Register location tracking for proximity alerts
   */
  private static async registerLocationTracking(userId: string) {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Background location permission denied');
        return;
      }

      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: CHECK_INTERVAL * 1000,
        distanceInterval: 50, // Check every 50 meters of movement
        foregroundService: {
          notificationTitle: 'explorAble is tracking your location',
          notificationBody: 'To notify you when near previously visited places',
        },
      });
    } catch (error) {
      console.log('Location tracking setup error:', error);
    }
  }

  /**
   * Check for "On This Day" memories
   */
  static async checkDailyMemories(userId: string): Promise<MemoryItem[]> {
    const memories: MemoryItem[] = [];
    const today = new Date();
    
    // Check for memories from past years on this date
    for (let yearsAgo = 1; yearsAgo <= 5; yearsAgo++) {
      const targetDate = new Date(today);
      targetDate.setFullYear(today.getFullYear() - yearsAgo);
      
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      try {
        // Check activities
        const { data: activities } = await supabase
          .from('activities')
          .select(`
            *,
            activity_photos (photo_url)
          `)
          .eq('user_id', userId)
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());

        if (activities && activities.length > 0) {
          activities.forEach(activity => {
            memories.push({
              id: activity.id,
              type: 'activity',
              title: activity.name || `${activity.type} activity`,
              description: `${activity.distance}km in ${activity.duration}`,
              location: activity.route_data?.[0],
              photos: activity.activity_photos?.map((p: any) => p.photo_url),
              date: new Date(activity.created_at),
            });
          });
        }

        // Check saved spots
        const { data: spots } = await supabase
          .from('locations')
          .select('*')
          .eq('user_id', userId)
          .gte('location_date', startOfDay.toISOString())
          .lte('location_date', endOfDay.toISOString());

        if (spots && spots.length > 0) {
          spots.forEach(spot => {
            memories.push({
              id: spot.id,
              type: 'spot',
              title: spot.name,
              description: spot.description,
              location: {
                latitude: spot.latitude,
                longitude: spot.longitude,
              },
              photos: spot.photos,
              date: new Date(spot.location_date || spot.created_at),
            });
          });
        }

        // Check trips
        const { data: trips } = await supabase
          .from('trips')
          .select(`
            *,
            trip_activities (activity_id),
            trip_spots (spot_id)
          `)
          .eq('user_id', userId)
          .gte('start_date', startOfDay.toISOString())
          .lte('start_date', endOfDay.toISOString());

        if (trips && trips.length > 0) {
          trips.forEach(trip => {
            memories.push({
              id: trip.id,
              type: 'trip',
              title: trip.name,
              description: trip.description,
              date: new Date(trip.start_date),
              friends: trip.shared_with,
            });
          });
        }
      } catch (error) {
        console.error(`Error fetching memories from ${yearsAgo} year(s) ago:`, error);
      }
    }

    return memories;
  }

  /**
   * Send memory notifications
   */
  static async sendMemoryNotifications(userId: string, memories: MemoryItem[]) {
    if (memories.length === 0) return;

    console.log('sendMemoryNotifications called with:', { userId, memoriesCount: memories.length });

    // Group memories by years ago
    const memoryGroups = new Map<number, MemoryItem[]>();
    const today = new Date();

    memories.forEach(memory => {
      const yearsAgo = today.getFullYear() - memory.date.getFullYear();
      if (!memoryGroups.has(yearsAgo)) {
        memoryGroups.set(yearsAgo, []);
      }
      memoryGroups.get(yearsAgo)?.push(memory);
    });

    // Send notifications for each year group
    for (const [yearsAgo, yearMemories] of memoryGroups.entries()) {
      const title = `📅 ${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago today`;
      let body = '';

      if (yearMemories.length === 1) {
        const memory = yearMemories[0];
        if (memory.type === 'activity') {
          body = `You completed ${memory.title}${memory.description ? ` - ${memory.description}` : ''}`;
        } else if (memory.type === 'spot') {
          body = `You visited ${memory.title}`;
        } else if (memory.type === 'trip') {
          body = `You started your trip: ${memory.title}`;
        }
      } else {
        const activities = yearMemories.filter(m => m.type === 'activity').length;
        const spots = yearMemories.filter(m => m.type === 'spot').length;
        const trips = yearMemories.filter(m => m.type === 'trip').length;

        const parts = [];
        if (activities > 0) parts.push(`${activities} ${activities === 1 ? 'activity' : 'activities'}`);
        if (spots > 0) parts.push(`${spots} ${spots === 1 ? 'spot' : 'spots'}`);
        if (trips > 0) parts.push(`${trips} ${trips === 1 ? 'trip' : 'trips'}`);

        body = `You have ${parts.join(', ')} from this day!`;
      }

      console.log('Creating notification with:', { title, body, userId });

      try {
        // Create in-app notification
        const { data, error } = await supabase.from('notifications').insert({
          user_id: userId,
          type: 'memory',
          title,
          message: body,
          data: {
            memories: yearMemories.map(m => ({
              id: m.id,
              type: m.type,
              title: m.title,
            })),
            years_ago: yearsAgo,
            date: today.toISOString(),
          },
          read: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

        if (error) {
          console.error('Database error creating notification:', error);
          throw error;
        }

        console.log('Notification created successfully:', data);

        // Try to send push notification (this may fail in Expo Go, which is okay)
        try {
          await PushNotificationHelper.sendNotificationToUser(
            userId,
            'memory',
            title,
            body,
            {
              type: 'memory',
              memoryCount: yearMemories.length,
              yearsAgo,
            }
          );
          console.log('Push notification sent');
        } catch (pushError) {
          console.log('Push notification failed (normal in Expo Go):', pushError);
        }
      } catch (error) {
        console.error('Failed to create memory notification:', error);
        throw error;
      }
    }
  }

  /**
   * Check proximity to previously visited places
   */
  static async checkProximity(
    currentLocation: { latitude: number; longitude: number },
    userId: string
  ): Promise<ProximityPlace[]> {
    const nearbyPlaces: ProximityPlace[] = [];

    try {
      // Get user's saved locations
      const { data: spots } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId);

      // Get user's activities (check start points)
      const { data: activities } = await supabase
        .from('activities')
        .select('id, name, type, route_data, created_at')
        .eq('user_id', userId)
        .not('route_data', 'is', null);

      // Check proximity to saved spots
      spots?.forEach(spot => {
        const distance = this.calculateDistance(
          currentLocation,
          { latitude: spot.latitude, longitude: spot.longitude }
        );

        if (distance <= PROXIMITY_THRESHOLD) {
          const placeKey = `spot-${spot.id}`;
          if (!this.notifiedPlaces.has(placeKey)) {
            nearbyPlaces.push({
              id: spot.id,
              type: 'spot',
              name: spot.name,
              location: {
                latitude: spot.latitude,
                longitude: spot.longitude,
              },
              lastVisited: new Date(spot.location_date || spot.created_at),
              visitCount: spot.visit_count || 1,
              distance,
            });
          }
        }
      });

      // Check proximity to activity start/end points
      activities?.forEach(activity => {
        if (activity.route_data && activity.route_data.length > 0) {
          const startPoint = activity.route_data[0];
          const endPoint = activity.route_data[activity.route_data.length - 1];

          // Check start point
          const startDistance = this.calculateDistance(currentLocation, startPoint);
          if (startDistance <= PROXIMITY_THRESHOLD) {
            const placeKey = `activity-start-${activity.id}`;
            if (!this.notifiedPlaces.has(placeKey)) {
              nearbyPlaces.push({
                id: activity.id,
                type: 'activity_start',
                name: `Start of ${activity.name || activity.type}`,
                location: startPoint,
                lastVisited: new Date(activity.created_at),
                visitCount: 1,
                distance: startDistance,
              });
            }
          }

          // Check end point if different from start
          const endDistance = this.calculateDistance(currentLocation, endPoint);
          if (endDistance <= PROXIMITY_THRESHOLD && endDistance !== startDistance) {
            const placeKey = `activity-end-${activity.id}`;
            if (!this.notifiedPlaces.has(placeKey)) {
              nearbyPlaces.push({
                id: activity.id,
                type: 'activity_end',
                name: `End of ${activity.name || activity.type}`,
                location: endPoint,
                lastVisited: new Date(activity.created_at),
                visitCount: 1,
                distance: endDistance,
              });
            }
          }
        }
      });

      // Sort by distance
      nearbyPlaces.sort((a, b) => a.distance - b.distance);

    } catch (error) {
      console.error('Error checking proximity:', error);
    }

    return nearbyPlaces;
  }

  /**
   * Send proximity notifications
   */
  static async sendProximityNotifications(
    userId: string,
    places: ProximityPlace[]
  ) {
    if (places.length === 0) return;

    const closestPlace = places[0];
    const timeSinceVisit = this.getTimeAgo(closestPlace.lastVisited);

    let title = '📍 You\'ve been here before!';
    let body = '';

    if (closestPlace.type === 'spot') {
      body = `You're ${Math.round(closestPlace.distance)}m from "${closestPlace.name}" - last visited ${timeSinceVisit}`;
    } else {
      body = `You're near ${closestPlace.name} from ${timeSinceVisit}`;
    }

    // Add to notified places to avoid duplicate notifications
    places.forEach(place => {
      const key = `${place.type}-${place.id}`;
      this.notifiedPlaces.add(key);
    });

    try {
      // Create in-app notification
      const { data, error } = await supabase.from('notifications').insert({
        user_id: userId,
        type: 'proximity_alert',
        title,
        message: body,
        data: {
          place_id: closestPlace.id,
          place_type: closestPlace.type,
          distance: closestPlace.distance,
          all_nearby: places.map(p => ({
            id: p.id,
            name: p.name,
            distance: p.distance,
          })),
        },
        read: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

      if (error) {
        console.error('Database error creating proximity notification:', error);
        throw error;
      }

      console.log('Proximity notification created:', data);

      // Try to send push notification
      try {
        await PushNotificationHelper.sendNotificationToUser(
          userId,
          'proximity_alert',
          title,
          body,
          {
            type: 'proximity',
            placeId: closestPlace.id,
            distance: closestPlace.distance,
          }
        );
      } catch (pushError) {
        console.log('Push notification failed (normal in Expo Go):', pushError);
      }

      // Try to send local notification as backup
      try {
        await NotificationService.sendLocalNotification(
          title,
          body,
          {
            type: 'proximity',
            placeId: closestPlace.id,
          }
        );
      } catch (localError) {
        console.log('Local notification failed (normal in Expo Go):', localError);
      }
    } catch (error) {
      console.error('Failed to send proximity notifications:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  private static calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Format time ago string
   */
  static getTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''} ago`;
    } else if (months > 0) {
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return 'earlier today';
    }
  }

  /**
   * Clear notified places cache (call this daily)
   */
  static clearNotifiedPlaces() {
    this.notifiedPlaces.clear();
  }

  /**
   * Check if user has enabled memory features
   */
  static async getUserPreferences(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', userId)
      .single();

    return {
      memoriesEnabled: profile?.notification_preferences?.memories !== false,
      proximityEnabled: profile?.notification_preferences?.proximity !== false,
      proximityDistance: profile?.notification_preferences?.proximity_distance || PROXIMITY_THRESHOLD,
    };
  }
}

// Task manager definitions
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const memories = await MemoryNotificationService.checkDailyMemories(user.id);
      await MemoryNotificationService.sendMemoryNotifications(user.id, memories);
    }
    return BackgroundFetch ? BackgroundFetch.BackgroundFetchResult.NewData : 0;
  } catch (error) {
    console.error('Background fetch error:', error);
    return BackgroundFetch ? BackgroundFetch.BackgroundFetchResult.Failed : 2;
  }
});

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as any;
    const location = locations[0];

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const preferences = await MemoryNotificationService.getUserPreferences(user.id);
      if (preferences.proximityEnabled) {
        const nearbyPlaces = await MemoryNotificationService.checkProximity(
          location.coords,
          user.id
        );
        
        if (nearbyPlaces.length > 0) {
          await MemoryNotificationService.sendProximityNotifications(user.id, nearbyPlaces);
        }
      }
    }
  }
});