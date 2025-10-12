// hooks/useAutoAddToTrip.ts - Improved version with rejection tracking
import { Alert } from "react-native";
import { useTrips } from "../contexts/TripContext";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface LocationData {
  latitude: number;
  longitude: number;
}

export function useAutoAddToTrip() {
  const { trips, addToTrip, checkForAutoTrip } = useTrips();
  const { user } = useAuth();

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
    // Check if user has previously rejected this item for trips
    if (user && promptUser) {
      try {
        const { data: rejections } = await supabase
          .from('trip_item_rejections')
          .select('id')
          .eq('user_id', user.id)
          .eq('item_id', item.id)
          .eq('item_type', itemType);
        
        if (rejections && rejections.length > 0) {
          console.log('Item was previously rejected for trips');
          return null;
        }
      } catch (error) {
        console.error('Error checking rejections:', error);
      }
    }

    // Check if location is near home
    let isNearHome = false;
    let homeLocation = null;
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('home_location, home_radius')
        .eq('id', user.id)
        .single();
      
      if (profile?.home_location) {
        homeLocation = profile.home_location;
        const homeRadius = profile.home_radius || 2; // Default 2km
        const distanceFromHome = calculateDistance(
          location.latitude,
          location.longitude,
          profile.home_location.latitude,
          profile.home_location.longitude
        );
        
        isNearHome = distanceFromHome <= homeRadius;
        
        if (isNearHome) {
          console.log("Item is within home area, applying stricter matching rules");
        }
      }
    }
    
    // Get item date
    const itemDate =
      item.activityDate || item.locationDate || item.timestamp || new Date();
    const itemDateObj = new Date(itemDate);
    const now = new Date();

    // Find matching trips (filter based on dates and location)
    const candidateTrips = trips.filter((trip) => {
      const tripStart = new Date(trip.start_date);
      const tripEnd = new Date(trip.end_date);
      
      // Calculate days since trip ended
      const daysSinceTripEnd = Math.floor((now.getTime() - tripEnd.getTime()) / (1000 * 60 * 60 * 24));
      
      // For home locations, only consider very recent trips (within 14 days)
      // For travel locations, consider trips up to 30 days old
      const maxTripAge = isNearHome ? 14 : 30;
      
      if (daysSinceTripEnd > maxTripAge) {
        return false;
      }

      // Check date proximity
      let isDateMatch = false;
      
      if (isNearHome) {
        // For home locations: item must be during trip OR within 1 day
        const oneDayBefore = new Date(tripStart);
        oneDayBefore.setDate(oneDayBefore.getDate() - 1);
        const oneDayAfter = new Date(tripEnd);
        oneDayAfter.setDate(oneDayAfter.getDate() + 1);
        
        isDateMatch = itemDateObj >= oneDayBefore && itemDateObj <= oneDayAfter;
        
        // Extra check: if trip is currently active, always match home items
        const tripIsActive = now >= tripStart && now <= tripEnd;
        if (tripIsActive) {
          isDateMatch = true;
        }
      } else {
        // For travel locations: more lenient, 7 days before/after
        const expandedStart = new Date(tripStart);
        expandedStart.setDate(expandedStart.getDate() - 7);
        const expandedEnd = new Date(tripEnd);
        expandedEnd.setDate(expandedEnd.getDate() + 7);
        
        isDateMatch = itemDateObj >= expandedStart && itemDateObj <= expandedEnd;
      }

      if (!isDateMatch) return false;

      // Check location proximity if trip has items
      if (trip.items && trip.items.length > 0) {
        const hasNearbyItem = trip.items.some((tripItem) => {
          const tripItemLocation =
            tripItem.data.location ||
            (tripItem.data.route && tripItem.data.route[0]);

          if (!tripItemLocation) return true;

          const distance = calculateDistance(
            location.latitude,
            location.longitude,
            tripItemLocation.latitude,
            tripItemLocation.longitude
          );

          // Different proximity requirements based on context
          let maxDistance = 100; // Default 100km for travel
          
          if (isNearHome && homeLocation) {
            // For home locations, if trip has mostly nearby items, be strict
            // But if trip has distant items, it's probably a travel trip
            const avgDistance = trip.items.reduce((sum, ti) => {
              const loc = ti.data.location || (ti.data.route && ti.data.route[0]);
              if (!loc || !homeLocation) return sum;
              return sum + calculateDistance(
                loc.latitude,
                loc.longitude,
                homeLocation.latitude,
                homeLocation.longitude
              );
            }, 0) / trip.items.length;
            
            // If average distance of trip items is > 50km from home, it's a travel trip
            maxDistance = avgDistance > 50 ? 200 : 20;
          }

          return distance <= maxDistance;
        });

        return hasNearbyItem;
      }

      // For empty trips, be more permissive
      return true;
    })
    // Sort by: 1) Currently active trips first, 2) Most recent trips
    .sort((a, b) => {
      const aStart = new Date(a.start_date).getTime();
      const aEnd = new Date(a.end_date).getTime();
      const bStart = new Date(b.start_date).getTime();
      const bEnd = new Date(b.end_date).getTime();
      const nowTime = now.getTime();
      
      // Check if trips are currently active
      const aIsActive = nowTime >= aStart && nowTime <= aEnd;
      const bIsActive = nowTime >= bStart && nowTime <= bEnd;
      
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      
      // Otherwise sort by end date (most recent first)
      return bEnd - aEnd;
    });

    if (candidateTrips.length === 0) {
      console.log("No matching trips found for item");
      return null;
    }

    // If multiple candidate trips, let user choose
    if (candidateTrips.length > 1 && promptUser) {
      return new Promise((resolve) => {
        const buttons = [];
        
        // Add trip options first (limit to 2 for UI clarity)
        candidateTrips.slice(0, 2).forEach(trip => {
          buttons.push({
            text: trip.name,
            onPress: async () => {
              await addToTrip(trip.id, item, itemType);
              resolve(trip);
            }
          });
        });
        
        // Add "Don't ask again" option
        buttons.push({
          text: "Don't add to trips",
          style: "cancel" as const,
          onPress: async () => {
            // Store rejection for all candidate trips
            if (user) {
              try {
                const rejections = candidateTrips.map(trip => ({
                  user_id: user.id,
                  item_id: item.id,
                  item_type: itemType,
                  trip_id: trip.id
                }));
                
                await supabase
                  .from('trip_item_rejections')
                  .insert(rejections);
              } catch (error) {
                console.error('Error storing rejection:', error);
              }
            }
            resolve(null);
          }
        });

        Alert.alert(
          "Add to Trip?",
          candidateTrips.length > 2 
            ? `Found ${candidateTrips.length} matching trips. Choose one:`
            : "Multiple trips match this location:",
          buttons
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

    // Add to trip with user prompt
    if (promptUser) {
      return new Promise((resolve) => {
        Alert.alert(
          "Add to Trip?",
          `Would you like to add "${itemName}" to your trip "${targetTrip.name}"?`,
          [
            {
              text: "Don't add to trips",
              style: "default",
              onPress: async () => {
                // Store rejection in Supabase
                if (user) {
                  try {
                    await supabase
                      .from('trip_item_rejections')
                      .insert({
                        user_id: user.id,
                        item_id: item.id,
                        item_type: itemType,
                        trip_id: targetTrip.id
                      });
                  } catch (error) {
                    console.error('Error storing rejection:', error);
                  }
                }
                resolve(null);
              },
            },
            {
              text: "Add to trip",
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

  // New function to clear rejections for an item (useful if user changes their mind)
  const clearRejections = async (itemId: string, itemType: string) => {
    if (!user) return;
    
    try {
      await supabase
        .from('trip_item_rejections')
        .delete()
        .eq('user_id', user.id)
        .eq('item_id', itemId)
        .eq('item_type', itemType);
    } catch (error) {
      console.error('Error clearing rejections:', error);
    }
  };

  // New function to manually add item to trip (bypasses rejection check)
  const forceAddToTrip = async (
    tripId: string,
    item: any,
    itemType: "activity" | "spot"
  ) => {
    // Clear any rejections for this item
    await clearRejections(item.id, itemType);
    
    // Add to trip
    await addToTrip(tripId, item, itemType);
  };

  return {
    checkAndAddToTrip,
    calculateDistance,
    clearRejections,
    forceAddToTrip
  };
}