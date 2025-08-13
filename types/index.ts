import * as Location from 'expo-location';

export interface SavedSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  date: string;
}

export type LocationObject = Location.LocationObject;