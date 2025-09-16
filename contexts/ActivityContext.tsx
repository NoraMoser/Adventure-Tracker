// contexts/ActivityContext.tsx - Clean working version
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const LOCATION_TASK_NAME = "explorable-background-location";
const PENDING_LOCATIONS_KEY = "pending_location_updates";
const MAX_ROUTE_POINTS_MEMORY = 1000;

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
  name: string;
  type: ActivityType;
  startTime: Date;
  endTime: Date;
  activityDate: Date;
  duration: number;
  distance: number;
  route: LocationPoint[];
  averageSpeed: number;
  maxSpeed: number;
  notes?: string;
  photos?: string[];
  isManualEntry?: boolean;
  createdAt: Date;
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
  gpsStatus: "active" | "searching" | "stale" | "error";
  activities: Activity[];
  startTracking: (activityType: ActivityType) => Promise<void>;
  pauseTracking: () => void;
  resumeTracking: () => void;
  stopTracking: (
    name: string,
    notes?: string,
    photos?: string[]
  ) => Promise<void>;
  deleteActivity: (activityId: string) => Promise<void>;
  addManualActivity: (activity: Partial<Activity>) => Promise<void>;
  updateActivity: (
    activityId: string,
    updatedData: Partial<Activity>
  ) => Promise<void>;
  loading: boolean;
  error: string | null;
  refreshActivities: () => Promise<void>;
}

export type { Activity };

const ActivityContext = createContext<ActivityContextType | undefined>(
  undefined
);

// Background task definition
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("Background location task error:", error);
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
      const trimmed = pending.slice(-500);

      await AsyncStorage.setItem(
        PENDING_LOCATIONS_KEY,
        JSON.stringify(trimmed)
      );
    } catch (err) {
      console.error("Error storing background locations:", err);
    }
  }
});

