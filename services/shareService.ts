// services/shareService.ts - Enhanced with activity sharing and privacy controls
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import { Alert, Platform, Share } from 'react-native';
import { categories, CategoryType } from '../constants/categories';
import { Activity } from '../contexts/ActivityContext';
import { SavedSpot } from '../contexts/LocationContext';

export interface ShareOptions {
  includeRoute?: boolean;
  includeExactLocation?: boolean;
  shareToFriends?: boolean;
  friendIds?: string[];
  message?: string;
}

export class ShareService {
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
    
    message += `\n📍 Location: ${spot.location.latitude.toFixed(6)}, ${spot.location.longitude.toFixed(6)}`;
    
    // Add Google Maps link
    const mapsUrl = this.getGoogleMapsUrl(spot.location.latitude, spot.location.longitude, spot.name);
    message += `\n🗺️ View on Maps: ${mapsUrl}`;
    
    if (spot.photos && spot.photos.length > 0) {
      message += `\n📸 ${spot.photos.length} photo${spot.photos.length > 1 ? 's' : ''} attached`;
    }
    
    message += `\n\nShared from ExplorAble 🌲`;
    
    return message;
  }

  /**
   * Get emoji for category
   */
  static getCategoryEmoji(category: CategoryType): string {
    const emojiMap: Record<CategoryType, string> = {
      beach: '🏖️',
      trail: '🥾',
      restaurant: '🍽️',
      viewpoint: '🌄',
      camping: '🏕️',
      water: '💧',
      climbing: '🧗',
      historic: '🏛️',
      shopping: '🛍️',
      other: '📍',
    };
    return emojiMap[category] || '📍';
  }

  /**
   * Create Google Maps URL
   */
  static getGoogleMapsUrl(latitude: number, longitude: number, name?: string): string {
    const label = name ? encodeURIComponent(name) : '';
    return `https://maps.google.com/?q=${latitude},${longitude}${label ? `&label=${label}` : ''}`;
  }

  /**
   * Create Apple Maps URL
   */
  static getAppleMapsUrl(latitude: number, longitude: number, name?: string): string {
    const label = name ? encodeURIComponent(name) : '';
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
      if (Platform.OS === 'ios') {
        const mapsUrl = this.getAppleMapsUrl(spot.location.latitude, spot.location.longitude, spot.name);
        shareOptions.url = mapsUrl;
      }

      const result = await Share.share(shareOptions);
      
      return result;
    } catch (error) {
      console.error('Error sharing location:', error);
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
        if (photo.startsWith('data:image')) {
          const filename = `share_${spot.name.replace(/[^a-zA-Z0-9]/g, '_')}_${i}.jpg`;
          const fileUri = `${FileSystem.cacheDirectory}${filename}`;
          const base64Data = photo.split(',')[1];
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          photoUri = fileUri;
        }

        // For the first photo, include the full message
        if (i === 0) {
          const message = this.createLocationMessage(spot);
          
          // Copy message to clipboard so user can paste it
          await Clipboard.setStringAsync(message);
          
          // Share the photo
          await Sharing.shareAsync(photoUri, {
            dialogTitle: `Share ${spot.name}`,
            mimeType: 'image/jpeg',
            UTI: 'public.jpeg', // iOS specific
          });
          
          // Note: The message has been copied to clipboard
          console.log('Message copied to clipboard for pasting');
        } else {
          // For additional photos, just share them
          await Sharing.shareAsync(photoUri, {
            dialogTitle: `${spot.name} - Photo ${i + 1}`,
            mimeType: 'image/jpeg',
            UTI: 'public.jpeg',
          });
        }
      }

      return { action: 'shared' };
    } catch (error) {
      console.error('Error sharing with photos:', error);
      // Fallback to text-only share
      return this.shareLocation(spot);
    }
  }

  /**
   * Create a shareable message for an activity with privacy options
   */
  static createActivityMessage(activity: Activity, options: ShareOptions = {}): string {
    const activityEmoji = this.getActivityEmoji(activity.type);
    const distance = (activity.distance / 1000).toFixed(2);
    const duration = this.formatDuration(activity.duration);
    const avgSpeed = activity.averageSpeed.toFixed(1);
    
    let message = `${activityEmoji} ${activity.name}\n`;
    message += `\n📊 Activity Stats:`;
    message += `\n• Distance: ${distance} km`;
    message += `\n• Duration: ${duration}`;
    message += `\n• Avg Speed: ${avgSpeed} km/h`;
    
    if (activity.maxSpeed && activity.maxSpeed > 0) {
      message += `\n• Max Speed: ${activity.maxSpeed.toFixed(1)} km/h`;
    }
    
    if (activity.elevationGain && activity.elevationGain > 0) {
      message += `\n• Elevation Gain: ${Math.round(activity.elevationGain)}m`;
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
        message += `\n• Start: ${startPoint.latitude.toFixed(4)}, ${startPoint.longitude.toFixed(4)}`;
        message += `\n• End: ${endPoint.latitude.toFixed(4)}, ${endPoint.longitude.toFixed(4)}`;
        
        // Add Google Maps link for route
        const routeUrl = this.createRouteUrl(activity.route);
        if (routeUrl) {
          message += `\n🗺️ View Route: ${routeUrl}`;
        }
      } else {
        // Just show general area
        message += `\n\n📍 General Area: ${this.getGeneralArea(startPoint.latitude, startPoint.longitude)}`;
      }
    } else if (!options.includeRoute) {
      message += `\n\n📍 Route details hidden for privacy`;
    }
    
    const date = new Date(activity.startTime).toLocaleDateString();
    message += `\n\n📅 ${date}`;
    message += `\n\nShared from ExplorAble 🌲`;
    
    return message;
  }

  /**
   * Get emoji for activity type
   */
  static getActivityEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      bike: '🚴',
      run: '🏃',
      walk: '🚶',
      hike: '🥾',
      paddleboard: '🏄',
      climb: '🧗',
      other: '🏃',
    };
    return emojiMap[type] || '🏃';
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
   * Share activity with privacy options and user prompts
   */
  static async shareActivity(activity: Activity, customOptions?: ShareOptions): Promise<any> {
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
        'Share Activity',
        'How much detail would you like to share?',
        [
          {
            text: 'Stats Only',
            onPress: () => {
              const options: ShareOptions = { includeRoute: false };
              this.performActivityShare(activity, options)
                .then(resolve)
                .catch(reject);
            }
          },
          {
            text: 'General Area',
            onPress: () => {
              const options: ShareOptions = { 
                includeRoute: true, 
                includeExactLocation: false 
              };
              this.performActivityShare(activity, options)
                .then(resolve)
                .catch(reject);
            }
          },
          {
            text: 'Full Route',
            onPress: () => {
              const options: ShareOptions = { 
                includeRoute: true, 
                includeExactLocation: true 
              };
              this.performActivityShare(activity, options)
                .then(resolve)
                .catch(reject);
            }
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({ action: 'cancelled' })
          }
        ]
      );
    });
  }

  /**
   * Perform the actual activity share
   */
  private static async performActivityShare(activity: Activity, options: ShareOptions) {
    try {
      const message = this.createActivityMessage(activity, options);
      
      const shareOptions: any = {
        message,
        title: `Check out my ${activity.type} activity!`,
      };

      // If including full route, add map URL for iOS
      if (Platform.OS === 'ios' && options.includeRoute && options.includeExactLocation && activity.route) {
        const routeUrl = this.createRouteUrl(activity.route);
        if (routeUrl) {
          shareOptions.url = routeUrl;
        }
      }

      const result = await Share.share(shareOptions);
      return result;
    } catch (error) {
      console.error('Error sharing activity:', error);
      throw error;
    }
  }

  /**
   * Share activity with route map (creates a static map URL)
   */
  static async shareActivityWithMap(activity: Activity, options: ShareOptions = {}) {
    try {
      const includeRoute = options.includeRoute !== false; // default to true
      const message = this.createActivityMessage(activity, { ...options, includeRoute });
      
      // If there's a route and we're including it, add a static map preview
      if (includeRoute && activity.route && activity.route.length > 0 && options.includeExactLocation) {
        // Create a simplified path for URL (limit points to avoid URL length issues)
        const simplifiedRoute = this.simplifyRoute(activity.route, 20);
        const pathString = simplifiedRoute
          .map(point => `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`)
          .join('|');
        
        // Google Static Maps API URL (Note: requires API key in production)
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=600x400&path=color:0x0000ff|weight:3|${pathString}`;
        
        const shareOptions: any = {
          message: message + `\n\n🗺️ View route: ${mapUrl}`,
          title: `My ${activity.type} activity`,
        };
        
        if (Platform.OS === 'ios') {
          shareOptions.url = mapUrl;
        }
        
        return await Share.share(shareOptions);
      }
      
      return this.performActivityShare(activity, options);
    } catch (error) {
      console.error('Error sharing activity with map:', error);
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
        type: 'activity' as const,
        timestamp: new Date(),
        data: {
          ...activity,
          sharedBy: {
            id: 'currentUser', // This would come from your auth context
            username: 'currentUser',
            displayName: 'You',
            avatar: '🏃',
          },
          sharedAt: new Date(),
          likes: [],
          comments: [],
          privacySettings: {
            includeRoute: options.includeRoute || false,
            includeExactLocation: options.includeExactLocation || false,
          }
        }
      };

      // In a real app, this would be an API call to your backend
      // For now, we'll return the shared activity object so it can be added to the feed
      console.log('Sharing activity to friends:', friendIds);
      console.log('Shared activity data:', sharedActivity);

      return { 
        success: true, 
        sharedActivity 
      };
    } catch (error) {
      console.error('Error sharing activity to friends:', error);
      return { success: false };
    }
  }

  /**
   * Open location in external maps app
   */
  static async openInMaps(latitude: number, longitude: number, name?: string) {
    const label = name ? encodeURIComponent(name) : '';
    
    const appleMapsUrl = `maps:0,0?q=${label}@${latitude},${longitude}`;
    const googleMapsUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    
    let url = webUrl;
    
    if (Platform.OS === 'ios') {
      // Try Apple Maps first on iOS
      const canOpenApple = await Linking.canOpenURL(appleMapsUrl);
      if (canOpenApple) {
        url = appleMapsUrl;
      }
    } else if (Platform.OS === 'android') {
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
      console.error('Error copying to clipboard:', error);
      throw error;
    }
  }

  /**
   * Copy activity to clipboard
   */
  static async copyActivityToClipboard(activity: Activity, options: ShareOptions = {}) {
    try {
      const message = this.createActivityMessage(activity, options);
      await Clipboard.setStringAsync(message);
      return message;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      throw error;
    }
  }

  /**
   * Share multiple locations as a trip/collection
   */
  static async shareLocationCollection(spots: SavedSpot[], collectionName: string = 'My Adventure Spots') {
    try {
      let message = `🗺️ ${collectionName}\n`;
      message += `📍 ${spots.length} amazing locations\n\n`;
      
      spots.forEach((spot, index) => {
        const emoji = this.getCategoryEmoji(spot.category);
        message += `${index + 1}. ${emoji} ${spot.name}\n`;
        if (spot.description) {
          message += `   ${spot.description}\n`;
        }
        message += `   📍 ${spot.location.latitude.toFixed(4)}, ${spot.location.longitude.toFixed(4)}\n`;
        message += `   🗺️ ${this.getGoogleMapsUrl(spot.location.latitude, spot.location.longitude, spot.name)}\n\n`;
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
      console.error('Error sharing location collection:', error);
      throw error;
    }
  }
}