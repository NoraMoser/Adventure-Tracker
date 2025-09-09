// services/locationService.ts
import * as Location from "expo-location";
import { CategoryType } from "../constants/categories";

export interface PlaceSuggestion {
  id: string;
  name: string;
  type: "business" | "landmark" | "address" | "poi";
  address?: string;
  distance?: number; // in meters
  category?: string; // General category string from API
  suggestedCategoryType?: CategoryType; // Direct category type suggestion matching your app's categories
}

export class LocationService {
  /**
   * Detect category type from place name or type
   */
  static detectCategoryFromName(
    placeName: string,
    placeType?: string
  ): CategoryType | undefined {
    const name = placeName.toLowerCase();
    const type = placeType?.toLowerCase() || "";

    // Check for specific keywords
    if (name.includes("beach") || type.includes("beach")) return "beach";
    if (
      name.includes("trail") ||
      name.includes("hike") ||
      type.includes("trail")
    )
      return "trail";
    if (
      name.includes("restaurant") ||
      name.includes("cafe") ||
      name.includes("coffee") ||
      type.includes("food") ||
      type.includes("restaurant")
    )
      return "restaurant";
    if (
      name.includes("viewpoint") ||
      name.includes("vista") ||
      name.includes("lookout") ||
      name.includes("overlook")
    )
      return "viewpoint";
    if (name.includes("camp") || type.includes("camp")) return "camping";
    if (
      name.includes("lake") ||
      name.includes("river") ||
      name.includes("creek") ||
      name.includes("marina") ||
      name.includes("boat")
    )
      return "water";
    if (name.includes("climb") || name.includes("boulder")) return "climbing";
    if (
      name.includes("museum") ||
      name.includes("historic") ||
      name.includes("heritage") ||
      name.includes("monument")
    )
      return "historic";
    if (
      name.includes("shop") ||
      name.includes("store") ||
      name.includes("mall") ||
      type.includes("shopping")
    )
      return "shopping";

    return undefined;
  }

