// contexts/ActivityContext.tsx - Complete working version with debugging
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
  gpsStatus: "active" | "searching" | "stale" | "error";
  activities: Activity[];
  startTracking: (activityType: ActivityType) => Promise<void>;
  pauseTracking: () => void;
  resumeTracking: () => void;
  stopTracking: (name: string, notes?: string) => Promise<void>;
  deleteActivity: (activityId: string) => Promise<void>;
  addManualActivity: (activity: Omit<Activity, "id">) => Promise<void>;
  loading: boolean;
  error: string | null;
  refreshActivities: () => Promise<void>;
}

export type { Activity };

const ActivityContext = createContext<ActivityContextType | undefined>(
  undefined
);

// Background task
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
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(
    null
  );
  const [gpsStatus, setGpsStatus] = useState<
    "active" | "searching" | "stale" | "error"
  >("searching");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, session, refreshSession } = useAuth();

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

  // Load activities when user/session changes
  // Simplified useEffect for loading
  useEffect(() => {
    if (user?.id) {
      loadActivities();
    } else {
      setActivities([]);
    }
  }, [user?.id]);

  const testSupabaseConnection = async () => {
    try {
      console.log("🔍 Testing Supabase connection...");

      // First test if we can reach Supabase at all
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();
      console.log("Auth test:", { hasUser: !!currentUser, error: userError });

      if (!currentUser) {
        console.error("❌ No authenticated user found");
        return;
      }

      // Try a simple count query
      const { count, error: countError } = await supabase
        .from("activities")
        .select("*", { count: "exact", head: true })
        .eq("user_id", currentUser.id);

      console.log("Count query result:", { count, error: countError });
    } catch (err) {
      console.error("❌ Supabase connection test failed:", err);
    }
  };

  // Add this debug version to your ActivityContext to see what's failing:

  // In ActivityContext.tsx
  const loadActivities = async () => {
    if (!user) {
      console.log("loadActivities: No user");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log("📋 Loading activities for user:", user.id);

      // Force get a fresh session
      const {
        data: { session: freshSession },
      } = await supabase.auth.getSession();
      if (!freshSession) {
        throw new Error("No valid session");
      }

      const { data, error: fetchError } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .order("start_time", { ascending: false });

      console.log("Query result:", {
        success: !fetchError,
        dataCount: data?.length || 0,
        error: fetchError?.message,
      });

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        const transformedActivities = data.map((act) => ({
          id: act.id,
          type: act.type as ActivityType,
          name: act.name,
          startTime: new Date(act.start_time),
          endTime: new Date(act.end_time),
          duration: act.duration || 0,
          distance: act.distance || 0,
          route: act.route || [],
          averageSpeed: act.average_speed || 0,
          maxSpeed: act.max_speed || 0,
          elevationGain: act.elevation_gain,
          notes: act.notes,
          photos: act.photos,
          isManualEntry: act.is_manual_entry || false,
        }));

        setActivities(transformedActivities);
        console.log(
          "✅ Set",
          transformedActivities.length,
          "activities in state"
        );
      } else {
        setActivities([]);
      }
    } catch (err: any) {
      console.error("❌ Error loading activities:", err);
      setError(err.message || "Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  const refreshActivities = async () => {
    await loadActivities();
  };

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
          const speed = distance / 1000 / (timeDiff / 3600);
          if (speed < 100 && speed > maxSpeedRef.current) {
            maxSpeedRef.current = speed;
          }
        }

        setCurrentDistance((d) => d + distance);

        let newRoute = [...prev, location];
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
      setCurrentSpeed(location.coords.speed * 3.6);
    }
  };

  const startTracking = async (activityType: ActivityType) => {
    try {
      console.log("Starting tracking for:", activityType);
      setLoading(true);
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Location permission is required");
      }

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

      // Start duration timer
      durationInterval.current = setInterval(() => {
        if (startTimeRef.current && !pauseStartRef.current) {
          const elapsed = Math.floor(
            (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000
          );
          setCurrentDuration(elapsed);
        }
      }, 1000);

      // Start location tracking
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        handleLocationUpdate
      );

      setLoading(false);
    } catch (err) {
      console.error("Error starting tracking:", err);
      setError(err instanceof Error ? err.message : "Failed to start");
      setLoading(false);
      cleanupTracking();
    }
  };

  const pauseTracking = () => {
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

  const resumeTracking = async () => {
    if (pauseStartRef.current) {
      pausedTimeRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    setIsPaused(false);

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
        timeInterval: 3000,
        distanceInterval: 5,
      },
      handleLocationUpdate
    );
  };

  const stopTracking = async (name: string, notes?: string) => {
    try {
      if (name === "" && notes === "DISCARD_ACTIVITY") {
        await cleanupTracking();
        return;
      }

      if (!startTimeRef.current) {
        throw new Error("No activity data");
      }

      const finalDuration = Math.floor(
        (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000
      );

      const avgSpeed =
        currentDistance > 0
          ? currentDistance / 1000 / (finalDuration / 3600)
          : 0;

      const activity = {
        id: Date.now().toString(),
        type: currentActivity,
        name: name || `${currentActivity} activity`,
        startTime: new Date(startTimeRef.current),
        endTime: new Date(),
        duration: finalDuration,
        distance: currentDistance,
        route: currentRoute,
        averageSpeed: avgSpeed,
        maxSpeed: maxSpeedRef.current,
        notes: notes,
        isManualEntry: false,
      };

      await saveActivity(activity);
      await cleanupTracking();
    } catch (err) {
      console.error("Error stopping:", err);
      throw err;
    }
  };

  const saveActivity = async (activity: Activity): Promise<void> => {
    if (!user) throw new Error("No user");

    if (refreshSession) {
      const sessionValid = await refreshSession();
      if (!sessionValid) {
        throw new Error("Session expired. Please sign in again.");
      }
    }

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
        notes: activity.notes,
        is_manual_entry: activity.isManualEntry,
      })
      .select()
      .single();

    if (error) {
      // If auth error, try refresh and retry once
      if (error.message.includes("JWT") || error.message.includes("token")) {
        const retrySession = await refreshSession?.();
        if (retrySession) {
          // Retry the insert
          const { data: retryData, error: retryError } = await supabase
            .from("activities")
            .insert({
              /* same data */
            })
            .select()
            .single();

          if (!retryError && retryData) {
            setActivities((prev) => [
              { ...activity, id: retryData.id },
              ...prev,
            ]);
            return;
          }
        }
      }
      throw error;
    }
    if (data) {
      const newActivity = { ...activity, id: data.id };
      setActivities((prev) => [newActivity, ...prev]);
    }
  };

  const deleteActivity = async (activityId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("activities")
      .delete()
      .eq("id", activityId)
      .eq("user_id", user.id);

    if (error) throw error;
    setActivities((prev) => prev.filter((a) => a.id !== activityId));
  };

  const addManualActivity = async (activity: Omit<Activity, "id">) => {
    const newActivity = { ...activity, id: "" };
    await saveActivity(newActivity as Activity);
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