// Helper function to calculate distance
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Earth's radius in meters
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
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(
    null
  );
  const [gpsStatus, setGpsStatus] = useState<
    "active" | "searching" | "stale" | "error"
  >("searching");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, refreshSession } = useAuth();

  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null
  );
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  const pauseStartRef = useRef<number | null>(null);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdateTime = useRef<number>(Date.now());
  const staleCheckInterval = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const maxSpeedRef = useRef<number>(0);

  useEffect(() => {
    if (user?.id) {
      loadActivities();
    } else {
      setActivities([]);
    }
  }, [user?.id]);

  useEffect(() => {
    return () => {
      cleanupTracking();
    };
  }, []);

  const loadActivities = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .order("activity_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (fetchError) throw fetchError;

      if (data && Array.isArray(data)) {
        const transformedActivities = data.map((act: any) => ({
          id: act.id,
          type: act.type as ActivityType,
          name: act.name,
          startTime: new Date(act.start_time),
          endTime: new Date(act.end_time),
          activityDate: act.activity_date
            ? new Date(act.activity_date)
            : new Date(act.start_time),
          duration: act.duration || 0,
          distance: act.distance || 0,
          route: Array.isArray(act.route) ? act.route : [],
          averageSpeed: act.average_speed || 0,
          maxSpeed: act.max_speed || 0,
          notes: act.notes,
          photos: act.photos,
          isManualEntry: act.is_manual_entry || false,
          createdAt: new Date(act.created_at || act.start_time),
        }));

        setActivities(transformedActivities);
      }
    } catch (err: any) {
      console.error("Error loading activities:", err);
      setError(err.message || "Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  const refreshActivities = async () => {
    await loadActivities();
  };

  const cleanupTracking = async () => {
    console.log("Cleaning up tracking...");

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
      const hasTask = await TaskManager.isTaskRegisteredAsync(
        LOCATION_TASK_NAME
      );
      if (hasTask) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (err) {
      console.log("Error stopping location task:", err);
    }

    setIsTracking(false);
    setIsPaused(false);
    setCurrentRoute([]);
    setCurrentDistance(0);
    setCurrentDuration(0);
    setCurrentSpeed(0);
    setCurrentLocation(null);
    setGpsStatus("searching");

    startTimeRef.current = null;
    pausedTimeRef.current = 0;
    pauseStartRef.current = null;
    maxSpeedRef.current = 0;
  };

  const processLocationUpdate = (location: LocationPoint) => {
    if (pauseStartRef.current) return;

    lastUpdateTime.current = Date.now();
    setGpsStatus("active");
    setCurrentLocation(location);

    // More lenient accuracy threshold
    if (!location.accuracy || location.accuracy <= 50) {
      setCurrentRoute((prev) => {
        const currentPoints = Array.isArray(prev) ? prev : [];

        if (currentPoints.length === 0) {
          console.log("First GPS point recorded");
          return [location];
        }

        const lastPoint = currentPoints[currentPoints.length - 1];
        if (!lastPoint) return [location];

        const distance = calculateDistance(
          lastPoint.latitude,
          lastPoint.longitude,
          location.latitude,
          location.longitude
        );

        // Lower minimum movement threshold
        if (distance < 1) {
          return currentPoints;
        }

        // Higher max jump threshold for vehicles
        if (distance > 1000) {
          console.log("GPS jump detected, ignoring point");
          return currentPoints;
        }

        const timeDiff = (location.timestamp - lastPoint.timestamp) / 1000;
        if (timeDiff > 0) {
          const speed = distance / 1000 / (timeDiff / 3600);

          if (speed < 200) {
            setCurrentSpeed(speed);
            if (speed > maxSpeedRef.current) {
              maxSpeedRef.current = speed;
            }
          }
        }

        setCurrentDistance((d) => d + distance);

        let newRoute = [...currentPoints, location];

        if (newRoute.length > MAX_ROUTE_POINTS_MEMORY) {
          const first = newRoute[0];
          const recent = newRoute.slice(-100);
          const middle = newRoute.slice(1, -100);
          const sampleRate = Math.ceil(
            middle.length / (MAX_ROUTE_POINTS_MEMORY - 101)
          );
          const sampled = middle.filter((_, index) => index % sampleRate === 0);
          newRoute = [first, ...sampled, ...recent];
        }

        return newRoute;
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
      const speedKmh = location.coords.speed * 3.6;
      setCurrentSpeed(speedKmh);
      if (speedKmh > maxSpeedRef.current) {
        maxSpeedRef.current = speedKmh;
      }
    }
  };

const startTracking = async (activityType: ActivityType) => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  try {
    console.log("Starting tracking for:", activityType);
    setLoading(true);
    setError(null);

    // Try to get location directly first (assumes permission already granted)
    let initialLocation;
    try {
      initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      console.log("Got initial location without permission check");
    } catch (err) {
      console.log("Failed to get location, checking permissions...");
      // Only check permissions if the first attempt failed
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Location permission is required");
      }
      // Try again after permission check
      initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
    }

    // Rest of your existing code starting from const initialPoint...

      const initialPoint: LocationPoint = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
        timestamp: Date.now(),
        accuracy: initialLocation.coords.accuracy || undefined,
      };

      setCurrentLocation(initialPoint);
      setCurrentRoute([initialPoint]);
      setGpsStatus("active");
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

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 2,
        },
        handleLocationUpdate
      );

      staleCheckInterval.current = setInterval(() => {
        const timeSinceLastUpdate = Date.now() - lastUpdateTime.current;
        if (timeSinceLastUpdate > 60000) {
          setGpsStatus("stale");
        }
      }, 10000);

      setLoading(false);
      console.log("Tracking started successfully");
    } catch (err: any) {
      console.error("Error starting tracking:", err);
      setError(err.message || "Failed to start tracking");
      setLoading(false);
      await cleanupTracking();
    }
  };

  const resumeTracking = async () => {
    console.log("Resuming tracking");

    if (pauseStartRef.current) {
      pausedTimeRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    setIsPaused(false);
    setGpsStatus("searching");
    lastUpdateTime.current = Date.now();

    durationInterval.current = setInterval(() => {
      if (startTimeRef.current && !pauseStartRef.current) {
        const elapsed = Math.floor(
          (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000
        );
        setCurrentDuration(elapsed);
      }
    }, 1000);

    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 2,
        },
        handleLocationUpdate
      );
    } catch (err) {
      console.error("Error resuming tracking:", err);
      setGpsStatus("error");
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
  };

  const stopTracking = async (
    name: string,
    notes?: string,
    photos?: string[]
  ) => {
    try {
      console.log("Stopping tracking...");

      if (name === "" && notes === "DISCARD_ACTIVITY") {
        await cleanupTracking();
        return;
      }

      if (!startTimeRef.current) {
        throw new Error("No activity data to save");
      }

      const finalDuration = Math.floor(
        (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000
      );

      const avgSpeed =
        currentDistance > 0
          ? currentDistance / 1000 / (finalDuration / 3600)
          : 0;

      const activity: Activity = {
        id: Date.now().toString(),
        type: currentActivity,
        name: name || `${currentActivity} activity`,
        activityDate: new Date(),
        startTime: new Date(startTimeRef.current),
        endTime: new Date(),
        duration: finalDuration,
        distance: currentDistance,
        route: Array.isArray(currentRoute) ? currentRoute : [],
        averageSpeed: avgSpeed,
        maxSpeed: maxSpeedRef.current,
        notes: notes,
        photos: photos,
        isManualEntry: false,
        createdAt: new Date(),
      };

      await saveActivity(activity);
      await cleanupTracking();

      console.log("Activity saved successfully");
    } catch (err: any) {
      console.error("Error stopping tracking:", err);
      throw err;
    }
  };

  const saveActivity = async (activity: Activity): Promise<void> => {
    if (!user) throw new Error("No user logged in");

    console.log("Saving activity to database...");

    if (refreshSession) {
      const sessionValid = await refreshSession();
      if (!sessionValid) {
        const pendingActivities = await AsyncStorage.getItem(
          "pending_activities"
        );
        const pending = pendingActivities ? JSON.parse(pendingActivities) : [];
        pending.push(activity);
        await AsyncStorage.setItem(
          "pending_activities",
          JSON.stringify(pending)
        );
        throw new Error("Session expired - activity saved locally");
      }
    }

    try {
      const { data, error } = await supabase
        .from("activities")
        .insert({
          user_id: user.id,
          type: activity.type,
          name: activity.name,
          activity_date: activity.activityDate.toISOString(),
          start_time: activity.startTime.toISOString(),
          end_time: activity.endTime.toISOString(),
          duration: activity.duration,
          distance: activity.distance,
          route: activity.route,
          average_speed: activity.averageSpeed,
          max_speed: activity.maxSpeed,
          notes: activity.notes,
          photos: activity.photos,
          is_manual_entry: activity.isManualEntry,
        })
        .select()
        .single();

      if (error) throw error;

      setActivities((prev) => [{ ...activity, id: data.id }, ...prev]);
    } catch (err: any) {
      console.error("Save failed:", err);
      throw err;
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
    } catch (err: any) {
      console.error("Error deleting activity:", err);
      throw err;
    }
  };

  const updateActivity = async (
    activityId: string,
    updatedData: Partial<Activity>
  ) => {
    if (!user) throw new Error("No user logged in");

    try {
      const updateData: any = {};

      if (updatedData.name !== undefined) updateData.name = updatedData.name;
      if (updatedData.notes !== undefined) updateData.notes = updatedData.notes;
      if (updatedData.route !== undefined) updateData.route = updatedData.route;
      if (updatedData.distance !== undefined)
        updateData.distance = updatedData.distance;
      if (updatedData.duration !== undefined)
        updateData.duration = updatedData.duration;
      if (updatedData.photos !== undefined)
        updateData.photos = updatedData.photos;
      if (updatedData.averageSpeed !== undefined)
        updateData.average_speed = updatedData.averageSpeed;
      if (updatedData.maxSpeed !== undefined)
        updateData.max_speed = updatedData.maxSpeed;
      if (updatedData.activityDate)
        updateData.activity_date = updatedData.activityDate.toISOString();

      const { error } = await supabase
        .from("activities")
        .update(updateData)
        .eq("id", activityId)
        .eq("user_id", user.id);

      if (error) throw error;

      setActivities((prev) =>
        prev.map((activity) =>
          activity.id === activityId
            ? { ...activity, ...updatedData }
            : activity
        )
      );
    } catch (err: any) {
      console.error("Error updating activity:", err);
      throw err;
    }
  };

  const addManualActivity = async (activity: Partial<Activity>) => {
    const newActivity: Activity = {
      id: Date.now().toString(),
      type: activity.type || "other",
      name: activity.name || "Manual activity",
      activityDate: activity.activityDate || new Date(),
      startTime: activity.startTime || new Date(),
      endTime: activity.endTime || new Date(),
      duration: activity.duration || 0,
      distance: activity.distance || 0,
      route: activity.route || [],
      averageSpeed: activity.averageSpeed || 0,
      maxSpeed: activity.maxSpeed || 0,
      notes: activity.notes,
      photos: activity.photos,
      isManualEntry: true,
      createdAt: new Date(),
    };

    await saveActivity(newActivity);
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
    updateActivity,
    loading,
    error,
    refreshActivities,
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
