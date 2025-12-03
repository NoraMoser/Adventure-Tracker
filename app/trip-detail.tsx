// app/trip-detail.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { theme } from "../constants/theme";
import { useSettings } from "../contexts/SettingsContext";
import { useTrips } from "../contexts/TripContext";
import { useFocusEffect } from "@react-navigation/native";
import { Share, Modal, Platform, Linking } from "react-native";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import ViewShot from "react-native-view-shot";
import { TripShareService } from "../services/shareService";
import ImageViewer from "../components/ImageViewer";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

// Weather API configuration
const getWeatherForLocation = async (
  lat: number,
  lon: number,
  startDate: Date,
  endDate: Date,
  useImperial: boolean = false
) => {
  try {
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];
    const tempUnit = useImperial ? "fahrenheit" : "celsius";
    const precipUnit = useImperial ? "inch" : "mm";
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&start_date=${start}&end_date=${end}&timezone=auto&temperature_unit=${tempUnit}&precipitation_unit=${precipUnit}`;

    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching weather:", error);
    return null;
  }
};

const getWeatherIcon = (code: number) => {
  if (code === 0) return "sunny";
  if (code <= 3) return "partly-sunny";
  if (code <= 48) return "cloudy";
  if (code <= 67) return "rainy";
  if (code <= 77) return "snow";
  if (code <= 82) return "rainy";
  if (code >= 95) return "thunderstorm";
  return "cloudy";
};

const generateTripMapHTML = (tripActivities: any[], tripSpots: any[]) => {
  let centerLat = 47.6062;
  let centerLng = -122.3321;

  const allPoints: any[] = [];

  tripSpots.forEach((spot) => {
    if (spot.location) {
      allPoints.push({
        lat: spot.location.latitude,
        lng: spot.location.longitude,
        type: "spot",
        name: spot.name,
      });
    }
  });

  tripActivities.forEach((activity) => {
    if (activity.route && activity.route.length > 0) {
      const midPoint = activity.route[Math.floor(activity.route.length / 2)];
      allPoints.push({
        lat: midPoint.latitude,
        lng: midPoint.longitude,
        type: "activity",
        name: activity.name || "Activity",
        route: activity.route,
      });
    }
  });

  if (allPoints.length > 0) {
    centerLat = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length;
    centerLng = allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
        .trip-popup { text-align: center; }
        .trip-popup b { font-size: 14px; }
        .trip-popup .type { color: #666; font-size: 11px; margin-top: 4px; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${centerLat}, ${centerLng}], 11);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 18
        }).addTo(map);
        
        var markers = [];
        
        ${tripSpots
          .map((spot, index) => {
            if (!spot.location) return "";
            return `
            var spotMarker${index} = L.circleMarker(
              [${spot.location.latitude}, ${spot.location.longitude}], 
              {
                radius: 12,
                fillColor: '#d85430',
                color: '#fff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.8
              }
            )
            .addTo(map)
            .bindPopup('<div class="trip-popup"><b>📍 ${
              spot.name || "Saved Spot"
            }</b><div class="type">Saved Location</div></div>');
            markers.push(spotMarker${index});
          `;
          })
          .join("")}
        
        ${tripActivities
          .map((activity, index) => {
            if (!activity.route || activity.route.length === 0) return "";
            const coords = activity.route
              .map((p: any) => `[${p.latitude}, ${p.longitude}]`)
              .join(",");
            return `
            var route${index} = L.polyline([${coords}], {
              color: '#2d5a3d',
              weight: 4,
              opacity: 0.7
            })
            .addTo(map)
            .bindPopup('<div class="trip-popup"><b>🏃 ${
              activity.name || activity.type || "Activity"
            }</b><div class="type">${activity.type || "Activity"}</div></div>');
            markers.push(route${index});
            
            var startMarker${index} = L.circleMarker(
              [${activity.route[0].latitude}, ${activity.route[0].longitude}],
              {
                radius: 8,
                fillColor: '#2d5a3d',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
              }
            ).addTo(map);
            markers.push(startMarker${index});
          `;
          })
          .join("")}
        
        if (markers.length > 0) {
          var group = new L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.15));
        }
      </script>
    </body>
    </html>
  `;
};

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, removeFromTrip, refreshTrips } = useTrips();

  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [weatherData, setWeatherData] = useState<any>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const { settings } = useSettings();
  const useImperial = settings?.units === "imperial";
  const shareCardRef = useRef<ViewShot>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentSpotImages, setCurrentSpotImages] = useState<string[]>([]);
  const { user } = useAuth();
  const [processedSpots, setProcessedSpots] = useState<any[]>([]);

  const trip = trips.find((t) => t.id === tripId);

  const tripActivities = trip
    ? trip.items
        .filter((item) => item.type === "activity")
        .map((item) => ({
          tripItemId: item.id,
          ...item.data,
          displayDate:
            item.data.activityDate ||
            item.data.activity_date ||
            item.data.startTime ||
            item.data.start_time ||
            item.data.date ||
            item.added_at,
        }))
    : [];

  const tripSpots = trip
    ? trip.items
        .filter((item) => item.type === "spot")
        .map((item) => ({
          tripItemId: item.id,
          ...item.data,
          displayDate:
            item.data.locationDate ||
            item.data.location_date ||
            item.data.timestamp ||
            item.added_at,
        }))
    : [];

  const [processedActivities, setProcessedActivities] = useState<any[]>([]);

  // Add a useEffect to process activity photos
  useEffect(() => {
    const processActivityPhotos = async () => {
      if (!trip || tripActivities.length === 0) {
        setProcessedActivities([]);
        return;
      }

      const updatedActivities = [];

      for (const activity of tripActivities) {
        let finalActivity = { ...activity };

        // Check if photos need processing
        if (activity.photos && activity.photos.length > 0) {
          // Filter out local URIs
          finalActivity.photos = activity.photos.filter(
            (p: string) => p.startsWith("http://") || p.startsWith("https://")
          );
        }

        updatedActivities.push(finalActivity);
      }

      setProcessedActivities(updatedActivities);
    };

    processActivityPhotos();
  }, [trip?.id, JSON.stringify(tripActivities)]);
  // Process spots to ensure photos are valid URLs
  useEffect(() => {
    const processSpotPhotos = async () => {
      if (!trip || tripSpots.length === 0) {
        setProcessedSpots([]);
        return;
      }

      const updatedSpots = [];

      for (const spot of tripSpots) {
        let finalSpot = { ...spot };

        // Check if photos need processing
        if (spot.photos && spot.photos.length > 0) {
          const hasLocalPhotos = spot.photos.some((p: string) =>
            p.startsWith("file://")
          );

          // For shared trips or spots with local photos, fetch from database
          if (hasLocalPhotos && spot.id) {
            const { data, error } = await supabase
              .from("locations")
              .select("photos")
              .eq("id", spot.id)
              .single();

            if (data?.photos) {
              finalSpot.photos = data.photos;
            } else {
              // Filter out local URIs if we can't get DB photos
              finalSpot.photos = spot.photos.filter(
                (p: string) =>
                  p.startsWith("http://") || p.startsWith("https://")
              );
            }
          } else {
            // Already has valid URLs, just filter to be safe
            finalSpot.photos = spot.photos.filter(
              (p: string) => p.startsWith("http://") || p.startsWith("https://")
            );
          }
        }

        updatedSpots.push(finalSpot);
      }

      setProcessedSpots(updatedSpots);
    };

    processSpotPhotos();
  }, [trip?.id, JSON.stringify(tripSpots), user?.id]);

  useEffect(() => {
    if (trip) {
      loadWeatherData();
    }
  }, [trip, tripActivities.length, processedSpots.length]);

  useFocusEffect(
    useCallback(() => {
      refreshTrips();
    }, [])
  );

  const loadWeatherData = async () => {
    if (!trip || (tripActivities.length === 0 && processedSpots.length === 0))
      return;

    setLoadingWeather(true);

    let lat = 47.6062;
    let lon = -122.3321;

    const firstSpot = processedSpots.find((spot) => spot.location);
    const firstActivity = tripActivities.find(
      (activity) => activity.route?.length > 0
    );

    if (firstSpot?.location) {
      lat = firstSpot.location.latitude;
      lon = firstSpot.location.longitude;
    } else if (firstActivity?.route) {
      lat = firstActivity.route[0].latitude;
      lon = firstActivity.route[0].longitude;
    }

    const weather = await getWeatherForLocation(
      lat,
      lon,
      trip.start_date,
      trip.end_date,
      useImperial
    );
    setWeatherData(weather);
    setLoadingWeather(false);
  };

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Trip not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const formatDate = (date: Date) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0m";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleRemoveItem = (tripItemId: string, itemName: string) => {
    Alert.alert("Remove from Trip", `Remove "${itemName}" from this trip?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removeFromTrip(trip.id, tripItemId),
      },
    ]);
  };

  const handleActivityPress = (activity: any) => {
    // Check for photos first
    if (activity.photos && activity.photos.length > 0) {
      setCurrentSpotImages(activity.photos); // Reuse the same image viewer
      setSelectedImageIndex(0);
      setShowImageViewer(true);
    } else if (trip.created_by !== user?.id) {
      // For shared trips without photos, show details in alert
      Alert.alert(
        activity.name || "Activity Details",
        `Type: ${activity.type || "Unknown"}\n` +
          `Distance: ${(activity.distance / 1000).toFixed(2)} km\n` +
          `Duration: ${formatDuration(activity.duration)}\n` +
          `Date: ${new Date(
            activity.displayDate || activity.startTime
          ).toLocaleDateString()}\n` +
          `${activity.notes ? `\nNotes: ${activity.notes}` : ""}`,
        [{ text: "OK" }]
      );
    } else {
      // For own trips, navigate to activity detail page
      if (activity.id) {
        // Check if it's a valid UUID
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(activity.id)) {
          router.push(`/activity/${activity.id}`);
        } else {
          Alert.alert("Error", "Activity details not available");
        }
      } else {
        Alert.alert("Error", "Activity details not available");
      }
    }
  };

  const handleSpotPress = (spot: any) => {
    if (spot.photos && spot.photos.length > 0) {
      setCurrentSpotImages(spot.photos);
      setSelectedImageIndex(0);
      setShowImageViewer(true);
    } else if (trip.created_by === user?.id && spot.id) {
      // Only navigate to detail page for OWN trips with valid UUID
      // Check if the ID looks like a valid UUID
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(spot.id)) {
        router.push(`/location/${spot.id}`);
      } else {
        Alert.alert("Error", "Spot details not available");
      }
    }
  };

  const getDaysCount = () => {
    const start =
      trip.start_date instanceof Date
        ? trip.start_date
        : new Date(trip.start_date);
    const end =
      trip.end_date instanceof Date ? trip.end_date : new Date(trip.end_date);
    const days =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return days > 0 ? days : 1;
  };

  const handleShareTrip = async (
    shareType:
      | "native"
      | "facebook"
      | "instagram"
      | "whatsapp"
      | "image"
      | "export"
  ) => {
    try {
      const shareOptions = {
        units: settings?.units || "metric",
        includeLink: false,
      };

      switch (shareType) {
        case "native":
          await TripShareService.shareTrip(trip, shareOptions);
          break;

        case "image":
          await TripShareService.shareTripWithPhotos(
            trip,
            shareCardRef,
            shareOptions
          );
          Alert.alert(
            "Tip",
            "Trip details copied to clipboard - paste when sharing!"
          );
          break;

        case "facebook":
          const fbMessage = TripShareService.createTripMessage(
            trip,
            shareOptions
          );
          const fbUrl = `fb://share?text=${encodeURIComponent(fbMessage)}`;
          const fbWebUrl = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(
            fbMessage
          )}`;

          try {
            const canOpen = await Linking.canOpenURL(fbUrl);
            await Linking.openURL(canOpen ? fbUrl : fbWebUrl);
          } catch {
            await Linking.openURL(fbWebUrl);
          }
          break;

        case "whatsapp":
          const waMessage = TripShareService.createTripMessage(
            trip,
            shareOptions
          );
          const waUrl = `whatsapp://send?text=${encodeURIComponent(waMessage)}`;
          const waWebUrl = `https://wa.me/?text=${encodeURIComponent(
            waMessage
          )}`;

          try {
            const canOpen = await Linking.canOpenURL(waUrl);
            await Linking.openURL(canOpen ? waUrl : waWebUrl);
          } catch {
            Alert.alert("WhatsApp not installed", "Opening web version...");
            await Linking.openURL(waWebUrl);
          }
          break;

        case "instagram":
          if (shareCardRef.current) {
            const imageUri = await shareCardRef.current.capture();
            const instagramUrl = `instagram://library?AssetPath=${imageUri}`;

            try {
              const canOpen = await Linking.canOpenURL(instagramUrl);
              if (canOpen) {
                await Linking.openURL(instagramUrl);
                Alert.alert("Tip", "Trip details copied to clipboard!");
              } else {
                Alert.alert(
                  "Instagram not installed",
                  "Please install Instagram to share"
                );
              }
            } catch {
              Alert.alert("Error", "Could not open Instagram");
            }
          }
          break;

        case "export":
          const exportData = await TripShareService.exportTripData(trip);
          await Clipboard.setStringAsync(exportData);
          Alert.alert("Exported!", "Trip data copied to clipboard as JSON");
          break;
      }

      setShowShareModal(false);
    } catch (error) {
      console.error("Share failed:", error);
      Alert.alert("Share Failed", "Unable to share trip");
    }
  };

  const ShareModal = () => (
    <Modal
      visible={showShareModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowShareModal(false)}
    >
      <TouchableOpacity
        style={styles.shareOverlay}
        activeOpacity={1}
        onPress={() => setShowShareModal(false)}
      >
        <View style={styles.shareMenu}>
          <View style={styles.shareHandle} />
          <Text style={styles.shareTitle}>Share Trip</Text>

          <View style={styles.shareTripPreview}>
            <Text style={styles.sharePreviewTitle}>{trip.name}</Text>
            <Text style={styles.sharePreviewStats}>
              {tripActivities.length} activities • {processedSpots.length} spots
              • {getDaysCount()} days
            </Text>
            {processedSpots.filter((s) => s.photos?.length > 0).length > 0 && (
              <Text style={styles.sharePreviewPhotos}>
                📸{" "}
                {processedSpots.reduce(
                  (sum, s) => sum + (s.photos?.length || 0),
                  0
                )}{" "}
                photos
              </Text>
            )}
          </View>

          <ScrollView style={styles.shareOptions}>
            <TouchableOpacity
              style={styles.shareOption}
              onPress={() => handleShareTrip("native")}
            >
              <View
                style={[
                  styles.shareIconContainer,
                  { backgroundColor: theme.colors.forest },
                ]}
              >
                <Ionicons name="share" size={24} color="white" />
              </View>
              <View style={styles.shareOptionInfo}>
                <Text style={styles.shareOptionText}>Share to any app</Text>
                <Text style={styles.shareOptionSubtext}>
                  Messages, Email, etc.
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.shareSocialSection}>
              <Text style={styles.shareSectionTitle}>
                Share to Social Media
              </Text>

              <TouchableOpacity
                style={styles.shareOption}
                onPress={() => handleShareTrip("whatsapp")}
              >
                <View
                  style={[
                    styles.shareIconContainer,
                    { backgroundColor: "#25D366" },
                  ]}
                >
                  <Ionicons name="logo-whatsapp" size={24} color="white" />
                </View>
                <View style={styles.shareOptionInfo}>
                  <Text style={styles.shareOptionText}>WhatsApp</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareOption}
                onPress={() => handleShareTrip("facebook")}
              >
                <View
                  style={[
                    styles.shareIconContainer,
                    { backgroundColor: "#1877F2" },
                  ]}
                >
                  <Ionicons name="logo-facebook" size={24} color="white" />
                </View>
                <View style={styles.shareOptionInfo}>
                  <Text style={styles.shareOptionText}>Facebook</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareOption}
                onPress={() => handleShareTrip("instagram")}
              >
                <View
                  style={[
                    styles.shareIconContainer,
                    { backgroundColor: "#E4405F" },
                  ]}
                >
                  <Ionicons name="logo-instagram" size={24} color="white" />
                </View>
                <View style={styles.shareOptionInfo}>
                  <Text style={styles.shareOptionText}>Instagram</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.shareOption}
              onPress={() => handleShareTrip("export")}
            >
              <View
                style={[
                  styles.shareIconContainer,
                  { backgroundColor: theme.colors.gray },
                ]}
              >
                <Ionicons name="code-download" size={24} color="white" />
              </View>
              <View style={styles.shareOptionInfo}>
                <Text style={styles.shareOptionText}>Export Data</Text>
                <Text style={styles.shareOptionSubtext}>Copy as JSON</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={styles.shareCancelButton}
            onPress={() => setShowShareModal(false)}
          >
            <Text style={styles.shareCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderWeatherDay = (day: any, index: number) => {
    const date = new Date(weatherData.daily.time[index]);
    const maxTemp = Math.round(weatherData.daily.temperature_2m_max[index]);
    const minTemp = Math.round(weatherData.daily.temperature_2m_min[index]);
    const weatherCode = weatherData.daily.weathercode[index];
    const precipitation = weatherData.daily.precipitation_sum[index];
    const tempSymbol = useImperial ? "°F" : "°C";
    const precipUnit = useImperial ? "in" : "mm";

    return (
      <View key={index} style={styles.weatherDay}>
        <Text style={styles.weatherDate}>
          {date.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </Text>
        <Ionicons
          name={getWeatherIcon(weatherCode) as any}
          size={28}
          color={theme.colors.forest}
        />
        <Text style={styles.weatherTemp}>
          {maxTemp}
          {tempSymbol}/{minTemp}
          {tempSymbol}
        </Text>
        {precipitation > 0 && (
          <Text style={styles.weatherPrecip}>
            {precipitation.toFixed(1)}
            {precipUnit}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backArrow}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {trip.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowShareModal(true)}
          >
            <Ionicons
              name="share-social-outline"
              size={24}
              color={theme.colors.navy}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push(`/edit-trip?tripId=${trip.id}`)}
          >
            <Ionicons
              name="create-outline"
              size={24}
              color={theme.colors.navy}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === "list" && styles.toggleActive,
          ]}
          onPress={() => setViewMode("list")}
        >
          <Ionicons
            name="list"
            size={20}
            color={viewMode === "list" ? "white" : theme.colors.gray}
          />
          <Text
            style={[
              styles.toggleText,
              viewMode === "list" && styles.toggleTextActive,
            ]}
          >
            List
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === "map" && styles.toggleActive,
          ]}
          onPress={() => setViewMode("map")}
        >
          <Ionicons
            name="map"
            size={20}
            color={viewMode === "map" ? "white" : theme.colors.gray}
          />
          <Text
            style={[
              styles.toggleText,
              viewMode === "map" && styles.toggleTextActive,
            ]}
          >
            Map
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === "list" ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {trip.cover_photo ? (
            <View style={styles.coverPhotoContainer}>
              <View
                style={{
                  position: "absolute",
                  width: 900,
                  height: 900,
                  left: -300,
                  top: -350,
                  transform: [
                    { translateX: trip.cover_photo_position?.x || 0 },
                    { translateY: trip.cover_photo_position?.y || 0 },
                  ],
                }}
              >
                <Image
                  source={{ uri: trip.cover_photo }}
                  style={{
                    width: "100%",
                    height: "100%",
                    resizeMode: "contain",
                  }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.coverPhotoPlaceholder}>
              <Ionicons name="images-outline" size={48} color="#ccc" />
              <Text style={styles.placeholderText}>No cover photo yet</Text>
              {processedSpots.length > 0 &&
                processedSpots[0].photos?.length > 0 && (
                  <Text style={styles.placeholderHint}>
                    (Using first spot photo as cover)
                  </Text>
                )}
            </View>
          )}

          <View style={styles.tripInfo}>
            <View style={styles.dateContainer}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={theme.colors.gray}
              />
              <Text style={styles.dateText}>
                {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
              </Text>
            </View>

            {trip.auto_generated && (
              <View style={styles.autoBadge}>
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={styles.autoBadgeText}>Auto-generated trip</Text>
              </View>
            )}
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{tripActivities.length}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{processedSpots.length}</Text>
              <Text style={styles.statLabel}>Spots</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{getDaysCount()}</Text>
              <Text style={styles.statLabel}>Days</Text>
            </View>
          </View>

          {weatherData && (
            <View style={styles.weatherCard}>
              <View style={styles.weatherHeader}>
                <Ionicons
                  name="partly-sunny"
                  size={20}
                  color={theme.colors.forest}
                />
                <Text style={styles.weatherTitle}>Weather Forecast</Text>
              </View>
              {weatherData?.daily?.time ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.weatherDays}>
                    {weatherData.daily.time.map((_: any, index: number) =>
                      renderWeatherDay(weatherData.daily, index)
                    )}
                  </View>
                </ScrollView>
              ) : (
                <Text style={styles.weatherError}>
                  Weather data unavailable
                </Text>
              )}
            </View>
          )}
          {tripActivities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Activities ({tripActivities.length})
              </Text>
              {tripActivities.map((activity: any) => (
                <TouchableOpacity
                  key={activity.tripItemId}
                  style={styles.itemCard}
                  onPress={() => handleActivityPress(activity)}
                  activeOpacity={0.7}
                >
                  {/* Show activity photo if available */}
                  {activity.photos && activity.photos.length > 0 ? (
                    <Image
                      source={{ uri: activity.photos[0] }}
                      style={styles.spotImage}
                      onError={(e) => {
                        console.error(
                          "Activity image failed to load:",
                          activity.photos[0]
                        );
                      }}
                    />
                  ) : (
                    <View style={styles.itemIcon}>
                      <Ionicons
                        name="fitness"
                        size={24}
                        color={theme.colors.forest}
                      />
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>
                      {activity.name || "Unnamed Activity"}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {activity.displayDate
                        ? new Date(activity.displayDate).toLocaleDateString()
                        : "No date"}
                      {activity.distance
                        ? ` • ${(activity.distance / 1000).toFixed(1)} km`
                        : ""}
                      {activity.duration
                        ? ` • ${formatDuration(activity.duration)}`
                        : ""}
                    </Text>
                    {/* Show photo count for activities */}
                    {activity.photos && activity.photos.length > 1 && (
                      <Text style={styles.photoCount}>
                        📸 {activity.photos.length} photos
                      </Text>
                    )}
                  </View>
                  {trip.created_by === user?.id && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(
                          activity.tripItemId,
                          activity.name || "this activity"
                        );
                      }}
                      style={styles.removeButton}
                    >
                      <Ionicons name="close-circle" size={20} color="#999" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {processedSpots.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Spots ({processedSpots.length})
              </Text>
              {processedSpots.map((spot: any, index: number) => {
                return (
                  <TouchableOpacity
                    key={spot.tripItemId || `spot-${index}`}
                    style={styles.itemCard}
                    onPress={() => handleSpotPress(spot)}
                    activeOpacity={0.7}
                  >
                    {spot.photos && spot.photos.length > 0 ? (
                      <Image
                        source={{ uri: spot.photos[0] }}
                        style={styles.spotImage}
                        onError={(e) => {
                          console.error(
                            "Image failed to load:",
                            spot.photos[0]
                          );
                        }}
                      />
                    ) : (
                      <View style={styles.itemIcon}>
                        <Ionicons
                          name="location"
                          size={24}
                          color={theme.colors.burntOrange}
                        />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>
                        {spot.name || "Unnamed Spot"}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {spot.category || "No category"}
                        {spot.displayDate
                          ? ` • ${new Date(
                              spot.displayDate
                            ).toLocaleDateString()}`
                          : ""}
                      </Text>
                      {spot.description && (
                        <Text style={styles.itemDescription} numberOfLines={1}>
                          {spot.description}
                        </Text>
                      )}
                      {spot.photos && spot.photos.length > 1 && (
                        <Text style={styles.photoCount}>
                          📸 {spot.photos.length} photos
                        </Text>
                      )}
                    </View>
                    {trip.created_by === user?.id && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(
                            spot.tripItemId,
                            spot.name || "this spot"
                          );
                        }}
                        style={styles.removeButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#999" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {tripActivities.length === 0 && processedSpots.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="trail-sign-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                No activities or spots added yet
              </Text>
              <Text style={styles.emptySubtext}>
                Add activities and spots to build your trip memories
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.addItemsButton}
            onPress={() => {
              Alert.alert(
                "Add Items",
                "You can add items to this trip from the saved spots or activities screens using the + button."
              );
            }}
          >
            <Ionicons name="add-circle-outline" size={24} color="#fff" />
            <Text style={styles.addItemsText}>Add Activities & Spots</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={styles.mapContainer}>
          <WebView
            source={{
              html: generateTripMapHTML(tripActivities, processedSpots),
            }}
            style={styles.map}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: theme.colors.burntOrange },
                ]}
              />
              <Text style={styles.legendText}>Spots</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendLine,
                  { backgroundColor: theme.colors.forest },
                ]}
              />
              <Text style={styles.legendText}>Activities</Text>
            </View>
          </View>
        </View>
      )}

      <ShareModal />

      <ImageViewer
        visible={showImageViewer}
        images={currentSpotImages}
        imageIndex={selectedImageIndex}
        onClose={() => {
          setShowImageViewer(false);
          setCurrentSpotImages([]);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: theme.colors.gray,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  backArrow: {
    padding: 5,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
    textAlign: "center",
    marginHorizontal: 10,
  },
  editButton: {
    padding: 5,
  },
  viewToggle: {
    flexDirection: "row",
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: "#fff",
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  toggleActive: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  toggleText: {
    fontSize: 14,
    color: theme.colors.gray,
    fontWeight: "500",
    marginLeft: 6,
  },
  toggleTextActive: {
    color: "white",
  },
  content: {
    flex: 1,
  },
  coverPhotoPlaceholder: {
    width: "100%",
    height: 250,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  coverPhotoContainer: {
    width: "100%",
    height: 250,
    overflow: "hidden",
    backgroundColor: theme.colors.offWhite,
    position: "relative",
  },
  placeholderText: {
    marginTop: 10,
    color: "#999",
    fontSize: 14,
  },
  placeholderHint: {
    marginTop: 5,
    color: "#bbb",
    fontSize: 12,
    fontStyle: "italic",
  },
  tripInfo: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  dateText: {
    marginLeft: 10,
    fontSize: 16,
    color: theme.colors.gray,
  },
  autoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  autoBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 5,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
    backgroundColor: "#fff",
    marginTop: 10,
  },
  statCard: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 4,
  },
  weatherCard: {
    backgroundColor: "white",
    marginHorizontal: 0,
    marginVertical: 10,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weatherHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  weatherTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginLeft: 8,
  },
  weatherDays: {
    flexDirection: "row",
    gap: 15,
  },
  weatherDay: {
    alignItems: "center",
    padding: 10,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    minWidth: 80,
  },
  weatherDate: {
    fontSize: 11,
    color: theme.colors.gray,
    marginBottom: 8,
    textAlign: "center",
  },
  weatherTemp: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
    marginTop: 8,
  },
  weatherPrecip: {
    fontSize: 11,
    color: theme.colors.burntOrange,
    marginTop: 4,
  },
  section: {
    marginTop: 10,
    backgroundColor: "#fff",
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 15,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  spotImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
  },
  itemMeta: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  itemDescription: {
    fontSize: 11,
    color: theme.colors.lightGray,
    marginTop: 2,
    fontStyle: "italic",
  },
  removeButton: {
    padding: 5,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 10,
    textAlign: "center",
  },
  addItemsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.burntOrange,
    margin: 20,
    padding: 15,
    borderRadius: 10,
  },
  addItemsText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  mapLegend: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    gap: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendLine: {
    width: 20,
    height: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: theme.colors.gray,
    fontWeight: "500",
  },
  headerButton: {
    padding: 5,
    marginLeft: 10,
  },
  shareOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  shareMenu: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: "80%",
  },
  shareHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.borderGray,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  shareTitle: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 15,
    color: theme.colors.navy,
  },
  shareTripPreview: {
    backgroundColor: theme.colors.offWhite,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 15,
    borderRadius: 12,
  },
  sharePreviewTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 5,
  },
  sharePreviewStats: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  sharePreviewPhotos: {
    fontSize: 13,
    color: theme.colors.burntOrange,
    marginTop: 5,
  },
  shareOptions: {
    maxHeight: 400,
  },
  shareOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  shareIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  shareOptionInfo: {
    flex: 1,
  },
  shareOptionText: {
    fontSize: 16,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  shareOptionSubtext: {
    fontSize: 13,
    color: theme.colors.gray,
    marginTop: 2,
  },
  shareSocialSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    marginTop: 10,
    paddingTop: 10,
  },
  shareSectionTitle: {
    fontSize: 13,
    color: theme.colors.gray,
    fontWeight: "600",
    marginLeft: 20,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  shareCancelButton: {
    marginTop: 10,
    padding: 15,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  shareCancelText: {
    fontSize: 16,
    color: theme.colors.gray,
    fontWeight: "500",
  },
  weatherError: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
    padding: 20,
    fontStyle: "italic",
  },
  photoCount: {
    fontSize: 11,
    color: theme.colors.forest,
    fontStyle: "italic",
  },
});
