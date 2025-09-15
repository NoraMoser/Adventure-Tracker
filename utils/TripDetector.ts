// utils/TripDetector.ts
import { Activity } from '../contexts/ActivityContext';
import { SavedSpot } from '../contexts/LocationContext';
import { Trip, TripItem } from '../contexts/TripContext';

interface DetectionCandidate {
  items: (Activity | SavedSpot)[];
  startDate: Date;
  endDate: Date;
  centerLat: number;
  centerLng: number;
}

export class TripDetector {
  // Configuration
  private static readonly MIN_ITEMS_FOR_TRIP = 2;
  private static readonly MAX_DAYS_BETWEEN_ITEMS = 7;
  private static readonly MAX_DISTANCE_KM = 100; // Max distance between items to be considered same trip
  
  /**
   * Detect trips from activities and spots
   */
  static detectTrips(
    activities: Activity[], 
    spots: SavedSpot[],
    existingTrips: Trip[]
  ): Trip[] {
    // Combine and sort all items by date
    const allItems: { item: Activity | SavedSpot; type: 'activity' | 'spot'; date: Date }[] = [
      ...activities.map(a => ({ 
        item: a, 
        type: 'activity' as const, 
        date: new Date(a.activityDate) 
      })),
      ...spots.map(s => ({ 
        item: s, 
        type: 'spot' as const, 
        date: new Date(s.locationDate) 
      }))
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Filter out items already in trips
    const itemsInTrips = new Set<string>();
    existingTrips.forEach(trip => {
      trip.items.forEach(item => {
        const id = item.type === 'activity' 
          ? (item.data as Activity).id 
          : (item.data as SavedSpot).id;
        itemsInTrips.add(`${item.type}-${id}`);
      });
    });

    const unassignedItems = allItems.filter(({ item, type }) => {
      const id = type === 'activity' ? (item as Activity).id : (item as SavedSpot).id;
      return !itemsInTrips.has(`${type}-${id}`);
    });

    if (unassignedItems.length < this.MIN_ITEMS_FOR_TRIP) {
      return [];
    }

    // Group items into potential trips
    const candidates: DetectionCandidate[] = [];
    let currentCandidate: DetectionCandidate | null = null;

    for (const { item, type, date } of unassignedItems) {
      const location = this.getItemLocation(item, type);
      
      if (!location) continue;

      if (!currentCandidate) {
        // Start new candidate
        currentCandidate = {
          items: [item],
          startDate: date,
          endDate: date,
          centerLat: location.lat,
          centerLng: location.lng
        };
      } else {
        // Check if this item belongs to current candidate
        const daysSinceLastItem = this.daysBetween(currentCandidate.endDate, date);
        const distance = this.calculateDistance(
          currentCandidate.centerLat,
          currentCandidate.centerLng,
          location.lat,
          location.lng
        );

        if (daysSinceLastItem <= this.MAX_DAYS_BETWEEN_ITEMS && 
            distance <= this.MAX_DISTANCE_KM) {
          // Add to current candidate
          currentCandidate.items.push(item);
          currentCandidate.endDate = date;
          // Update center point (simple average)
          const itemCount = currentCandidate.items.length;
          currentCandidate.centerLat = 
            (currentCandidate.centerLat * (itemCount - 1) + location.lat) / itemCount;
          currentCandidate.centerLng = 
            (currentCandidate.centerLng * (itemCount - 1) + location.lng) / itemCount;
        } else {
          // Save current candidate if it has enough items
          if (currentCandidate.items.length >= this.MIN_ITEMS_FOR_TRIP) {
            candidates.push(currentCandidate);
          }
          // Start new candidate
          currentCandidate = {
            items: [item],
            startDate: date,
            endDate: date,
            centerLat: location.lat,
            centerLng: location.lng
          };
        }
      }
    }

    // Don't forget the last candidate
    if (currentCandidate && currentCandidate.items.length >= this.MIN_ITEMS_FOR_TRIP) {
      candidates.push(currentCandidate);
    }

    // Convert candidates to trips
    return candidates.map((candidate, index) => this.createTripFromCandidate(candidate, index));
  }

  private static getItemLocation(
    item: Activity | SavedSpot, 
    type: 'activity' | 'spot'
  ): { lat: number; lng: number } | null {
    if (type === 'spot') {
      const spot = item as SavedSpot;
      return { lat: spot.location.latitude, lng: spot.location.longitude };
    } else {
      const activity = item as Activity;
      if (activity.route && activity.route.length > 0) {
        // Use the midpoint of the route
        const midIndex = Math.floor(activity.route.length / 2);
        return {
          lat: activity.route[midIndex].latitude,
          lng: activity.route[midIndex].longitude
        };
      }
    }
    return null;
  }

  // In TripDetector.ts, update the createTripFromCandidate method:

private static createTripFromCandidate(
  candidate: DetectionCandidate, 
  index: number
): Trip {
  const now = new Date();
  const tripItems: TripItem[] = candidate.items.map((item, i) => ({
    id: `auto-${Date.now()}-${i}`,
    trip_id: '', // This will be set when added to the trip
    type: this.isActivity(item) ? 'activity' : 'spot',
    data: item,
    added_at: now,
    added_by: undefined
  }));

  // Generate trip name based on location or date
  const tripName = this.generateTripName(candidate);

  // Find cover photo
  const coverPhoto = this.findCoverPhoto(candidate.items);

  return {
    id: `auto-trip-${Date.now()}-${index}`,
    name: tripName,
    start_date: candidate.startDate,  // Changed from startDate
    end_date: candidate.endDate,      // Changed from endDate
    items: tripItems,
    cover_photo: coverPhoto,          // Changed from coverPhoto
    auto_generated: true,              // Changed from autoGenerated
    created_at: now,                  // Changed from createdAt
    created_by: '',                   // Will be set by TripContext
    tagged_friends: [],
    merged_from: []
  };
}
  private static generateTripName(candidate: DetectionCandidate): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const startMonth = monthNames[candidate.startDate.getMonth()];
    const endMonth = monthNames[candidate.endDate.getMonth()];
    const year = candidate.endDate.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${year} Adventure`;
    } else {
      return `${startMonth}-${endMonth} ${year} Trip`;
    }
  }

  private static findCoverPhoto(items: (Activity | SavedSpot)[]): string | undefined {
    for (const item of items) {
      if (this.isSpot(item)) {
        const spot = item as SavedSpot;
        if (spot.photos && spot.photos.length > 0) {
          return spot.photos[0];
        }
      }
    }
    return undefined;
  }

  private static isActivity(item: Activity | SavedSpot): item is Activity {
    return 'activityType' in item || 'type' in item;
  }

  private static isSpot(item: Activity | SavedSpot): item is SavedSpot {
    return 'location' in item && typeof (item as any).location === 'object';
  }

  private static daysBetween(date1: Date, date2: Date): number {
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date2.getTime() - date1.getTime()) / oneDayMs));
  }

  private static calculateDistance(
    lat1: number, 
    lng1: number, 
    lat2: number, 
    lng2: number
  ): number {
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}