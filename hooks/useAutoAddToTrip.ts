// hooks/useAutoAddToTrip.ts - Updated version
import { Alert } from "react-native";
import { useTrips } from "../contexts/TripContext";

interface LocationData {
  latitude: number;
  longitude: number;
}

export function useAutoAddToTrip() {
  const { trips, addToTrip, checkForAutoTrip } = useTrips();

  // Calculate distance between two coordinates in km
  const calculateDistance = (
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

  const checkAndAddToTrip = async (
    item: any,
    itemType: "activity" | "spot",
    itemName: string,
    location: LocationData,
    promptUser: boolean = true
  ) => {
    // Get item date
    const itemDate =
      item.activityDate || item.locationDate || item.timestamp || new Date();

    // Find matching trips (within 30 days and nearby)
    const candidateTrips = trips.filter((trip) => {
      // Check date proximity (within 30 days)
      const tripStart = new Date(trip.start_date);
      const tripEnd = new Date(trip.end_date);
      const itemDateObj = new Date(itemDate);

      const expandedStart = new Date(tripStart);
      expandedStart.setDate(expandedStart.getDate() - 30);
      const expandedEnd = new Date(tripEnd);
      expandedEnd.setDate(expandedEnd.getDate() + 30);

      const isDateNearby =
        itemDateObj >= expandedStart && itemDateObj <= expandedEnd;

      if (!isDateNearby) return false;

      // Check location proximity if trip has items
      if (trip.items && trip.items.length > 0) {
        const hasNearbyItem = trip.items.some((tripItem) => {
          const tripItemLocation =
            tripItem.data.location ||
            (tripItem.data.route && tripItem.data.route[0]);

          if (!tripItemLocation) return true; // If no location, consider it a match

          const distance = calculateDistance(
            location.latitude,
            location.longitude,
            tripItemLocation.latitude,
            tripItemLocation.longitude
          );

          return distance <= 100; // Within 100km
        });

        return hasNearbyItem;
      }

      return true; // Empty trip, just use date
    });

    if (candidateTrips.length === 0) {
      // No existing trips match - offer to create auto-trip
      if (promptUser) {
        return new Promise((resolve) => {
          Alert.alert(
            "No Matching Trips",
            "Would you like to create a new trip for this item?",
            [
              {
                text: "No",
                style: "cancel",
                onPress: () => resolve(null),
              },
              {
                text: "Create Trip",
                onPress: async () => {
                  const autoTrip = await checkForAutoTrip(item);
                  if (autoTrip) {
                    await addToTrip(autoTrip.id, item, itemType);
                    resolve(autoTrip);
                  } else {
                    resolve(null);
                  }
                },
              },
            ]
          );
        });
      }
      return null;
    }

    // If multiple candidate trips, let user choose
    if (candidateTrips.length > 1 && promptUser) {
      return new Promise((resolve) => {
        Alert.alert(
          "Select Trip",
          "Multiple trips match this location. Choose one:",
          [
            // Only show first 2 trips to leave room for Skip button
            ...candidateTrips.slice(0, 2).map((trip) => ({
              text: trip.name,
              onPress: async () => {
                await addToTrip(trip.id, item, itemType);
                resolve(trip);
              },
            })),
            {
              text: "Skip for now",
              style: "default",
              onPress: () => resolve(null),
            },
          ]
        );
      });
    }

    // Single matching trip
    const targetTrip = candidateTrips[0];

    // Check if already in trip
    const alreadyInTrip = targetTrip.items?.some(
      (tripItem: any) =>
        tripItem.data?.id === item.id && tripItem.type === itemType
    );

    if (alreadyInTrip) {
      return targetTrip;
    }

    // Add to trip
    if (promptUser) {
      return new Promise((resolve) => {
        Alert.alert(
          "Add to Trip?",
          `Would you like to add "${itemName}" to your trip "${targetTrip.name}"?`,
          [
            {
              text: "No",
              style: "cancel",
              onPress: () => resolve(null),
            },
            {
              text: "Yes",
              onPress: async () => {
                await addToTrip(targetTrip.id, item, itemType);
                resolve(targetTrip);
              },
            },
          ]
        );
      });
    } else {
      await addToTrip(targetTrip.id, item, itemType);
      return targetTrip;
    }
  };

  return {
    checkAndAddToTrip,
    calculateDistance,
  };
}
