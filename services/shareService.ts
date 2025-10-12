// services/shareService.ts - Fixed with unit preferences
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import { Alert, Platform, Share } from "react-native";
import { categories, CategoryType } from "../constants/categories";
import { Activity } from "../contexts/ActivityContext";
import { SavedSpot } from "../contexts/LocationContext";
import { Trip, TripItem } from "../contexts/TripContext";

export interface ShareOptions {
  includeRoute?: boolean;
  includeExactLocation?: boolean;
  shareToFriends?: boolean;
  friendIds?: string[];
  message?: string;
  units?: "metric" | "imperial";
  includeLink?: boolean; // Add this line
}

export class ShareService {
  /**
   * Convert kilometers to miles
   */
  static kmToMiles(km: number): number {
    return km * 0.621371;
  }

  /**
   * Format distance based on units
   */
  static formatDistance(
    meters: number,
    units: "metric" | "imperial" = "metric"
  ): string {
    if (units === "imperial") {
      const miles = (meters / 1000) * 0.621371;
      return `${miles.toFixed(2)} mi`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  }

  /**
   * Format speed based on units
   */
  static formatSpeed(
    kmh: number,
    units: "metric" | "imperial" = "metric"
  ): string {
    if (units === "imperial") {
      const mph = kmh * 0.621371;
      return `${mph.toFixed(1)} mph`;
    }
    return `${kmh.toFixed(1)} km/h`;
  }

  /**
   * Format elevation based on units
   */
  static formatElevation(
    meters: number,
    units: "metric" | "imperial" = "metric"
  ): string {
    if (units === "imperial") {
      const feet = meters * 3.28084;
      return `${Math.round(feet)} ft`;
    }
    return `${Math.round(meters)} m`;
  }

  /**
   * Create a shareable message for a location
   */
  static createLocationMessage(spot: SavedSpot): string {
    const category = categories[spot.category];
    const categoryEmoji = this.getCategoryEmoji(spot.category);

    let message = `${categoryEmoji} ${spot.name}\n`;

    if (spot.description) {
      message += `\n${spot.description}\n`;
    }

    message += `\n📍 Location: ${spot.location.latitude.toFixed(
      6
    )}, ${spot.location.longitude.toFixed(6)}`;

    // Add Google Maps link
    const mapsUrl = this.getGoogleMapsUrl(
      spot.location.latitude,
      spot.location.longitude,
      spot.name
    );
    message += `\n🗺️ View on Maps: ${mapsUrl}`;

    if (spot.photos && spot.photos.length > 0) {
      message += `\n📸 ${spot.photos.length} photo${
        spot.photos.length > 1 ? "s" : ""
      } attached`;
    }

    message += `\n\nShared from ExplorAble 🌲`;

    return message;
  }

  /**
   * Get emoji for category
   */
  static getCategoryEmoji(category: CategoryType): string {
    const emojiMap: Record<CategoryType, string> = {
      beach: "🏖️",
      trail: "🥾",
      restaurant: "🍽️",
      viewpoint: "🌄",
      camping: "🏕️",
      water: "💧",
      climbing: "🧗",
      historic: "🏛️",
      shopping: "🛍️",
      other: "📍",
    };
    return emojiMap[category] || "📍";
  }

  /**
   * Get emoji for activity type
   */
  static getActivityEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      bike: "🚴",
      run: "🏃",
      walk: "🚶",
      hike: "🥾",
      paddleboard: "🏄",
      climb: "🧗",
      other: "🏃",
    };
    return emojiMap[type] || "🏃";
  }

  /**
   * Format duration from seconds
   */
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} minutes`;
  }

  /**
   * Create a shareable message for an activity with privacy options and unit preferences
   */
  static createActivityMessage(
    activity: Activity,
    options: ShareOptions = {}
  ): string {
    const units = options.units || "metric"; // Default to metric if not specified
    const activityEmoji = this.getActivityEmoji(activity.type);
    const distance = this.formatDistance(activity.distance, units);
    const duration = this.formatDuration(activity.duration);
    const avgSpeed = this.formatSpeed(activity.averageSpeed, units);

    let message = `${activityEmoji} ${activity.name}\n`;
    message += `\n📊 Activity Stats:`;
    message += `\n• Distance: ${distance}`;
    message += `\n• Duration: ${duration}`;
    message += `\n• Avg Speed: ${avgSpeed}`;

    if (activity.maxSpeed && activity.maxSpeed > 0) {
      message += `\n• Max Speed: ${this.formatSpeed(activity.maxSpeed, units)}`;
    }

    if (activity.notes) {
      message += `\n\n💭 ${activity.notes}`;
    }

    // Add route information based on privacy settings
    if (options.includeRoute && activity.route && activity.route.length > 0) {
      const startPoint = activity.route[0];
      const endPoint = activity.route[activity.route.length - 1];

      if (options.includeExactLocation) {
        message += `\n\n📍 Route:`;
        message += `\n• Start: ${startPoint.latitude.toFixed(
          4
        )}, ${startPoint.longitude.toFixed(4)}`;
        message += `\n• End: ${endPoint.latitude.toFixed(
          4
        )}, ${endPoint.longitude.toFixed(4)}`;

        // Add Google Maps link for route
        const routeUrl = this.createRouteUrl(activity.route);
        if (routeUrl) {
          message += `\n🗺️ View Route: ${routeUrl}`;
        }
      } else {
        // Just show general area
        message += `\n\n📍 General Area: ${this.getGeneralArea(
          startPoint.latitude,
          startPoint.longitude
        )}`;
      }
    } else if (!options.includeRoute) {
      message += `\n\n🔒 Route details hidden for privacy`;
    }

    const date = new Date(activity.startTime).toLocaleDateString();
    message += `\n\n📅 ${date}`;
    message += `\n\nShared from ExplorAble 🌲`;

    return message;
  }

  /**
   * Get Google Maps URL
   */
  static getGoogleMapsUrl(
    latitude: number,
    longitude: number,
    name?: string
  ): string {
    const label = name ? encodeURIComponent(name) : "";
    return `https://maps.google.com/?q=${latitude},${longitude}${
      label ? `&label=${label}` : ""
    }`;
  }

  /**
   * Get Apple Maps URL
   */
  static getAppleMapsUrl(
    latitude: number,
    longitude: number,
    name?: string
  ): string {
    const label = name ? encodeURIComponent(name) : "";
    return `https://maps.apple.com/?ll=${latitude},${longitude}&q=${label}`;
  }

  /**
   * Share location via native share sheet
   */
  static async shareLocation(spot: SavedSpot) {
    try {
      const message = this.createLocationMessage(spot);

      // Basic share options
      const shareOptions: any = {
        message,
        title: `Check out ${spot.name}!`,
      };

      // On iOS, we can also share URLs separately
      if (Platform.OS === "ios") {
        const mapsUrl = this.getAppleMapsUrl(
          spot.location.latitude,
          spot.location.longitude,
          spot.name
        );
        shareOptions.url = mapsUrl;
      }

      const result = await Share.share(shareOptions);

      return result;
    } catch (error) {
      console.error("Error sharing location:", error);
      throw error;
    }
  }

  /**
   * Share location with photos using expo-sharing
   */
  static async shareLocationWithPhotos(spot: SavedSpot) {
    try {
      if (!spot.photos || spot.photos.length === 0) {
        // No photos, just share text
        return this.shareLocation(spot);
      }

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        // Fallback to text-only share
        return this.shareLocation(spot);
      }

      // For multiple photos, we'll create a collage or share them sequentially
      // For now, let's share the first photo with the option to share more
      const photosToShare = spot.photos.slice(0, 3); // Limit to first 3 photos

      // Process and share photos
      for (let i = 0; i < photosToShare.length; i++) {
        const photo = photosToShare[i];
        let photoUri = photo;

        // If it's a base64 image, save it temporarily
        if (photo.startsWith("data:image")) {
          // For now, just skip the file saving and share the base64 directly
          // Most sharing APIs can handle data URLs
          photoUri = photo;
        }
        // For the first photo, include the full message
        if (i === 0) {
          const message = this.createLocationMessage(spot);

          // Copy message to clipboard so user can paste it
          await Clipboard.setStringAsync(message);

          // Share the photo
          await Sharing.shareAsync(photoUri, {
            dialogTitle: `Share ${spot.name}`,
            mimeType: "image/jpeg",
            UTI: "public.jpeg", // iOS specific
          });

          // Note: The message has been copied to clipboard
          console.log("Message copied to clipboard for pasting");
        } else {
          // For additional photos, just share them
          await Sharing.shareAsync(photoUri, {
            dialogTitle: `${spot.name} - Photo ${i + 1}`,
            mimeType: "image/jpeg",
            UTI: "public.jpeg",
          });
        }
      }

      return { action: "shared" };
    } catch (error) {
      console.error("Error sharing with photos:", error);
      // Fallback to text-only share
      return this.shareLocation(spot);
    }
  }

  /**
   * Share activity with privacy options and user prompts
   * Now accepts units in the options
   */
  static async shareActivity(
    activity: Activity,
    customOptions?: ShareOptions
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // If custom options provided, use them directly
      if (customOptions) {
        this.performActivityShare(activity, customOptions)
          .then(resolve)
          .catch(reject);
        return;
      }

      // Show privacy options dialog
      const hasRoute = activity.route && activity.route.length > 0;

      if (!hasRoute) {
        // No route data, just share basic stats
        const options: ShareOptions = { includeRoute: false };
        this.performActivityShare(activity, options)
          .then(resolve)
          .catch(reject);
        return;
      }

      // Activity has route data, ask user about privacy preferences
      Alert.alert(
        "Share Activity",
        "How much detail would you like to share?",
        [
          {
            text: "Stats Only",
            onPress: () => {
              const options: ShareOptions = { includeRoute: false };
              this.performActivityShare(activity, options)
                .then(resolve)
                .catch(reject);
            },
          },
          {
            text: "General Area",
            onPress: () => {
              const options: ShareOptions = {
                includeRoute: true,
                includeExactLocation: false,
              };
              this.performActivityShare(activity, options)
                .then(resolve)
                .catch(reject);
            },
          },
          {
            text: "Full Route",
            onPress: () => {
              const options: ShareOptions = {
                includeRoute: true,
                includeExactLocation: true,
              };
              this.performActivityShare(activity, options)
                .then(resolve)
                .catch(reject);
            },
          },
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve({ action: "cancelled" }),
          },
        ]
      );
    });
  }

  /**
   * Perform the actual activity share
   */
  private static async performActivityShare(
    activity: Activity,
    options: ShareOptions
  ) {
    try {
      const message = this.createActivityMessage(activity, options);

      const shareOptions: any = {
        message,
        title: `Check out my ${activity.type} activity!`,
      };

      // If including full route, add map URL for iOS
      if (
        Platform.OS === "ios" &&
        options.includeRoute &&
        options.includeExactLocation &&
        activity.route
      ) {
        const routeUrl = this.createRouteUrl(activity.route);
        if (routeUrl) {
          shareOptions.url = routeUrl;
        }
      }

      const result = await Share.share(shareOptions);
      return result;
    } catch (error) {
      console.error("Error sharing activity:", error);
      throw error;
    }
  }

  /**
   * Share activity with route map (creates a static map URL)
   */
  static async shareActivityWithMap(
    activity: Activity,
    options: ShareOptions = {}
  ) {
    try {
      const includeRoute = options.includeRoute !== false; // default to true
      const message = this.createActivityMessage(activity, options);

      // If there's a route and we're including it, add a static map preview
      if (
        includeRoute &&
        activity.route &&
        activity.route.length > 0 &&
        options.includeExactLocation
      ) {
        // Create a simplified path for URL (limit points to avoid URL length issues)
        const simplifiedRoute = this.simplifyRoute(activity.route, 20);
        const pathString = simplifiedRoute
          .map(
            (point) =>
              `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`
          )
          .join("|");

        // Google Static Maps API URL (Note: requires API key in production)
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=600x400&path=color:0x0000ff|weight:3|${pathString}`;

        const shareOptions: any = {
          message: message + `\n\n🗺️ View route: ${mapUrl}`,
          title: `My ${activity.type} activity`,
        };

        if (Platform.OS === "ios") {
          shareOptions.url = mapUrl;
        }

        return await Share.share(shareOptions);
      }

      return this.performActivityShare(activity, options);
    } catch (error) {
      console.error("Error sharing activity with map:", error);
      return this.performActivityShare(activity, options);
    }
  }

  /**
   * Create route URL for Google Maps
   */
  private static createRouteUrl(route: any[]): string | null {
    if (!route || route.length < 2) return null;

    const start = route[0];
    const end = route[route.length - 1];

    // Create Google Maps directions URL
    return `https://www.google.com/maps/dir/${start.latitude},${start.longitude}/${end.latitude},${end.longitude}`;
  }

  /**
   * Get general area description instead of exact coordinates
   */
  private static getGeneralArea(latitude: number, longitude: number): string {
    // Round to fewer decimal places for privacy
    const roundedLat = Math.round(latitude * 100) / 100;
    const roundedLon = Math.round(longitude * 100) / 100;
    return `${roundedLat}, ${roundedLon} area`;
  }

  /**
   * Simplify route to reduce number of points
   */
  private static simplifyRoute(route: any[], maxPoints: number): any[] {
    if (route.length <= maxPoints) return route;

    const simplified = [];
    const step = Math.floor(route.length / maxPoints);

    for (let i = 0; i < route.length; i += step) {
      simplified.push(route[i]);
    }

    // Always include the last point
    if (simplified[simplified.length - 1] !== route[route.length - 1]) {
      simplified.push(route[route.length - 1]);
    }

    return simplified;
  }

  /**
   * Share activity to friends feed (internal app sharing)
   */
  static async shareActivityToFriends(
    activity: Activity,
    friendIds: string[],
    options: ShareOptions = {}
  ): Promise<{ success: boolean; sharedActivity?: any }> {
    try {
      // Create a shared activity object for the friends feed
      const sharedActivity = {
        id: `shared_${activity.id}_${Date.now()}`,
        type: "activity" as const,
        timestamp: new Date(),
        data: {
          ...activity,
          sharedBy: {
            id: "currentUser", // This would come from your auth context
            username: "currentUser",
            displayName: "You",
            avatar: "🏃",
          },
          sharedAt: new Date(),
          likes: [],
          comments: [],
          privacySettings: {
            includeRoute: options.includeRoute || false,
            includeExactLocation: options.includeExactLocation || false,
            units: options.units || "metric",
          },
        },
      };

      return {
        success: true,
        sharedActivity,
      };
    } catch (error) {
      console.error("Error sharing activity to friends:", error);
      return { success: false };
    }
  }

  /**
   * Open location in external maps app
   */
  static async openInMaps(latitude: number, longitude: number, name?: string) {
    const label = name ? encodeURIComponent(name) : "";

    const appleMapsUrl = `maps:0,0?q=${label}@${latitude},${longitude}`;
    const googleMapsUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    let url = webUrl;

    if (Platform.OS === "ios") {
      // Try Apple Maps first on iOS
      const canOpenApple = await Linking.canOpenURL(appleMapsUrl);
      if (canOpenApple) {
        url = appleMapsUrl;
      }
    } else if (Platform.OS === "android") {
      // Try native Google Maps on Android
      const canOpenGoogle = await Linking.canOpenURL(googleMapsUrl);
      if (canOpenGoogle) {
        url = googleMapsUrl;
      }
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      // Fallback to web URL
      await Linking.openURL(webUrl);
    }
  }

  /**
   * Copy location to clipboard
   */
  static async copyLocationToClipboard(spot: SavedSpot) {
    try {
      const message = this.createLocationMessage(spot);
      await Clipboard.setStringAsync(message);
      return message;
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      throw error;
    }
  }

  /**
   * Copy activity to clipboard with unit preferences
   */
  static async copyActivityToClipboard(
    activity: Activity,
    options: ShareOptions = {}
  ) {
    try {
      const message = this.createActivityMessage(activity, options);
      await Clipboard.setStringAsync(message);
      return message;
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      throw error;
    }
  }

  /**
   * Share multiple locations as a trip/collection
   */
  static async shareLocationCollection(
    spots: SavedSpot[],
    collectionName: string = "My Adventure Spots"
  ) {
    try {
      let message = `🗺️ ${collectionName}\n`;
      message += `📍 ${spots.length} amazing locations\n\n`;

      spots.forEach((spot, index) => {
        const emoji = this.getCategoryEmoji(spot.category);
        message += `${index + 1}. ${emoji} ${spot.name}\n`;
        if (spot.description) {
          message += `   ${spot.description}\n`;
        }
        message += `   📍 ${spot.location.latitude.toFixed(
          4
        )}, ${spot.location.longitude.toFixed(4)}\n`;
        message += `   🗺️ ${this.getGoogleMapsUrl(
          spot.location.latitude,
          spot.location.longitude,
          spot.name
        )}\n\n`;
      });

      message += `Shared from ExplorAble 🌲`;

      // Copy to clipboard for easy pasting
      await Clipboard.setStringAsync(message);

      const result = await Share.share({
        message,
        title: collectionName,
      });

      return result;
    } catch (error) {
      console.error("Error sharing location collection:", error);
      throw error;
    }
  }
}
export class TripShareService extends ShareService {
  /**
   * Create a shareable message for a trip
   */
  static createTripMessage(trip: Trip, options: ShareOptions = {}): string {
    const units = options.units || "metric";

    // Calculate trip statistics
    const activities =
      trip.items?.filter((item) => item.type === "activity") || [];
    const spots = trip.items?.filter((item) => item.type === "spot") || [];

    const totalDistance = activities.reduce(
      (sum, item) => sum + (item.data.distance || 0),
      0
    );

    const totalDuration = activities.reduce(
      (sum, item) => sum + (item.data.duration || 0),
      0
    );

    const getDaysCount = () => {
      const start = new Date(trip.start_date);
      const end = new Date(trip.end_date);
      const days =
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
        1;
      return days > 0 ? days : 1;
    };

    // Build the message
    let message = `🏞️ ${trip.name}\n`;
    message += `📅 ${this.formatTripDate(
      trip.start_date
    )} - ${this.formatTripDate(trip.end_date)}`;
    message += ` (${getDaysCount()} day${getDaysCount() > 1 ? "s" : ""})\n\n`;

    message += `📊 Trip Summary:\n`;

    if (activities.length > 0) {
      message += `🏃 ${activities.length} activities\n`;
      message += `  • Total distance: ${this.formatDistance(
        totalDistance,
        units
      )}\n`;
      message += `  • Total time active: ${this.formatDuration(
        totalDuration
      )}\n`;

      // List top activities
      const topActivities = activities.slice(0, 3);
      if (topActivities.length > 0) {
        message += `  • Highlights:\n`;
        topActivities.forEach((item) => {
          const emoji = this.getActivityEmoji(item.data.type);
          message += `    ${emoji} ${item.data.name} - ${this.formatDistance(
            item.data.distance,
            units
          )}\n`;
        });
      }
    }

    if (spots.length > 0) {
      message += `\n📍 ${spots.length} amazing spots visited:\n`;
      const topSpots = spots.slice(0, 5);
      topSpots.forEach((item, index) => {
        const emoji = this.getCategoryEmoji(item.data.category);
        message += `  ${index + 1}. ${emoji} ${
          item.data.name || "Unnamed spot"
        }`;
        if (item.data.description) {
          message += ` - ${item.data.description.substring(0, 50)}${
            item.data.description.length > 50 ? "..." : ""
          }`;
        }
        message += "\n";
      });

      if (spots.length > 5) {
        message += `  ...and ${spots.length - 5} more spots!\n`;
      }
    }

    // Add photo count
    const totalPhotos = spots.reduce(
      (sum, item) => sum + (item.data.photos?.length || 0),
      0
    );

    if (totalPhotos > 0) {
      message += `\n📸 ${totalPhotos} photo${
        totalPhotos > 1 ? "s" : ""
      } from this adventure\n`;
    }

    // Add tagged friends if any
    if (trip.tagged_friends && trip.tagged_friends.length > 0) {
      message += `\n👥 Shared adventure with ${
        trip.tagged_friends.length
      } friend${trip.tagged_friends.length > 1 ? "s" : ""}\n`;
    }

    message += `\n🌲 Tracked with ExplorAble`;

    return message;
  }

  /**
   * Format trip date
   */
  static formatTripDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  /**
   * Get shareable trip link (would need backend support)
   */
  static getTripShareLink(tripId: string): string {
    // This would link to your web app or deep link
    // For now, return a placeholder
    return `https://explorable.app/trip/${tripId}`;
  }

  /**
   * Share trip to external apps
   */
  static async shareTrip(trip: Trip, options: ShareOptions = {}): Promise<any> {
    try {
      const message = this.createTripMessage(trip, options);

      const shareOptions: any = {
        message,
        title: `Check out my trip: ${trip.name}!`,
      };

      // On iOS, add URL separately
      if (Platform.OS === "ios" && options.includeLink) {
        shareOptions.url = this.getTripShareLink(trip.id);
      }

      const result = await Share.share(shareOptions);
      return result;
    } catch (error) {
      console.error("Error sharing trip:", error);
      throw error;
    }
  }

  /**
   * Create a trip summary image/card for visual sharing
   * This creates an HTML template that can be captured as an image
   */
  static generateTripCardHTML(trip: Trip, options: ShareOptions = {}): string {
    const units = options.units || "metric";
    const activities =
      trip.items?.filter((item) => item.type === "activity") || [];
    const spots = trip.items?.filter((item) => item.type === "spot") || [];

    // Collect all photos from spots
    const photos: string[] = [];
    if (trip.cover_photo) photos.push(trip.cover_photo);
    spots.forEach((item) => {
      if (item.data.photos) {
        photos.push(...item.data.photos.slice(0, 4 - photos.length));
      }
    });

    const totalDistance = activities.reduce(
      (sum, item) => sum + (item.data.distance || 0),
      0
    );

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: linear-gradient(135deg, #2d5a3d 0%, #d85430 100%);
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          width: 400px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
          background: linear-gradient(135deg, #2d5a3d 0%, #d85430 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          font-size: 28px;
          margin-bottom: 10px;
        }
        .header .dates {
          font-size: 16px;
          opacity: 0.9;
        }
        .photos {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2px;
          max-height: 400px;
          overflow: hidden;
        }
        .photos img {
          width: 100%;
          height: 200px;
          object-fit: cover;
        }
        .photos.single img {
          grid-column: 1 / -1;
          height: 400px;
        }
        .stats {
          padding: 30px;
        }
        .stat-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .stat {
          text-align: center;
          flex: 1;
        }
        .stat-value {
          font-size: 32px;
          font-weight: bold;
          color: #2d5a3d;
        }
        .stat-label {
          font-size: 14px;
          color: #666;
          margin-top: 5px;
        }
        .highlights {
          padding: 0 30px 20px;
        }
        .highlights h3 {
          font-size: 16px;
          color: #333;
          margin-bottom: 15px;
        }
        .highlight-item {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
          padding: 10px;
          background: #f8f8f8;
          border-radius: 10px;
        }
        .highlight-icon {
          font-size: 24px;
          margin-right: 12px;
        }
        .highlight-text {
          flex: 1;
          font-size: 14px;
          color: #444;
        }
        .footer {
          background: #f0f0f0;
          padding: 20px;
          text-align: center;
          border-top: 1px solid #e0e0e0;
        }
        .brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 600;
          color: #2d5a3d;
        }
        .brand-icon {
          font-size: 24px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>${trip.name}</h1>
          <div class="dates">
            ${this.formatTripDate(trip.start_date)} - ${this.formatTripDate(
      trip.end_date
    )}
          </div>
        </div>
        
        ${
          photos.length > 0
            ? `
          <div class="photos ${photos.length === 1 ? "single" : ""}">
            ${photos
              .slice(0, 4)
              .map((photo) => `<img src="${photo}" alt="Trip photo">`)
              .join("")}
          </div>
        `
            : ""
        }
        
        <div class="stats">
          <div class="stat-row">
            <div class="stat">
              <div class="stat-value">${activities.length}</div>
              <div class="stat-label">Activities</div>
            </div>
            <div class="stat">
              <div class="stat-value">${spots.length}</div>
              <div class="stat-label">Spots</div>
            </div>
            <div class="stat">
              <div class="stat-value">${
                this.formatDistance(totalDistance, units).split(" ")[0]
              }</div>
              <div class="stat-label">${
                this.formatDistance(totalDistance, units).split(" ")[1]
              }</div>
            </div>
          </div>
        </div>
        
        ${
          spots.length > 0
            ? `
          <div class="highlights">
            <h3>Top Spots Visited</h3>
            ${spots
              .slice(0, 3)
              .map(
                (item) => `
              <div class="highlight-item">
                <span class="highlight-icon">${this.getCategoryEmoji(
                  item.data.category
                )}</span>
                <span class="highlight-text">${
                  item.data.name || "Unnamed spot"
                }</span>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
        
        <div class="footer">
          <div class="brand">
            <span class="brand-icon">🌲</span>
            <span>ExplorAble</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  }

  /**
   * Share trip with photos using WebView capture
   */
  static async shareTripWithPhotos(
    trip: Trip,
    captureRef: any, // ViewShot ref
    options: ShareOptions = {}
  ): Promise<any> {
    try {
      // Check if we can share images
      const isAvailable = await Sharing.isAvailableAsync();

      if (!isAvailable || !captureRef.current) {
        // Fallback to text sharing
        return this.shareTrip(trip, options);
      }

      // Capture the trip card as an image
      const imageUri = await captureRef.current.capture();

      // Copy trip details to clipboard for easy pasting
      const message = this.createTripMessage(trip, options);
      await Clipboard.setStringAsync(message);

      // Share the image
      await Sharing.shareAsync(imageUri, {
        dialogTitle: `Share ${trip.name}`,
        mimeType: "image/jpeg",
        UTI: "public.jpeg",
      });

      return { action: "shared" };
    } catch (error) {
      console.error("Error sharing trip with photos:", error);
      // Fallback to text sharing
      return this.shareTrip(trip, options);
    }
  }

  /**
   * Export trip data as JSON for backup/sharing
   */
  static async exportTripData(trip: Trip): Promise<string> {
    const exportData = {
      trip: {
        name: trip.name,
        start_date: trip.start_date,
        end_date: trip.end_date,
        created_at: trip.created_at,
      },
      activities:
        trip.items?.filter((i) => i.type === "activity").map((i) => i.data) ||
        [],
      spots:
        trip.items?.filter((i) => i.type === "spot").map((i) => i.data) || [],
      stats: {
        total_activities:
          trip.items?.filter((i) => i.type === "activity").length || 0,
        total_spots: trip.items?.filter((i) => i.type === "spot").length || 0,
        total_photos:
          trip.items
            ?.filter((i) => i.type === "spot")
            .reduce((sum, item) => sum + (item.data.photos?.length || 0), 0) ||
          0,
      },
    };

    return JSON.stringify(exportData, null, 2);
  }
}
