// utils/gps.ts - GPS utility functions

export interface MovementThresholds {
  minDistance: number; // Minimum movement to register
  maxJump: number; // Max instant jump (filter GPS glitches)
  maxSpeed: number; // Max reasonable speed in km/h
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if two locations are within a threshold distance
 * @param loc1 First location with latitude/longitude
 * @param loc2 Second location with latitude/longitude
 * @param thresholdKm Distance threshold in kilometers (default 50km)
 * @returns true if locations are within threshold
 */
export const areLocationsNearby = (
  loc1: { latitude: number; longitude: number } | null,
  loc2: { latitude: number; longitude: number } | null,
  thresholdKm: number = 50
): boolean => {
  if (!loc1 || !loc2) return false;
  const distance = calculateDistance(
    loc1.latitude,
    loc1.longitude,
    loc2.latitude,
    loc2.longitude
  );
  return distance <= thresholdKm;
};

/**
 * Get accuracy threshold based on activity type
 * Higher values = more lenient (accepts less accurate readings)
 */
export const getAccuracyThreshold = (activityType: string): number => {
  switch (activityType) {
    case "walk":
    case "hike":
    case "climb":
      return 30; // Need good accuracy for slow activities
    case "run":
      return 50;
    case "bike":
    case "paddleboard":
      return 75;
    default:
      return 100; // More lenient for vehicles/other
  }
};

/**
 * Get movement thresholds based on activity type
 * Used to filter GPS noise and detect valid movement
 */
export const getMovementThresholds = (activityType: string): MovementThresholds => {
  switch (activityType) {
    case "walk":
      return { minDistance: 0.5, maxJump: 50, maxSpeed: 10 };
    case "hike":
    case "climb":
      return { minDistance: 0.5, maxJump: 30, maxSpeed: 15 };
    case "run":
      return { minDistance: 1, maxJump: 100, maxSpeed: 30 };
    case "bike":
      return { minDistance: 2, maxJump: 200, maxSpeed: 80 };
    case "paddleboard":
      return { minDistance: 1, maxJump: 50, maxSpeed: 25 };
    default:
      return { minDistance: 5, maxJump: 500, maxSpeed: 200 }; // Vehicles
  }
};