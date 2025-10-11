// contexts/ActivityContext.tsx - Adaptive tracking version
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
import * as MediaLibrary from "expo-media-library";
import { Alert } from "react-native";

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
) => Promise<Activity | void>; 
  deleteActivity: (activityId: string) => Promise<void>;
  addManualActivity: (activity: Partial<Activity>) => Promise<Activity>; // Change this line
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
  const [lastGpsAlertTime, setLastGpsAlertTime] = useState<number>(0);
  const poorGpsStartTime = useRef<number | null>(null);

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
    setLastGpsAlertTime(0);
    setGpsStatus("searching");

    poorGpsStartTime.current = null;
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
    pauseStartRef.current = null;
    maxSpeedRef.current = 0;
  };

  // Helper functions for activity-based thresholds
  const getAccuracyThreshold = () => {
    switch (currentActivity) {
      case "walk":
      case "hike":
      case "climb":
        return 30; // Stricter for slow activities
      case "run":
        return 50; // Medium
      case "bike":
      case "paddleboard":
        return 75; // More lenient
      case "other":
        return 100; // Most lenient for vehicles
      default:
        return 50;
    }
  };

  const getMovementThresholds = () => {
    switch (currentActivity) {
      case "walk":
        return {
          minDistance: 0.5, // 0.5m minimum movement
          maxJump: 100, // 100m max instant jump
          maxSpeed: 10, // 10 km/h max walking speed
        };
      case "hike":
      case "climb":
        return {
          minDistance: 0.5,
          maxJump: 200,
          maxSpeed: 15,
        };
      case "run":
        return {
          minDistance: 1,
          maxJump: 500,
          maxSpeed: 30,
        };
      case "bike":
        return {
          minDistance: 2,
          maxJump: 2000,
          maxSpeed: 80,
        };
      case "paddleboard":
        return {
          minDistance: 1,
          maxJump: 1000,
          maxSpeed: 25,
        };
      case "other": // For vehicles/ferries
        return {
          minDistance: 5,
          maxJump: 10000,
          maxSpeed: 200,
        };
      default:
        return {
          minDistance: 1,
          maxJump: 1000,
          maxSpeed: 50,
        };
    }
  };

  const checkGpsQuality = (accuracy: number | undefined) => {
    if (!accuracy || !isTracking || isPaused) return;

    const threshold = getAccuracyThreshold();
    const now = Date.now();

    // If GPS accuracy is very poor (>3x threshold)
    if (accuracy > threshold * 3) {
      // Only alert every 5 minutes to avoid spam
      if (now - lastGpsAlertTime > 300000) {
        // 5 minutes
        Alert.alert(
          "Poor GPS Signal",
          `GPS accuracy has degraded to ±${Math.round(
            accuracy
          )}m. Continue moving - the app will connect your route when signal improves.`,
          [{ text: "OK", style: "default" }]
        );
        setLastGpsAlertTime(now);
      }

      // Track how long GPS has been poor
      if (!poorGpsStartTime.current) {
        poorGpsStartTime.current = now;
      }
    } else {
      // GPS improved
      if (poorGpsStartTime.current) {
        const poorDuration = Math.round(
          (now - poorGpsStartTime.current) / 1000
        );
        if (poorDuration > 60) {
          // If it was poor for over a minute
          Alert.alert(
            "GPS Signal Restored",
            `Good GPS signal restored after ${poorDuration} seconds. Route tracking resumed normally.`,
            [{ text: "Great!", style: "default" }]
          );
        }
        poorGpsStartTime.current = null;
      }
    }
  };

  const processLocationUpdate = (location: LocationPoint) => {
    if (pauseStartRef.current) return;

    lastUpdateTime.current = Date.now();
    setGpsStatus("active");
    setCurrentLocation(location);

    // Activity-based accuracy thresholds
    const accuracyThreshold = getAccuracyThreshold();

    if (!location.accuracy || location.accuracy <= accuracyThreshold) {
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

        const timeDiff = (location.timestamp - lastPoint.timestamp) / 1000;

        // Activity-based movement validation
        const movementThresholds = getMovementThresholds();

        // Skip if no meaningful movement for the activity type
        if (distance < movementThresholds.minDistance) {
          return currentPoints;
        }

        // Handle GPS gaps differently based on activity
        if (timeDiff > 30) {
          // Check if the jump is reasonable for the activity type
          const maxReasonableDistance =
            movementThresholds.maxSpeed * (timeDiff / 3600) * 1000;

          if (distance <= maxReasonableDistance * 1.5) {
            setCurrentDistance((d) => d + distance);
            return [...currentPoints, location];
          } else {
            // For vehicles, still accept it if gap is long enough
            if (currentActivity === "bike" || currentActivity === "other") {
              if (timeDiff > 60) {
                setCurrentDistance((d) => d + distance);
                return [...currentPoints, location];
              }
            }
            return currentPoints;
          }
        }

        // Normal continuous tracking
        if (distance > movementThresholds.maxJump) {
          return currentPoints;
        }

        // Update speed
        if (timeDiff > 0) {
          const speed = distance / 1000 / (timeDiff / 3600);
          if (speed < movementThresholds.maxSpeed) {
            setCurrentSpeed(speed);
            if (speed > maxSpeedRef.current) {
              maxSpeedRef.current = speed;
            }
          }
        }

        setCurrentDistance((d) => d + distance);

        let newRoute = [...currentPoints, location];

        // Memory management
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
    } else {
  
      setCurrentLocation(location);

      // For vehicles with poor GPS, still try to track
      if (currentActivity === "other" && location.accuracy <= 200) {
        setCurrentRoute((prev) => {
          const currentPoints = Array.isArray(prev) ? prev : [];
          if (currentPoints.length > 0) {
            const lastPoint = currentPoints[currentPoints.length - 1];
            const timeDiff = (location.timestamp - lastPoint.timestamp) / 1000;

            // If significant time has passed, add the point anyway
            if (timeDiff > 60) {
              const distance = calculateDistance(
                lastPoint.latitude,
                lastPoint.longitude,
                location.latitude,
                location.longitude
              );
              setCurrentDistance((d) => d + distance);
              return [...currentPoints, location];
            }
          }
          return currentPoints;
        });
      }
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
    checkGpsQuality(location.coords.accuracy);

    if (location.coords.speed !== null && location.coords.speed >= 0) {
      const speedKmh = location.coords.speed * 3.6;
      setCurrentSpeed(speedKmh);
      if (speedKmh > maxSpeedRef.current) {
        maxSpeedRef.current = speedKmh;
      }
    }
  };

  const startTracking = async (activityType: ActivityType) => {
    try {
      console.log("Starting tracking for:", activityType);
      setLoading(true);
      setError(null);

      // First, try to get last known position immediately (fast)
      let initialLocation = await Location.getLastKnownPositionAsync({
        maxAge: 60000, // Accept location up to 1 minute old
        requiredAccuracy: 1000, // Accept within 1km accuracy for quick start
      });

      // If no last known location or it's too old, get current position
      if (!initialLocation || Date.now() - initialLocation.timestamp > 60000) {
        console.log("No recent last known location, getting current...");

        // Try with balanced accuracy first (faster)
        try {
          initialLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        } catch (err) {
          console.log("Balanced accuracy failed, trying high accuracy...");
          // Fall back to high accuracy if balanced fails
          initialLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
        }
      }

      // NEW PART: Check GPS accuracy and alert user if poor
      const accuracy = initialLocation.coords.accuracy;
      const accuracyThreshold = getAccuracyThreshold(); // Uses your existing function

      if (accuracy && accuracy > accuracyThreshold * 2) {
        // Very poor signal
        Alert.alert(
          "Weak GPS Signal",
          `GPS accuracy is currently ±${Math.round(
            accuracy
          )}m. Starting your ${activityType} activity anyway - we'll connect the dots when signal improves!\n\nTip: GPS works best with clear sky view.`,
          [
            {
              text: "Got it!",
              style: "default",
            },
          ]
        );
      }
      // END OF NEW PART

      // Start tracking immediately with whatever location we have
      const initialPoint: LocationPoint = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
        timestamp: Date.now(),
        accuracy: initialLocation.coords.accuracy || undefined,
      };

      // Set initial state immediately
      setCurrentLocation(initialPoint);
      setCurrentRoute([initialPoint]);
      setGpsStatus(
        initialLocation.coords.accuracy && initialLocation.coords.accuracy > 50
          ? "searching"
          : "active"
      );
      setCurrentActivity(activityType);
      setIsTracking(true);
      setIsPaused(false);
      setCurrentDistance(0);
      setCurrentDuration(0);
      setCurrentSpeed(0);
      setLoading(false); // Stop loading immediately once we have any position

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

      // Adaptive accuracy based on activity type
      const locationAccuracy =
        activityType === "walk" ||
        activityType === "hike" ||
        activityType === "climb"
          ? Location.Accuracy.BestForNavigation
          : Location.Accuracy.Balanced;

      // Start tracking with activity-appropriate settings
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: locationAccuracy,
          timeInterval: 3000, // Check every 3 seconds
          distanceInterval: activityType === "other" ? 10 : 5, // Less frequent for vehicles
          mayShowUserSettingsDialog: true,
        },
        (location) => {
          handleLocationUpdate(location);
          // Update GPS status based on accuracy
          const threshold = getAccuracyThreshold();
          if (
            location.coords.accuracy &&
            location.coords.accuracy <= threshold / 2
          ) {
            setGpsStatus("active");
          } else if (
            location.coords.accuracy &&
            location.coords.accuracy <= threshold
          ) {
            setGpsStatus("searching");
          } else {
            setGpsStatus("stale");
          }
        }
      );

      // Check for stale GPS
      staleCheckInterval.current = setInterval(() => {
        const timeSinceLastUpdate = Date.now() - lastUpdateTime.current;
        if (timeSinceLastUpdate > 60000) {
          setGpsStatus("stale");
        } else if (timeSinceLastUpdate > 30000) {
          setGpsStatus("searching");
        }
      }, 10000);

    } catch (err: any) {
      console.error("Error starting tracking:", err);
      setError(err.message || "Failed to start tracking");
      setLoading(false);
      await cleanupTracking();
      throw err;
    }
  };

  const resumeTracking = async () => {
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
      const locationAccuracy =
        currentActivity === "walk" ||
        currentActivity === "hike" ||
        currentActivity === "climb"
          ? Location.Accuracy.BestForNavigation
          : Location.Accuracy.Balanced;

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: locationAccuracy,
          timeInterval: 3000,
          distanceInterval: currentActivity === "other" ? 10 : 5,
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
    
    // Get the saved activity with proper ID from database
    const savedActivity = {
      ...activity,
      id: activities[0]?.id || activity.id // Get the real ID from state after save
    };
    
    await cleanupTracking();

    console.log("Activity saved successfully");
    return savedActivity; // RETURN THE ACTIVITY HERE
  } catch (err: any) {
    console.error("Error stopping tracking:", err);
    throw err;
  }

};

  const savePhotosToGallery = async (photos: string[]) => {
    try {

      for (const photoUri of photos) {
        try {
          const asset = await MediaLibrary.createAssetAsync(photoUri);
          const album = await MediaLibrary.getAlbumAsync("explorAble");
          if (album == null) {
            await MediaLibrary.createAlbumAsync("explorAble", asset, false);
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          }
        } catch (err) {
          console.log("Photo might already be saved:", err);
        }
      }
    } catch (error) {
      console.log("Gallery save error:", error);
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
      // UPLOAD PHOTOS BEFORE SAVING
      let uploadedPhotoUrls = [];
      if (activity.photos && activity.photos.length > 0) {
        console.log("Uploading activity photos...");
        // Import PhotoService at the top of your file
        const { PhotoService } = await import("../services/photoService");
        uploadedPhotoUrls = await PhotoService.uploadPhotos(
          activity.photos,
          "activity-photos", // Use a separate folder for activities
          user.id
        );
        console.log("Photos uploaded:", uploadedPhotoUrls);
      }

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
          photos: uploadedPhotoUrls, // USE UPLOADED URLs, NOT LOCAL PATHS
          is_manual_entry: activity.isManualEntry,
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state with uploaded URLs
      setActivities((prev) => [
        { ...activity, id: data.id, photos: uploadedPhotoUrls },
        ...prev,
      ]);

      // Save to gallery with original local paths
      if (activity.photos && activity.photos.length > 0) {
        await savePhotosToGallery(activity.photos);
      }
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
      if (updatedData.averageSpeed !== undefined)
        updateData.average_speed = updatedData.averageSpeed;
      if (updatedData.maxSpeed !== undefined)
        updateData.max_speed = updatedData.maxSpeed;
      if (updatedData.activityDate)
        updateData.activity_date = updatedData.activityDate.toISOString();

      // HANDLE PHOTO UPLOADS
      if (updatedData.photos !== undefined) {
        let uploadedPhotoUrls = [];
        if (updatedData.photos.length > 0) {
          console.log("Uploading updated activity photos...");
          const { PhotoService } = await import("../services/photoService");

          // Check if photos are already uploaded or need uploading
          const photosToUpload = updatedData.photos.filter(
            (photo) => photo.startsWith("file://") || photo.startsWith("/data")
          );
          const alreadyUploaded = updatedData.photos.filter((photo) =>
            photo.startsWith("http")
          );

          if (photosToUpload.length > 0) {
            const newlyUploaded = await PhotoService.uploadPhotos(
              photosToUpload,
              "activity-photos",
              user.id
            );
            uploadedPhotoUrls = [...alreadyUploaded, ...newlyUploaded];
          } else {
            uploadedPhotoUrls = alreadyUploaded;
          }
        }
        updateData.photos = uploadedPhotoUrls;
      }

      const { error } = await supabase
        .from("activities")
        .update(updateData)
        .eq("id", activityId)
        .eq("user_id", user.id);

      if (error) throw error;

      setActivities((prev) =>
        prev.map((activity) =>
          activity.id === activityId
            ? {
                ...activity,
                ...updatedData,
                photos: updateData.photos || activity.photos,
              }
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
      return newActivity; // Add this line

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
