import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

export type ActivityType = 'bike' | 'run' | 'walk' | 'hike' | 'paddleboard' | 'climb' | 'other';

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

  // Add this line after the Activity interface definition  
  
  // Saved activities
  activities: Activity[];
  
  // Actions
  startTracking: (activityType: ActivityType) => Promise<void>;
  pauseTracking: () => void;
  resumeTracking: () => void;
  stopTracking: (name: string, notes?: string) => Promise<void>;
  deleteActivity: (activityId: string) => Promise<void>;
  addManualActivity: (activity: Omit<Activity, 'id'>) => Promise<void>;
  
  // Utils
  loading: boolean;
  error: string | null;
}
export type { Activity };

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

// Utility function to calculate distance between two points (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const ActivityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<ActivityType>('bike');
  const [currentRoute, setCurrentRoute] = useState<LocationPoint[]>([]);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0); // Track total paused time
  const pauseStartRef = useRef<number | null>(null); // When pause started
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved activities on mount
  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const activitiesJson = await AsyncStorage.getItem('activities');
      if (activitiesJson) {
        setActivities(JSON.parse(activitiesJson));
      }
    } catch (err) {
      console.error('Error loading activities:', err);
      setError('Failed to load activities');
    }
  };

  const saveActivities = async (updatedActivities: Activity[]) => {
    try {
      await AsyncStorage.setItem('activities', JSON.stringify(updatedActivities));
    } catch (err) {
      console.error('Error saving activities:', err);
      setError('Failed to save activities');
    }
  };

  const startTracking = async (activityType: ActivityType) => {
    try {
      console.log('Starting tracking for:', activityType);
      setLoading(true);
      setError(null);

      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('Foreground permission:', status);
      if (status !== 'granted') {
        setError('Location permission is required for tracking');
        setLoading(false);
        return;
      }

      // Request background permission for continuous tracking (optional)
      try {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        console.log('Background permission:', bgStatus);
      } catch (e) {
        console.log('Background permission not available:', e);
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
          const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
          setCurrentDuration(elapsed);
        }
      }, 1000);

      console.log('Starting location watch...');
      // Start location tracking
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 5, // Update every 5 meters
        },
        (location) => {
          console.log('Location update received');
          if (!pauseStartRef.current) { // Only track location if not paused
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
      
      console.log('Tracking started successfully');
      setLoading(false);
    } catch (err) {
      console.error('Error starting tracking:', err);
      setError('Failed to start tracking');
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
        const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
        setCurrentDuration(elapsed);
      }
    }, 1000);
  };

  const stopTracking = async (name: string, notes?: string) => {
    try {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      // Calculate final duration accounting for paused time
      let finalDuration = currentDuration;
      
      // If we're currently paused, we already have the correct duration
      // If not paused, calculate one final time
      if (!pauseStartRef.current && startTimeRef.current) {
        finalDuration = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
      }
      
      console.log('Saving activity with duration:', finalDuration);
      console.log('Current duration was:', currentDuration);
      console.log('Start time:', startTimeRef.current);
      console.log('Paused time:', pausedTimeRef.current);

      // Calculate final stats
      const endTime = new Date();
      const startTime = new Date(startTimeRef.current || Date.now());
      const avgSpeed = currentDistance > 0 ? (currentDistance / 1000) / (finalDuration / 3600) : 0;
      
      // Find max speed from route
      let maxSpeed = 0;
      for (let i = 1; i < currentRoute.length; i++) {
        const timeDiff = (currentRoute[i].timestamp - currentRoute[i - 1].timestamp) / 1000; // seconds
        if (timeDiff > 0) {
          const dist = calculateDistance(
            currentRoute[i - 1].latitude,
            currentRoute[i - 1].longitude,
            currentRoute[i].latitude,
            currentRoute[i].longitude
          );
          const speed = (dist / 1000) / (timeDiff / 3600); // km/h
          maxSpeed = Math.max(maxSpeed, speed);
        }
      }

      const newActivity: Activity = {
        id: Date.now().toString(),
        type: currentActivity,
        name,
        startTime,
        endTime,
        duration: finalDuration, // Use the calculated final duration
        distance: currentDistance,
        route: currentRoute,
        averageSpeed: avgSpeed,
        maxSpeed,
        notes,
        isManualEntry: false,
      };

      const updatedActivities = [...activities, newActivity];
      setActivities(updatedActivities);
      await saveActivities(updatedActivities);

      // Reset tracking state
      setIsTracking(false);
      setIsPaused(false);
      setCurrentRoute([]);
      setCurrentDistance(0);
      setCurrentDuration(0);
      setCurrentSpeed(0);
      startTimeRef.current = null;
      pausedTimeRef.current = 0;
      pauseStartRef.current = null;
    } catch (err) {
      console.error('Error stopping tracking:', err);
      setError('Failed to stop tracking');
    }
  };

  const deleteActivity = async (activityId: string) => {
    try {
      const updatedActivities = activities.filter(a => a.id !== activityId);
      setActivities(updatedActivities);
      await saveActivities(updatedActivities);
    } catch (err) {
      console.error('Error deleting activity:', err);
      setError('Failed to delete activity');
    }
  };

  const addManualActivity = async (activity: Omit<Activity, 'id'>) => {
    try {
      const newActivity: Activity = {
        ...activity,
        id: Date.now().toString(),
        isManualEntry: true,
      };

      const updatedActivities = [...activities, newActivity];
      setActivities(updatedActivities);
      await saveActivities(updatedActivities);
    } catch (err) {
      console.error('Error adding manual activity:', err);
      setError('Failed to add activity');
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
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
};