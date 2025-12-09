// types/activity.ts

// Re-export Comment from shared types for backwards compatibility
export { Comment } from "./comment";

export interface ActivityUser {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
}

export interface Activity {
  id: string;
  name: string;
  type: string;
  start_time: string;
  end_time: string;
  duration: number;
  distance: number;
  average_speed?: number;
  max_speed?: number;
  elevation_gain?: number;
  notes?: string;
  route?: RoutePoint[];
  user_id: string;
  user?: ActivityUser;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp?: string;
}