// contexts/ActivityContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from "expo-location";
import * as TaskManager from 'expo-task-manager';
import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const LOCATION_TASK_NAME = 'explorable-background-location';
const PENDING_LOCATIONS_KEY = 'pending_location_updates';

export type ActivityType =
  | "bike"
  | "run"
  | "walk"
  | "hike"
  | "paddleboard"
  | "climb"
  | "other";

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  altitude?: number;
  accuracy?: number;
}

interface Activity {
  id: string;
  type: ActivityType;
  name: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  distance: number;
  route: LocationPoint[];
  averageSpeed: number;
  maxSpeed: number;
  elevationGain?: number;
  notes?: string;
  photos?: string[];
  isManualEntry: boolean;
}

interface ActivityContextType {
  isTracking: boolean;
  isPaused: boolean;
  currentActivity: ActivityType;
  currentRoute: LocationPoint[];
  currentDistance: number;
  currentDuration: number;
  currentSpeed: number;
  location: LocationPoint | null;
  gpsStatus: 'active' | 'searching' | 'stale' | 'error';
  activities: Activity[];
  startTracking: (activityType: ActivityType) => Promise<void>;
  pauseTracking: () => void;
  resumeTracking: () => void;
  stopTracking: (name: string, notes?: string) => Promise<void>;
  deleteActivity: (activityId: string) => Promise<void>;
  addManualActivity: (activity: Omit<Activity, "id">) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export type { Activity };

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

// Define background task outside component
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;
    