  /**
   * Get smart location suggestions based on coordinates
   */
  static async getLocationSuggestions(
    latitude: number,
    longitude: number
  ): Promise<PlaceSuggestion[]> {
    const suggestions: PlaceSuggestion[] = [];

    try {
      // Get reverse geocoded address
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (addresses && addresses.length > 0) {
        const address = addresses[0];

        // Format the address string
        const formattedAddress = this.formatAddress(address);

        // Add address as a fallback suggestion
        suggestions.push({
          id: "address-0",
          name: address.name || formattedAddress,
          type: "address",
          address: formattedAddress,
          suggestedCategoryType: this.detectCategoryFromName(
            address.name || ""
          ),
        });

        // If there's a specific place name, add it as primary suggestion
        if (address.name && address.name !== address.street) {
          const detectedCategory = this.detectCategoryFromName(address.name);
          suggestions.unshift({
            id: "place-0",
            name: address.name,
            type: "business",
            address: formattedAddress,
            category: detectedCategory ? "Business" : undefined,
            suggestedCategoryType: detectedCategory,
          });
        }

        // Add street as a suggestion if available
        if (address.street) {
          suggestions.push({
            id: "street-0",
            name: `Near ${address.street}`,
            type: "landmark",
            address: formattedAddress,
          });
        }

        // Add district/neighborhood if available
        if (address.district) {
          suggestions.push({
            id: "district-0",
            name: address.district,
            type: "landmark",
            address: formattedAddress,
          });
        }
      }

      // Fetch nearby places using a third-party API or local data
      const nearbyPlaces = await this.fetchNearbyPlaces(latitude, longitude);
      suggestions.push(...nearbyPlaces);
    } catch (error) {
      console.error("Error getting location suggestions:", error);

      // Fallback to coordinates if reverse geocoding fails
      suggestions.push({
        id: "coords-0",
        name: `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
        type: "address",
      });
    }

    // Remove duplicates and sort by relevance
    return this.deduplicateAndSort(suggestions);
  }

  /**
   * Format address object into readable string
   */
  private static formatAddress(
    address: Location.LocationGeocodedAddress
  ): string {
    const parts = [];

    if (address.streetNumber) parts.push(address.streetNumber);
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.region) parts.push(address.region);
    if (address.postalCode) parts.push(address.postalCode);

    return parts.filter(Boolean).join(", ");
  }

  /**
   * Fetch nearby places (mock implementation - replace with actual API)
   */
  // In locationService.ts, replace the mock fetchNearbyPlaces with this:

  private static async fetchNearbyPlaces(
    latitude: number,
    longitude: number
  ): Promise<PlaceSuggestion[]> {
    const suggestions: PlaceSuggestion[] = [];

    try {
      // Use OSM Nominatim for reverse geocoding with extra details
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?` +
          `lat=${latitude}&lon=${longitude}&` +
          `format=json&` +
          `zoom=18&` + // Zoom 18 gives most detailed results (building level)
          `extratags=1&` + // Include extra tags like amenity type
          `namedetails=1&` + // Include all name variations
          `addressdetails=1`, // Include detailed address breakdown
        {
          headers: {
            "User-Agent": "ExplorAble/1.0", // Required by Nominatim TOS
            "Accept-Language": "en", // Get results in English
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Nominatim error: ${response.status}`);
      }

      const data = await response.json();

      // Check if there's a specific place/business name
      if (data.name && data.name !== data.display_name.split(",")[0]) {
        // Detect category from OSM tags
        let categoryType: CategoryType | undefined;

        // Check extratags for better categorization
        if (data.extratags) {
          if (
            data.extratags.amenity === "restaurant" ||
            data.extratags.cuisine
          ) {
            categoryType = "restaurant";
          } else if (
            data.extratags.amenity === "cafe" ||
            data.extratags.amenity === "fast_food"
          ) {
            categoryType = "restaurant";
          } else if (data.extratags.tourism === "viewpoint") {
            categoryType = "viewpoint";
          } else if (data.extratags.tourism === "camp_site") {
            categoryType = "camping";
          } else if (data.extratags.natural === "beach") {
            categoryType = "beach";
          } else if (data.extratags.shop) {
            categoryType = "shopping";
          }
        }

        // If no category from tags, try detecting from name
        if (!categoryType) {
          categoryType = this.detectCategoryFromName(data.name);
        }

        suggestions.push({
          id: `osm-place-${data.place_id}`,
          name: data.name,
          type:
            data.extratags?.amenity || data.extratags?.shop
              ? "business"
              : "poi",
          address: data.display_name,
          suggestedCategoryType: categoryType,
        });
      }

      // Also check namedetails for alternative names
      if (data.namedetails) {
        // Sometimes the official name is in namedetails
        const officialName =
          data.namedetails.name || data.namedetails.official_name;
        if (officialName && officialName !== data.name) {
          suggestions.push({
            id: `osm-alt-${data.place_id}`,
            name: officialName,
            type: "poi",
            address: data.display_name,
            suggestedCategoryType: this.detectCategoryFromName(officialName),
          });
        }
      }

      // If no specific place found, use the address components
      if (suggestions.length === 0 && data.address) {
        // Check for various address components that might be interesting
        const addressName =
          data.address.amenity ||
          data.address.building ||
          data.address.shop ||
          data.address.tourism ||
          data.address.leisure;

        if (addressName) {
          suggestions.push({
            id: `osm-addr-${data.place_id}`,
            name: addressName,
            type: "business",
            address: data.display_name,
            suggestedCategoryType: this.detectCategoryFromName(addressName),
          });
        }
      }
    } catch (error) {
      console.error("Error fetching OSM places:", error);
      // Don't throw - just return empty suggestions and fall back to basic geocoding
    }

    return suggestions;
  }

  /**
   * Remove duplicate suggestions and sort by relevance
   */
  private static deduplicateAndSort(
    suggestions: PlaceSuggestion[]
  ): PlaceSuggestion[] {
    // Remove duplicates based on name
    const seen = new Set<string>();
    const unique = suggestions.filter((s) => {
      const key = s.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by type priority and distance
    return unique.sort((a, b) => {
      // Priority: business > landmark > poi > address
      const typePriority: Record<string, number> = {
        business: 0,
        landmark: 1,
        poi: 2,
        address: 3,
      };

      const priorityDiff = typePriority[a.type] - typePriority[b.type];
      if (priorityDiff !== 0) return priorityDiff;

      // If same type, sort by distance if available
      if (a.distance && b.distance) {
        return a.distance - b.distance;
      }

      return 0;
    });
  }

  /**
   * Search for places by query near a location
   */
  static async searchNearbyPlaces(
    query: string,
    latitude: number,
    longitude: number
  ): Promise<PlaceSuggestion[]> {
    try {
      // This would typically call a search API
      // For now, using geocoding as a simple implementation
      const results = await Location.geocodeAsync(query);

      return results.map((result, index) => ({
        id: `search-${index}`,
        name: query,
        type: "poi" as const,
        address: `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(
          4
        )}`,
        distance: this.calculateDistance(
          latitude,
          longitude,
          result.latitude,
          result.longitude
        ),
      }));
    } catch (error) {
      console.error("Error searching places:", error);
      return [];
    }
  }

  /**
   * Calculate distance between two points in meters
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
