import * as Location from "expo-location";
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
}

interface Activity {
  id: string;
  type: ActivityType;
  name: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in seconds
  distance: number; // in meters
  route: LocationPoint[];
  averageSpeed: number; // km/h
  maxSpeed: number; // km/h
  elevationGain?: number; // in meters
  notes?: string;
  photos?: string[];
  isManualEntry: boolean;
}

interface ActivityContextType {
  // Current tracking state
  isTracking: boolean;
  isPaused: boolean;
  currentActivity: ActivityType;
  currentRoute: LocationPoint[];
  currentDistance: number;
  currentDuration: number;
  currentSpeed: number;
  location: LocationPoint | null;

  // Saved activities
  activities: Activity[];

  // Actions
  startTracking: (activityType: ActivityType) => Promise<void>;
  pauseTracking: () => void;
  resumeTracking: () => void;
  stopTracking: (name: string, notes?: string) => Promise<void>;
  deleteActivity: (activityId: string) => Promise<void>;
  addManualActivity: (activity: Omit<Activity, "id">) => Promise<void>;

  // Utils
  loading: boolean;
  error: string | null;
}
export type { Activity };

const ActivityContext = createContext<ActivityContextType | undefined>(
  undefined
);

// Utility function to calculate distance between two points (Haversine formula)
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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null
  );
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0); // Track total paused time
  const pauseStartRef = useRef<number | null>(null); // When pause started
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user) {
      loadActivities();
    } else {
      setActivities([]); // Clear activities when no user
    }
  }, [user]);

  const loadActivities = async () => {
    if (!user) {
      setActivities([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .order("start_time", { ascending: false });

      if (error) throw error;

      if (data) {
        // Transform database format to app format
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
  const saveActivity = async (activity: Activity): Promise<Activity | null> => {
    if (!user) {
      console.error("No user logged in");
      return null;
    }

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
          id: data.id,
          type: data.type as ActivityType,
          name: data.name,
          startTime: new Date(data.start_time),
          endTime: new Date(data.end_time),
          duration: data.duration,
          distance: data.distance,
          route: data.route || [],
          averageSpeed: data.average_speed,
          maxSpeed: data.max_speed,
          elevationGain: data.elevation_gain,
          notes: data.notes,
          photos: data.photos,
          isManualEntry: data.is_manual_entry,
        };

        // Update local state
        setActivities((prev) => [...prev, newActivity]);
        return newActivity;
      }
      return null;
    } catch (error) {
      console.error("Error saving activity:", error);
      throw error;
    }
  };
  const startTracking = async (activityType: ActivityType) => {
    try {
      console.log("Starting tracking for:", activityType);
      setLoading(true);
      setError(null);

      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log("Foreground permission:", status);
      if (status !== "granted") {
        setError("Location permission is required for tracking");
        setLoading(false);
        return;
      }

      // Request background permission for continuous tracking (optional)
      try {
        const { status: bgStatus } =
          await Location.requestBackgroundPermissionsAsync();
        console.log("Background permission:", bgStatus);
      } catch (e) {
        console.log("Background permission not available:", e);
      }

      // Set activity type and start tracking
      setCurrentActivity(activityType);
      setIsTracking(true);
      setIsPaused(false);
      setCurrentRoute([]);
      setCurrentDistance(0);
      setCurrentDuration(0);
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;
      pauseStartRef.current = null;

      // Start duration timer - update every second
      durationInterval.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor(
            (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000
          );
          setCurrentDuration(elapsed);
        }
      }, 1000);

      console.log("Starting location watch...");
      // Start location tracking
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 5, // Update every 5 meters
        },
        (location) => {
          console.log("Location update received");
          if (!pauseStartRef.current) {
            // Only track location if not paused
            const newPoint: LocationPoint = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              timestamp: location.timestamp,
              altitude: location.coords.altitude || undefined,
            };

            setCurrentLocation(newPoint);
            setCurrentRoute((prev) => {
              const updatedRoute = [...prev, newPoint];

              // Calculate distance
              if (prev.length > 0) {
                const lastPoint = prev[prev.length - 1];
                const distance = calculateDistance(
                  lastPoint.latitude,
                  lastPoint.longitude,
                  newPoint.latitude,
                  newPoint.longitude
                );
                setCurrentDistance((prevDist) => prevDist + distance);
              }

              // Calculate current speed
              if (location.coords.speed && location.coords.speed > 0) {
                setCurrentSpeed(location.coords.speed * 3.6); // Convert m/s to km/h
              }

              return updatedRoute;
            });
          }
        }
      );

      console.log("Tracking started successfully");
      setLoading(false);
    } catch (err) {
      console.error("Error starting tracking:", err);
      setError("Failed to start tracking");
      setLoading(false);
    }
  };

  const pauseTracking = () => {
    setIsPaused(true);
    pauseStartRef.current = Date.now();

    // Stop the duration timer
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
  };

  const resumeTracking = () => {
    if (pauseStartRef.current) {
      // Add the paused duration to total paused time
      pausedTimeRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    setIsPaused(false);

    // Restart the duration timer
    durationInterval.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor(
          (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000
        );
        setCurrentDuration(elapsed);
      }
    }, 1000);
  };

  const stopTracking = async (name: string, notes?: string) => {
    try {
      // Clean up tracking resources
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      // Check if this is a discard action
      if (name === "" && notes === "DISCARD_ACTIVITY") {
        console.log("Discarding activity - not saving");
        // Reset tracking state without saving
        setIsTracking(false);
        setIsPaused(false);
        setCurrentRoute([]);
        setCurrentDistance(0);
        setCurrentDuration(0);
        setCurrentSpeed(0);
        setCurrentLocation(null);
        startTimeRef.current = null;
        pausedTimeRef.current = 0;
        pauseStartRef.current = null;
        return; // Exit without saving
      }

      // Only save if we have a valid name or meaningful data
      if (name || currentDistance > 0) {
        console.log("Saving activity:", name);

        // Calculate final duration accounting for paused time
        let finalDuration = currentDuration;

        // If we're currently paused, we already have the correct duration
        // If not paused, calculate one final time
        if (!pauseStartRef.current && startTimeRef.current) {
          finalDuration = Math.floor(
            (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000
          );
        }

        // Calculate final stats
        const endTime = new Date();
        const startTime = new Date(startTimeRef.current || Date.now());
        const avgSpeed =
          currentDistance > 0
            ? currentDistance / 1000 / (finalDuration / 3600)
            : 0;

        // Find max speed from route
        let maxSpeed = 0;
        for (let i = 1; i < currentRoute.length; i++) {
          const timeDiff =
            (currentRoute[i].timestamp - currentRoute[i - 1].timestamp) / 1000; // seconds
          if (timeDiff > 0) {
            const dist = calculateDistance(
              currentRoute[i - 1].latitude,
              currentRoute[i - 1].longitude,
              currentRoute[i].latitude,
              currentRoute[i].longitude
            );
            const speed = dist / 1000 / (timeDiff / 3600); // km/h
            maxSpeed = Math.max(maxSpeed, speed);
          }
        }

        const newActivity: Activity = {
          id: Date.now().toString(),
          type: currentActivity,
          name: name || `${currentActivity} activity`,
          startTime,
          endTime,
          duration: finalDuration,
          distance: currentDistance,
          route: currentRoute,
          averageSpeed: avgSpeed,
          maxSpeed,
          notes: notes && notes !== "DISCARD_ACTIVITY" ? notes : undefined,
          isManualEntry: false,
        };

        await saveActivity(newActivity);
        console.log("Activity saved successfully");
      }

      // Reset tracking state
      setIsTracking(false);
      setIsPaused(false);
      setCurrentRoute([]);
      setCurrentDistance(0);
      setCurrentDuration(0);
      setCurrentSpeed(0);
      setCurrentLocation(null);
      startTimeRef.current = null;
      pausedTimeRef.current = 0;
      pauseStartRef.current = null;
    } catch (err) {
      console.error("Error stopping tracking:", err);
      setError("Failed to stop tracking");
    }
  };

  const deleteActivity = async (activityId: string) => {
    if (!user) {
      console.error("No user logged in");
      return;
    }
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
    if (!user) {
      console.error("No user logged in");
      return;
    }
    try {
      const newActivity: Activity = {
        ...activity,
        id: "", // Will be set by database
        isManualEntry: true,
      };

      await saveActivity(newActivity);
      console.log("Manual activity added successfully");
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
