import * as Location from 'expo-location';

export interface SavedSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  date: string;
  photos: string[]; // Array of photo URIs
}

export type LocationObject = Location.LocationObject;