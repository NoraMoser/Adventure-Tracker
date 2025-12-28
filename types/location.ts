
export interface LocationUser {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
}

export interface Location {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  category: string;
  rating?: number;
  photos?: string[];
  created_at: string;
  user_id: string;
  user?: LocationUser;
}