    try {
      const stored = await AsyncStorage.getItem(PENDING_LOCATIONS_KEY);
      const pending = stored ? JSON.parse(stored) : [];
      
      const newLocations = locations.map((loc: Location.LocationObject) => ({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: loc.timestamp,
        altitude: loc.coords.altitude,
        accuracy: loc.coords.accuracy,
      }));
      
      pending.push(...newLocations);
      const trimmed = pending.slice(-1000);
      
      await AsyncStorage.setItem(PENDING_LOCATIONS_KEY, JSON.stringify(trimmed));
      console.log(`Stored ${newLocations.length} background locations`);
    } catch (err) {
      console.error('Error storing background locations:', err);
    }
  }
});

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const ActivityProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<ActivityType>("bike");
  const [currentRoute, setCurrentRoute] = useState<LocationPoint[]>([]);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'active' | 'searching' | 'stale' | 'error'>('searching');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  const pauseStartRef = useRef<number | null>(null);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdateTime = useRef<number>(Date.now());
  const staleCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxSpeedRef = useRef<number>(0);

  // Check for stale GPS
  useEffect(() => {
    if (isTracking && !isPaused) {
      staleCheckInterval.current = setInterval(() => {
        const timeSinceUpdate = Date.now() - lastUpdateTime.current;
        if (timeSinceUpdate > 15000) {
          setGpsStatus('stale');
        } else if (timeSinceUpdate > 10000) {
          setGpsStatus('searching');
        }
      }, 5000);
    } else {
      if (staleCheckInterval.current) {
        clearInterval(staleCheckInterval.current);
      }
    }

    return () => {
      if (staleCheckInterval.current) {
        clearInterval(staleCheckInterval.current);
      }
    };
  }, [isTracking, isPaused]);

  // Process pending locations when app becomes active
  useEffect(() => {
    const processPendingLocations = async () => {
      if (!isTracking || isPaused) return;

      try {
        const stored = await AsyncStorage.getItem(PENDING_LOCATIONS_KEY);
        if (stored) {
          const locations = JSON.parse(stored);
          console.log(`Processing ${locations.length} pending locations`);
          
          locations.forEach((loc: LocationPoint) => {
            processLocationUpdate(loc);
          });
          
          await AsyncStorage.removeItem(PENDING_LOCATIONS_KEY);
        }
      } catch (err) {
        console.error('Error processing pending locations:', err);
      }
    };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        processPendingLocations();
        
        if (isTracking && !isPaused && !locationSubscription.current) {
          startForegroundTracking();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    if (AppState.currentState === 'active') {
      processPendingLocations();
    }

    return () => subscription.remove();
  }, [isTracking, isPaused]);

  // Load activities on user change
  useEffect(() => {
    if (user) {
      loadActivities();
    } else {
      setActivities([]);
    }
  }, [user]);

  // Cleanup on user logout
  useEffect(() => {
    if (!user) {
      cleanupTracking();
    }
  }, [user]);

  const cleanupTracking = async () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    if (staleCheckInterval.current) {
      clearInterval(staleCheckInterval.current);
      staleCheckInterval.current = null;
    }
    try {
      const hasTask = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (hasTask) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (err) {
      console.log('Error stopping location task:', err);
    }
    
    setIsTracking(false);
    setIsPaused(false);
    setCurrentRoute([]);
    setCurrentDistance(0);
    setCurrentDuration(0);
    setCurrentSpeed(0);
    setCurrentLocation(null);
    setGpsStatus('searching');
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
    pauseStartRef.current = null;
    maxSpeedRef.current = 0;
  };

  const loadActivities = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .order("start_time", { ascending: false });

      if (error) throw error;

      if (data) {
        const transformedActivities = data.map((act) => ({
          id: act.id,
          type: act.type as ActivityType,
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
          photos: act.photos,
          isManualEntry: act.is_manual_entry,
        }));
        setActivities(transformedActivities);
      }
    } catch (err) {
      console.error("Error loading activities:", err);
      setError("Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  const processLocationUpdate = (location: LocationPoint) => {
    if (pauseStartRef.current) return;

    lastUpdateTime.current = Date.now();
    setGpsStatus('active');
    setCurrentLocation(location);

    if (!location.accuracy || location.accuracy <= 30) {
      setCurrentRoute((prev) => {
        if (prev.length === 0) return [location];

        const lastPoint = prev[prev.length - 1];
        const distance = calculateDistance(
          lastPoint.latitude,
          lastPoint.longitude,
          location.latitude,
          location.longitude
        );

        if (distance < 2 || distance > 500) {
          return prev;
        }

        const timeDiff = (location.timestamp - lastPoint.timestamp) / 1000;
        if (timeDiff > 0) {
          const speed = (distance / 1000) / (timeDiff / 3600);
          if (speed < 100 && speed > maxSpeedRef.current) {
            maxSpeedRef.current = speed;
          }
        }

        setCurrentDistance((d) => d + distance);
        return [...prev, location];
      });
    }
  };

  const handleLocationUpdate = (location: Location.LocationObject) => {
    const point: LocationPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: location.timestamp,
      altitude: location.coords.altitude || undefined,
      accuracy: location.coords.accuracy || undefined,
    };

    processLocationUpdate(point);

    if (location.coords.speed !== null && location.coords.speed >= 0) {
      setCurrentSpeed(location.coords.speed * 3.6);
    }
  };

  const startForegroundTracking = async () => {
    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        handleLocationUpdate
      );
    } catch (err) {
      console.error('Error starting foreground tracking:', err);
      setGpsStatus('error');
    }
  };

  const startTracking = async (activityType: ActivityType) => {
    try {
      console.log("Starting tracking for:", activityType);
      setLoading(true);
      setError(null);

      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== "granted") {
        throw new Error("Location permission is required for tracking");
      }

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        try {
          const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
          console.log("Background permission:", backgroundStatus);
        } catch (e) {
          console.log("Background permission error:", e);
        }
      }

      try {
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });

        const initialPoint: LocationPoint = {
          latitude: initialLocation.coords.latitude,
          longitude: initialLocation.coords.longitude,
          timestamp: Date.now(),
          accuracy: initialLocation.coords.accuracy || undefined,
        };

        setCurrentLocation(initialPoint);
        setCurrentRoute([initialPoint]);
        setGpsStatus('active');
      } catch (err) {
        console.log("Could not get initial location:", err);
        setGpsStatus('searching');
      }

      setCurrentActivity(activityType);
      setIsTracking(true);
      setIsPaused(false);
      setCurrentDistance(0);
      setCurrentDuration(0);
      setCurrentSpeed(0);
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;
      pauseStartRef.current = null;
      lastUpdateTime.current = Date.now();
      maxSpeedRef.current = 0;

      durationInterval.current = setInterval(() => {
        if (startTimeRef.current && !pauseStartRef.current) {
          const elapsed = Math.floor(
            (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000
          );
          setCurrentDuration(elapsed);
        }
      }, 1000);

      await startForegroundTracking();

      const hasTask = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (hasTask) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 10,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
        showsBackgroundLocationIndicator: true,
        ...(Platform.OS === 'android' && {
          foregroundService: {
            notificationTitle: 'ExplorAble',
            notificationBody: 'Tracking your activity',
            notificationColor: '#2E5A3E',
          },
        }),
      });

      console.log("Tracking started successfully");
      setLoading(false);
    } catch (err) {
      console.error("Error starting tracking:", err);
      setError(err instanceof Error ? err.message : "Failed to start tracking");
      setLoading(false);
      cleanupTracking();
    }
  };

  const pauseTracking = () => {
    console.log("Pausing tracking");
    setIsPaused(true);
    pauseStartRef.current = Date.now();

    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }

    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    
    Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(console.error);
  };

  const resumeTracking = async () => {
    console.log("Resuming tracking");
    if (pauseStartRef.current) {
      pausedTimeRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    setIsPaused(false);

    durationInterval.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor(
          (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000
        );
        setCurrentDuration(elapsed);
      }
    }, 1000);

    await startForegroundTracking();
    
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 10,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
        showsBackgroundLocationIndicator: true,
      });
    } catch (err) {
      console.error('Error resuming background tracking:', err);
    }
  };

  const stopTracking = async (name: string, notes?: string) => {
    try {
      console.log("Stopping tracking, route points:", currentRoute.length);
      
      if (name === "" && notes === "DISCARD_ACTIVITY") {
        console.log("Discarding activity");
        await cleanupTracking();
        return;
      }

      if (!startTimeRef.current || (currentDistance === 0 && currentRoute.length === 0)) {
        throw new Error("No activity data to save");
      }

      const finalDuration = Math.floor(
        (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000
      );

      const avgSpeed = currentDistance > 0
        ? (currentDistance / 1000) / (finalDuration / 3600)
        : 0;

      let routeToSave = currentRoute;
      if (currentRoute.length > 500) {
        const nth = Math.ceil(currentRoute.length / 500);
        routeToSave = currentRoute.filter((_, index) => index % nth === 0);
        console.log(`Simplified route from ${currentRoute.length} to ${routeToSave.length} points`);
      }

      const activityData = {
        id: Date.now().toString(),
        type: currentActivity,
        name: name || `${currentActivity} activity`,
        startTime: new Date(startTimeRef.current),
        endTime: new Date(),
        duration: finalDuration,
        distance: currentDistance,
        route: routeToSave,
        averageSpeed: avgSpeed,
        maxSpeed: maxSpeedRef.current,
        notes: notes && notes !== "DISCARD_ACTIVITY" ? notes : undefined,
        isManualEntry: false,
      };

      console.log("Saving activity to database...");
      const saved = await saveActivity(activityData);
      
      if (!saved) {
        throw new Error("Failed to save to database");
      }

      console.log("Activity saved successfully:", saved.id);
      await cleanupTracking();
      
    } catch (err) {
      console.error("Error in stopTracking:", err);
      throw err;
    }
  };

  const saveActivity = async (activity: Activity): Promise<Activity | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("activities")
        .insert({
          user_id: user.id,
          type: activity.type,
          name: activity.name,
          start_time: activity.startTime.toISOString(),
          end_time: activity.endTime.toISOString(),
          duration: activity.duration,
          distance: activity.distance,
          route: activity.route,
          average_speed: activity.averageSpeed,
          max_speed: activity.maxSpeed,
          elevation_gain: activity.elevationGain,
          notes: activity.notes,
          photos: activity.photos,
          is_manual_entry: activity.isManualEntry,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newActivity: Activity = {
          ...activity,
          id: data.id,
        };
        setActivities((prev) => [newActivity, ...prev]);
        await new Promise(resolve => setTimeout(resolve, 100));
        return newActivity;
      }
      return null;
    } catch (error) {
      console.error("Error saving activity:", error);
      throw error;
    }
  };

  const deleteActivity = async (activityId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from("activities")
        .delete()
        .eq("id", activityId)
        .eq("user_id", user.id);

      if (error) throw error;
      setActivities((prev) => prev.filter((a) => a.id !== activityId));
    } catch (err) {
      console.error("Error deleting activity:", err);
      setError("Failed to delete activity");
    }
  };

  const addManualActivity = async (activity: Omit<Activity, "id">) => {
    if (!user) return;
    
    try {
      const newActivity: Activity = {
        ...activity,
        id: "",
        isManualEntry: true,
      };

      await saveActivity(newActivity);
    } catch (err) {
      console.error("Error adding manual activity:", err);
      setError("Failed to add activity");
    }
  };

  const value: ActivityContextType = {
    isTracking,
    isPaused,
    currentActivity,
    currentRoute,
    currentDistance,
    currentDuration,
    currentSpeed,
    location: currentLocation,
    gpsStatus,
    activities,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    deleteActivity,
    addManualActivity,
    loading,
    error,
  };

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
};

export const useActivity = () => {
  const context = useContext(ActivityContext);
  if (context === undefined) {
    throw new Error("useActivity must be used within an ActivityProvider");
  }
  return context;
};