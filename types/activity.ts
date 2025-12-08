// types/activity.ts

export interface ActivityUser {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
}

export interface Comment {
  id: string;
  text: string;
  created_at: string;
  reply_to_id?: string;
  user: ActivityUser;
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