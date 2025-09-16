// hooks/useAutoAddToTrip.ts
import { Alert } from 'react-native';
import { useTrips } from '../contexts/TripContext';

interface LocationData {
  latitude: number;
  longitude: number;
}

export function useAutoAddToTrip() {
  const { trips, addToTrip } = useTrips();

  // Calculate distance between two coordinates in km
  const calculateDistance = (
    lat1: number, 
    lon1: number,
    lat2: number, 
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Check if a location is near any existing trip items
  const isLocationNearTrip = (
    location: LocationData,
    trip: any,
    maxDistanceKm: number = 50
  ): boolean => {
    // For a new trip without items, always return true if within date range
    if (trip.items.length === 0) {
      const now = new Date();
      return now >= trip.startDate && now <= trip.endDate;
    }

    // Check if near any existing trip items
    // For now, just check date range
    const now = new Date();
    return now >= trip.startDate && now <= trip.endDate;
  };

  const checkAndAddToTrip = async (
    item: any, // Changed from itemId to full item object
    itemType: 'activity' | 'spot',
    itemName: string,
    location: LocationData,
    promptUser: boolean = true
  ) => {
    // Find active trips that this item could belong to
    const now = new Date();
    const candidateTrips = trips.filter(trip => {
      // Check if trip is active (current date is within trip dates)
      if (now < trip.start_date || now > trip.end_date) {
        return false;
      }
      
      // Check if location is near trip
      return isLocationNearTrip(location, trip);
    });

    if (candidateTrips.length === 0) {
      return null;
    }

    // If multiple candidate trips, use the most recent one
    const targetTrip = candidateTrips.sort((a, b) => 
      b.start_date.getTime() - a.start_date.getTime()
    )[0];

    // Check if item is already in the trip
    const alreadyInTrip = targetTrip.items.some(
      (tripItem: any) => tripItem.data?.id === item.id && tripItem.type === itemType
    );

    if (alreadyInTrip) {
      return targetTrip;
    }

    // Prompt user if requested
    if (promptUser) {
      return new Promise((resolve) => {
        Alert.alert(
          'Add to Trip?',
          `Would you like to add "${itemName}" to your trip "${targetTrip.name}"?`,
          [
            {
              text: 'No',
              style: 'cancel',
              onPress: () => resolve(null)
            },
            {
              text: 'Yes',
              onPress: () => {
                addToTrip(targetTrip.id, item, itemType); // Pass full item object
                resolve(targetTrip);
              }
            }
          ]
        );
      });
    } else {
      // Auto-add without prompting
      addToTrip(targetTrip.id, item, itemType); // Pass full item object
      return targetTrip;
    }
  };

  return {
    checkAndAddToTrip,
    calculateDistance,
  };
};