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
const PROXIMITY_THRESHOLD = 500; // Increased from 100m to 500m for better detection
const HOME_RADIUS = 1000; // 1km home zone where we won't send notifications
const CHECK_INTERVAL = 30 * 60; // 30 minutes instead of 15
const FOREGROUND_CHECK_INTERVAL = 60 * 60; // 1 hour for foreground checks
const MIN_TIME_BETWEEN_NOTIFICATIONS = 24 * 60 * 60 * 1000; // 24 hours between notifications for same place
const MIN_DAYS_SINCE_VISIT = 7; // Only notify if haven't been there in at least a week

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
  private static lastForegroundCheck: Date | null = null;
  private static notifiedPlaces = new Set<string>(); // Track places we've already notified about today
  private static homeLocation: { latitude: number; longitude: number } | null = null;
  private static lastNotificationTime = new Map<string, Date>(); // Track per-place notification times
  private static foregroundCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize memory and proximity services with home detection
   */
  static async initialize(userId: string) {
    try {
      // Set home location first to avoid notifications near home
      await this.setHomeLocation(userId);
      
      // Register background fetch for daily memories
      await this.registerBackgroundFetch();
      
      // Try to register location tracking for proximity alerts (background)
      await this.registerLocationTracking(userId);
      
    } catch (error) {
      console.error('Error initializing memory services:', error);
    }
  }

  /**
   * Initialize foreground proximity checks for users with "when in use" permission
   * Call this when the app starts or comes to foreground
   */
  static async initializeForegroundChecks(userId: string) {
    try {
      // Set home location if not already set
      if (!this.homeLocation) {
        await this.setHomeLocation(userId);
      }

      // Check immediately on app open
      await this.checkForegroundProximity(userId);

      // Set up periodic checks while app is in foreground
      this.startForegroundCheckTimer(userId);
      
    } catch (error) {
      console.error('Error initializing foreground checks:', error);
    }
  }

  /**
   * Start periodic foreground proximity checks
   */
  private static startForegroundCheckTimer(userId: string) {
    // Clear existing timer if any
    if (this.foregroundCheckInterval) {
      clearInterval(this.foregroundCheckInterval);
    }

    // Check every hour while app is active
    this.foregroundCheckInterval = setInterval(async () => {
      await this.checkForegroundProximity(userId);
    }, FOREGROUND_CHECK_INTERVAL * 1000);
  }

  /**
   * Stop foreground proximity checks (call when app goes to background)
   */
  static stopForegroundChecks() {
    if (this.foregroundCheckInterval) {
      clearInterval(this.foregroundCheckInterval);
      this.foregroundCheckInterval = null;
    }
  }

  /**
   * Check proximity using foreground location permission
   */
  static async checkForegroundProximity(userId: string) {
    try {
      // Check if enough time has passed since last foreground check
      if (this.lastForegroundCheck) {
        const timeSinceLastCheck = Date.now() - this.lastForegroundCheck.getTime();
        if (timeSinceLastCheck < FOREGROUND_CHECK_INTERVAL * 1000) {
          return;
        }
      }

      // Request foreground location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Foreground location permission not granted');
        return;
      }

      // Get user preferences
      const preferences = await this.getUserPreferences(userId);
      if (!preferences.proximityEnabled) {
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      this.lastForegroundCheck = new Date();

      // Check for nearby places
      const nearbyPlaces = await this.checkProximity(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        userId
      );

      // Send notifications if places found
      if (nearbyPlaces.length > 0) {
        await this.sendProximityNotifications(userId, nearbyPlaces);
      }

    } catch (error) {
      console.error('Error checking foreground proximity:', error);
    }
  }

  /**
   * Set user's home location to avoid notifications near home
   */
  static async setHomeLocation(userId: string) {
    try {
      // First check if user has explicitly set home location
      const { data: profile } = await supabase
        .from('profiles')
        .select('home_location')
        .eq('id', userId)
        .single();

      if (profile?.home_location) {
        this.homeLocation = profile.home_location;
        return;
      }

      // Otherwise, try to detect home based on most frequently visited location
      const { data: frequentSpots } = await supabase
        .from('locations')
        .select('latitude, longitude, visit_count, name')
        .eq('user_id', userId)
        .order('visit_count', { ascending: false })
        .limit(5);

      if (frequentSpots && frequentSpots.length > 0) {
        // Use the most visited location as home
        this.homeLocation = {
          latitude: frequentSpots[0].latitude,
          longitude: frequentSpots[0].longitude,
        };
      }
    } catch (error) {
      console.error('Error setting home location:', error);
    }
  }

  /**
   * Check if location is near home
   */
  private static isNearHome(location: { latitude: number; longitude: number }): boolean {
    if (!this.homeLocation) return false;
    
    const distance = this.calculateDistance(location, this.homeLocation);
    return distance < HOME_RADIUS;
  }

  /**
   * Check if enough time has passed since last notification for this place
   */
  private static canNotifyForPlace(placeKey: string): boolean {
    const lastNotified = this.lastNotificationTime.get(placeKey);
    if (!lastNotified) return true;
    
    const timeSinceNotification = Date.now() - lastNotified.getTime();
    return timeSinceNotification >= MIN_TIME_BETWEEN_NOTIFICATIONS;
  }

  /**
   * Register background fetch for daily memory checks
   */
  private static async registerBackgroundFetch() {
    if (!BackgroundFetch) {
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
   * Register location tracking for proximity alerts (requires "always" permission)
   */
  private static async registerLocationTracking(userId: string) {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Background location permission not granted, using foreground checks only');
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
      console.log('Location tracking setup error (will use foreground checks):', error);
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
   * Enhanced proximity check with smart filtering
   */
  static async checkProximity(
    currentLocation: { latitude: number; longitude: number },
    userId: string
  ): Promise<ProximityPlace[]> {
    const nearbyPlaces: ProximityPlace[] = [];
    
    // Skip if near home
    if (this.isNearHome(currentLocation)) {
      return [];
    }

    // Check if enough time has passed since last check
    if (this.lastProximityCheck) {
      const timeSinceLastCheck = Date.now() - this.lastProximityCheck.getTime();
      if (timeSinceLastCheck < CHECK_INTERVAL * 1000) {
        return [];
      }
    }
    
    this.lastProximityCheck = new Date();

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

      const now = new Date();

      // Check proximity to saved spots
      spots?.forEach(spot => {
        const distance = this.calculateDistance(
          currentLocation,
          { latitude: spot.latitude, longitude: spot.longitude }
        );

        // Check if within threshold AND not too close (< 50m means you're basically there)
        if (distance <= PROXIMITY_THRESHOLD && distance > 50) {
          const spotLocation = { latitude: spot.latitude, longitude: spot.longitude };
          
          // Skip if this spot is near home
          if (this.isNearHome(spotLocation)) {
            return;
          }

          // Check if visited recently
          const lastVisitDate = new Date(spot.last_visited || spot.location_date || spot.created_at);
          const daysSinceVisit = Math.floor((now.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Only notify if haven't been there recently
          if (daysSinceVisit >= MIN_DAYS_SINCE_VISIT) {
            const placeKey = `spot-${spot.id}`;
            
            // Check if we can notify for this place (not notified in last 24 hours)
            if (this.canNotifyForPlace(placeKey)) {
              nearbyPlaces.push({
                id: spot.id,
                type: 'spot',
                name: spot.name,
                location: spotLocation,
                lastVisited: lastVisitDate,
                visitCount: spot.visit_count || 1,
                distance,
              });
            }
          }
        }
      });

      // Check activities with stricter criteria (only old activities)
      activities?.forEach(activity => {
        if (activity.route_data && activity.route_data.length > 0) {
          const activityDate = new Date(activity.created_at);
          const daysSinceActivity = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Only check activities at least 30 days old
          if (daysSinceActivity >= 30) {
            const startPoint = activity.route_data[0];
            const endPoint = activity.route_data[activity.route_data.length - 1];

            // Check start point
            const startDistance = this.calculateDistance(currentLocation, startPoint);
            if (startDistance <= PROXIMITY_THRESHOLD && startDistance > 50 && !this.isNearHome(startPoint)) {
              const placeKey = `activity-start-${activity.id}`;
              
              if (this.canNotifyForPlace(placeKey)) {
                nearbyPlaces.push({
                  id: activity.id,
                  type: 'activity_start',
                  name: `Start of ${activity.name || activity.type}`,
                  location: startPoint,
                  lastVisited: activityDate,
                  visitCount: 1,
                  distance: startDistance,
                });
              }
            }

            // Check end point if significantly different from start
            const endDistance = this.calculateDistance(currentLocation, endPoint);
            const startEndDistance = this.calculateDistance(startPoint, endPoint);
            
            // Only add end point if it's far enough from start point (> 500m)
            if (endDistance <= PROXIMITY_THRESHOLD && endDistance > 50 && 
                startEndDistance > 500 && !this.isNearHome(endPoint)) {
              const placeKey = `activity-end-${activity.id}`;
              
              if (this.canNotifyForPlace(placeKey)) {
                nearbyPlaces.push({
                  id: activity.id,
                  type: 'activity_end',
                  name: `End of ${activity.name || activity.type}`,
                  location: endPoint,
                  lastVisited: activityDate,
                  visitCount: 1,
                  distance: endDistance,
                });
              }
            }
          }
        }
      });

      // Sort by distance
      nearbyPlaces.sort((a, b) => a.distance - b.distance);
      
      // Limit to top 3 closest places
      return nearbyPlaces.slice(0, 3);

    } catch (error) {
      console.error('Error checking proximity:', error);
    }

    return nearbyPlaces;
  }

  /**
   * Send proximity notifications with better contextual messaging
   */
  static async sendProximityNotifications(
    userId: string,
    places: ProximityPlace[]
  ) {
    if (places.length === 0) return;

    const closestPlace = places[0];
    const timeSinceVisit = this.getTimeAgo(closestPlace.lastVisited);
    const daysSince = Math.floor((Date.now() - closestPlace.lastVisited.getTime()) / (1000 * 60 * 60 * 24));

    let title = '';
    let body = '';

    // More contextual notifications based on time since visit
    if (daysSince > 365) {
      title = '📍 Long time no see!';
      body = `You're near "${closestPlace.name}" - you haven't been here in over a year`;
    } else if (daysSince > 180) {
      title = '📍 Remember this spot?';
      body = `You're ${Math.round(closestPlace.distance)}m from "${closestPlace.name}" - last visited ${timeSinceVisit}`;
    } else if (daysSince > 90) {
      title = '📍 Rediscover this spot!';
      body = `"${closestPlace.name}" is nearby (${Math.round(closestPlace.distance)}m) - visited ${timeSinceVisit}`;
    } else if (daysSince > 30) {
      title = '📍 Back in the neighborhood';
      body = `"${closestPlace.name}" is ${Math.round(closestPlace.distance)}m away - visited ${timeSinceVisit}`;
    } else {
      // For recent visits (7-30 days), only notify if it's a frequently visited spot
      if (closestPlace.visitCount > 3) {
        title = '📍 One of your favorite spots!';
        body = `You're back near "${closestPlace.name}" - visited ${closestPlace.visitCount} times`;
      } else {
        // Don't notify for recent, infrequent spots
        return;
      }
    }

    // Update last notification time for all nearby places
    places.forEach(place => {
      const key = `${place.type}-${place.id}`;
      this.lastNotificationTime.set(key, new Date());
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
          days_since_visit: daysSince,
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
    // Keep last notification times for 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    for (const [key, date] of this.lastNotificationTime.entries()) {
      if (date < thirtyDaysAgo) {
        this.lastNotificationTime.delete(key);
      }
    }
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

  /**
   * Update user's home location manually
   */
  static async updateHomeLocation(
    userId: string, 
    location: { latitude: number; longitude: number }
  ) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ home_location: location })
        .eq('id', userId);

      if (!error) {
        this.homeLocation = location;
      }
    } catch (error) {
      console.error('Error updating home location:', error);
    }
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