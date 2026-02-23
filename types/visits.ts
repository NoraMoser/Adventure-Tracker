// Shared location/GPS types
export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  altitude?: number;
  accuracy?: number;
}

// Visit types
export interface Visit {
  id: string;
  date: Date;
  photos: string[];
  notes?: string;
}

export interface ActivityVisit extends Visit {
  route: LocationPoint[];
  distance: number;
  duration: number;
  averageSpeed: number;
  maxSpeed: number;
}