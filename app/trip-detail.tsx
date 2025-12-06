// app/trip-detail.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { theme } from "../constants/theme";
import { useSettings } from "../contexts/SettingsContext";
import { useTrips } from "../contexts/TripContext";
import { useFocusEffect } from "@react-navigation/native";
import { Modal, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import ViewShot from "react-native-view-shot";
import { TripShareService } from "../services/shareService";
import ImageViewer from "../components/ImageViewer";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TripMessage {
  id: string;
  trip_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user?: {
    username: string;
    avatar_url: string;
  };
}

const getWeatherForLocation = async (
  lat: number,
  lon: number,
  startDate: Date,
  endDate: Date,
  useImperial: boolean = false
) => {
  try {
    const now = new Date();
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];
    const tempUnit = useImperial ? "fahrenheit" : "celsius";
    const precipUnit = useImperial ? "inch" : "mm";

    // Determine if we need historical or forecast API
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    let url: string;

    if (end < yesterday) {
      // All dates in the past - use historical API
      url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&start_date=${startStr}&end_date=${endStr}&timezone=auto&temperature_unit=${tempUnit}&precipitation_unit=${precipUnit}`;
    } else if (start > now) {
      // All dates in the future - use forecast API (max 16 days)
      const maxEnd = new Date(now);
      maxEnd.setDate(maxEnd.getDate() + 16);
      const effectiveEndStr =
        end > maxEnd ? maxEnd.toISOString().split("T")[0] : endStr;
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&start_date=${startStr}&end_date=${effectiveEndStr}&timezone=auto&temperature_unit=${tempUnit}&precipitation_unit=${precipUnit}`;
    } else {
      // Trip spans past and future - just use forecast from today
      const todayStr = now.toISOString().split("T")[0];
      const maxEnd = new Date(now);
      maxEnd.setDate(maxEnd.getDate() + 16);
      const effectiveEndStr =
        end > maxEnd ? maxEnd.toISOString().split("T")[0] : endStr;
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&start_date=${todayStr}&end_date=${effectiveEndStr}&timezone=auto&temperature_unit=${tempUnit}&precipitation_unit=${precipUnit}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      console.log("Weather API returned status:", response.status);
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.log("Weather not available for this trip");
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

  const [activeTab, setActiveTab] = useState<"spots" | "photos" | "chat">(
    "spots"
  );
  const [showMap, setShowMap] = useState(false);
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
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showItemDetail, setShowItemDetail] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const chatListRef = useRef<FlatList>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});

  const trip = trips.find((t) => t.id === tripId);

  // Check if user can access chat (creator or tagged)
  const canAccessChat =
    trip &&
    user &&
    (trip.created_by === user.id || trip.tagged_friends?.includes(user.id));

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

  // Collect all photos from spots and activities
  const allPhotos = [
    ...processedSpots.flatMap((spot) =>
      (spot.photos || []).map((photo: string) => ({
        uri: photo,
        source: spot.name || "Spot",
        type: "spot",
      }))
    ),
    ...tripActivities.flatMap((activity) =>
      (activity.photos || []).map((photo: string) => ({
        uri: photo,
        source: activity.name || "Activity",
        type: "activity",
      }))
    ),
  ];

  const [processedActivities, setProcessedActivities] = useState<any[]>([]);

  // Load chat messages
  useEffect(() => {
    if (trip && canAccessChat && activeTab === "chat") {
      loadMessages();
      subscribeToMessages();
    }
  }, [trip?.id, canAccessChat, activeTab]);

  const loadMessages = async () => {
    if (!tripId) return;

    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("trip_messages")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMessages(data || []);

      // Load user profiles for messages
      const userIds = [...new Set((data || []).map((m) => m.user_id))];
      await loadUserProfiles(userIds);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadUserProfiles = async (userIds: string[]) => {
    if (userIds.length === 0) return;

    const missingIds = userIds.filter((id) => !userProfiles[id]);
    if (missingIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", missingIds);

      if (error) throw error;

      const newProfiles: Record<string, any> = {};
      (data || []).forEach((profile) => {
        newProfiles[profile.id] = profile;
      });

      setUserProfiles((prev) => ({ ...prev, ...newProfiles }));
    } catch (error) {
      console.error("Error loading profiles:", error);
    }
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel(`trip_messages_${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trip_messages",
          filter: `trip_id=eq.${tripId}`,
        },
        async (payload) => {
          const newMsg = payload.new as TripMessage;
          setMessages((prev) => [...prev, newMsg]);

          // Load profile if needed
          if (!userProfiles[newMsg.user_id]) {
            await loadUserProfiles([newMsg.user_id]);
          }

          // Scroll to bottom
          setTimeout(() => {
            chatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !tripId || sendingMessage) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase.from("trip_messages").insert({
        trip_id: tripId,
        user_id: user.id,
        message: newMessage.trim(),
      });

      if (error) throw error;
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  // Process activity photos
  useEffect(() => {
    const processActivityPhotos = async () => {
      if (!trip || tripActivities.length === 0) {
        setProcessedActivities([]);
        return;
      }

      const updatedActivities = [];

      for (const activity of tripActivities) {
        let finalActivity = { ...activity };

        if (activity.photos && activity.photos.length > 0) {
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

        if (spot.photos && spot.photos.length > 0) {
          const hasLocalPhotos = spot.photos.some((p: string) =>
            p.startsWith("file://")
          );

          if (hasLocalPhotos && spot.id) {
            const { data, error } = await supabase
              .from("locations")
              .select("photos")
              .eq("id", spot.id)
              .single();

            if (data?.photos) {
              finalSpot.photos = data.photos;
            } else {
              finalSpot.photos = spot.photos.filter(
                (p: string) =>
                  p.startsWith("http://") || p.startsWith("https://")
              );
            }
          } else {
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
    if (trip.created_by === user?.id && activity.id) {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(activity.id)) {
        router.push(`/activity/${activity.id}`);
        return;
      }
    }
    setSelectedItem({ ...activity, itemType: "activity" });
    setShowItemDetail(true);
  };

  const handleSpotPress = (spot: any) => {
    if (trip.created_by === user?.id && spot.id) {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(spot.id)) {
        router.push(`/location/${spot.id}`);
        return;
      }
    }
    setSelectedItem({ ...spot, itemType: "spot" });
    setShowItemDetail(true);
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

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  // Tab content renderers
  const renderSpotsTab = () => (
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

      {/* Weather Card */}
      {weatherData && weatherData.daily?.time && (
        <View style={styles.weatherCard}>
          <View style={styles.weatherHeader}>
            <Ionicons
              name="partly-sunny"
              size={20}
              color={theme.colors.forest}
            />
            <Text style={styles.weatherTitle}>
              {new Date(trip.end_date) < new Date()
                ? "Weather History"
                : "Weather Forecast"}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.weatherDays}>
              {weatherData.daily.time.map((_: any, index: number) => {
                const date = new Date(weatherData.daily.time[index]);
                const maxTemp = Math.round(
                  weatherData.daily.temperature_2m_max[index]
                );
                const minTemp = Math.round(
                  weatherData.daily.temperature_2m_min[index]
                );
                const weatherCode = weatherData.daily.weathercode[index];
                const precipitation =
                  weatherData.daily.precipitation_sum[index];
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
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Map Toggle */}

      {/* Map Toggle */}
      <TouchableOpacity
        style={styles.mapToggleButton}
        onPress={() => setShowMap(!showMap)}
      >
        <Ionicons
          name={showMap ? "list" : "map"}
          size={20}
          color={theme.colors.forest}
        />
        <Text style={styles.mapToggleText}>
          {showMap ? "Show List" : "Show Map"}
        </Text>
      </TouchableOpacity>

      {showMap ? (
        <View style={styles.inlineMapContainer}>
          <WebView
            source={{
              html: generateTripMapHTML(tripActivities, processedSpots),
            }}
            style={styles.inlineMap}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>
      ) : (
        <>
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
                  {activity.photos && activity.photos.length > 0 ? (
                    <Image
                      source={{ uri: activity.photos[0] }}
                      style={styles.spotImage}
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
              {processedSpots.map((spot: any, index: number) => (
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
              ))}
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

          <View style={styles.addItemsHint}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.gray} />
            <Text style={styles.addItemsHintText}>
              To add items to this trip, go to your saved spots or activities and tap the{" "}
              <Ionicons name="airplane" size={13} color={theme.colors.gray} /> button
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderPhotosTab = () => (
    <View style={styles.photosContainer}>
      {allPhotos.length > 0 ? (
        <FlatList
          data={allPhotos}
          numColumns={3}
          keyExtractor={(item, index) => `photo-${index}`}
          contentContainerStyle={styles.photosGrid}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.photoThumbnailContainer}
              onPress={() => {
                setCurrentSpotImages(allPhotos.map((p) => p.uri));
                setSelectedImageIndex(index);
                setShowImageViewer(true);
              }}
            >
              <Image
                source={{ uri: item.uri }}
                style={styles.photoThumbnail}
                resizeMode="cover"
              />
              <View style={styles.photoSourceBadge}>
                <Ionicons
                  name={item.type === "spot" ? "location" : "fitness"}
                  size={10}
                  color="white"
                />
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.emptyPhotos}>
          <Ionicons name="images-outline" size={64} color="#ccc" />
          <Text style={styles.emptyPhotosText}>No photos yet</Text>
          <Text style={styles.emptyPhotosSubtext}>
            Photos from your spots and activities will appear here
          </Text>
        </View>
      )}
    </View>
  );

  const renderChatTab = () => {
    if (!canAccessChat) {
      return (
        <View style={styles.chatLocked}>
          <Ionicons name="lock-closed" size={64} color="#ccc" />
          <Text style={styles.chatLockedTitle}>Chat Unavailable</Text>
          <Text style={styles.chatLockedText}>
            Only the trip creator and tagged friends can access the chat.
          </Text>
        </View>
      );
    }

    return (
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 120 : 0}
      >
        <FlatList
          ref={chatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            chatListRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <View style={styles.emptyChatContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
              <Text style={styles.emptyChatText}>No messages yet</Text>
              <Text style={styles.emptyChatSubtext}>
                Start planning your trip with friends!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isOwnMessage = item.user_id === user?.id;
            const profile = userProfiles[item.user_id];

            return (
              <View
                style={[
                  styles.messageRow,
                  isOwnMessage ? styles.messageRowOwn : styles.messageRowOther,
                ]}
              >
                {!isOwnMessage && (
                  <View style={styles.messageAvatar}>
                    {profile?.avatar_url ? (
                      <Image
                        source={{ uri: profile.avatar_url }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitial}>
                          {profile?.username?.[0]?.toUpperCase() || "?"}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    isOwnMessage
                      ? styles.messageBubbleOwn
                      : styles.messageBubbleOther,
                  ]}
                >
                  {!isOwnMessage && (
                    <Text style={styles.messageUsername}>
                      {profile?.username || "Unknown"}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.messageText,
                      isOwnMessage
                        ? styles.messageTextOwn
                        : styles.messageTextOther,
                    ]}
                  >
                    {item.message}
                  </Text>
                  <Text
                    style={[
                      styles.messageTime,
                      isOwnMessage
                        ? styles.messageTimeOwn
                        : styles.messageTimeOther,
                    ]}
                  >
                    {formatMessageTime(item.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.chatInputContainer}>
          <TextInput
            style={styles.chatInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.gray}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sendingMessage) &&
                styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sendingMessage}
          >
            <Ionicons
              name="send"
              size={20}
              color={newMessage.trim() && !sendingMessage ? "white" : "#ccc"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
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
            {allPhotos.length > 0 && (
              <Text style={styles.sharePreviewPhotos}>
                📸 {allPhotos.length} photos
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

  const ItemDetailModal = () => {
    if (!selectedItem) return null;

    const isActivity = selectedItem.itemType === "activity";
    const photos = selectedItem.photos || [];

    return (
      <Modal
        visible={showItemDetail}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowItemDetail(false)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalContent}>
            <View style={styles.detailModalHeader}>
              <Text style={styles.detailModalTitle} numberOfLines={2}>
                {selectedItem.name || (isActivity ? "Activity" : "Spot")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowItemDetail(false)}
                style={styles.detailModalClose}
              >
                <Ionicons name="close" size={24} color={theme.colors.gray} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.detailModalScroll}
              showsVerticalScrollIndicator={false}
            >
              {photos.length > 0 && (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={styles.detailPhotoScroll}
                >
                  {photos.map((photo: string, index: number) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        setCurrentSpotImages(photos);
                        setSelectedImageIndex(index);
                        setShowImageViewer(true);
                      }}
                    >
                      <Image
                        source={{ uri: photo }}
                        style={styles.detailPhoto}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {photos.length > 1 && (
                <Text style={styles.photoHint}>
                  Swipe for more photos • Tap to enlarge
                </Text>
              )}

              <View style={styles.detailSection}>
                <View style={styles.detailRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={theme.colors.gray}
                  />
                  <Text style={styles.detailText}>
                    {selectedItem.displayDate
                      ? new Date(selectedItem.displayDate).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )
                      : "No date"}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons
                    name={isActivity ? "fitness" : "pricetag-outline"}
                    size={20}
                    color={theme.colors.gray}
                  />
                  <Text style={styles.detailText}>
                    {isActivity
                      ? selectedItem.type || "Activity"
                      : selectedItem.category || "Uncategorized"}
                  </Text>
                </View>

                {isActivity && selectedItem.distance && (
                  <View style={styles.detailRow}>
                    <Ionicons
                      name="speedometer-outline"
                      size={20}
                      color={theme.colors.gray}
                    />
                    <Text style={styles.detailText}>
                      {(selectedItem.distance / 1000).toFixed(2)} km
                      {selectedItem.duration &&
                        ` • ${formatDuration(selectedItem.duration)}`}
                    </Text>
                  </View>
                )}

                {!isActivity && selectedItem.rating && (
                  <View style={styles.detailRow}>
                    <Ionicons
                      name="star"
                      size={20}
                      color={theme.colors.burntOrange}
                    />
                    <Text style={styles.detailText}>
                      {selectedItem.rating} / 5
                    </Text>
                  </View>
                )}

                {(selectedItem.description || selectedItem.notes) && (
                  <View style={styles.detailDescriptionContainer}>
                    <Text style={styles.detailLabel}>Notes</Text>
                    <Text style={styles.detailDescription}>
                      {selectedItem.description || selectedItem.notes}
                    </Text>
                  </View>
                )}

                {selectedItem.location && (
                  <View style={styles.detailRow}>
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color={theme.colors.gray}
                    />
                    <Text style={styles.detailText} numberOfLines={2}>
                      {selectedItem.location.latitude.toFixed(5)},{" "}
                      {selectedItem.location.longitude.toFixed(5)}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "spots" && styles.tabActive]}
          onPress={() => setActiveTab("spots")}
        >
          <Ionicons
            name="location"
            size={20}
            color={
              activeTab === "spots" ? theme.colors.forest : theme.colors.gray
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "spots" && styles.tabTextActive,
            ]}
          >
            Spots
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "photos" && styles.tabActive]}
          onPress={() => setActiveTab("photos")}
        >
          <Ionicons
            name="images"
            size={20}
            color={
              activeTab === "photos" ? theme.colors.forest : theme.colors.gray
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "photos" && styles.tabTextActive,
            ]}
          >
            Photos
          </Text>
          {allPhotos.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{allPhotos.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "chat" && styles.tabActive]}
          onPress={() => setActiveTab("chat")}
        >
          <Ionicons
            name="chatbubbles"
            size={20}
            color={
              activeTab === "chat" ? theme.colors.forest : theme.colors.gray
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "chat" && styles.tabTextActive,
            ]}
          >
            Chat
          </Text>
          {!canAccessChat && (
            <Ionicons
              name="lock-closed"
              size={12}
              color={theme.colors.gray}
              style={{ marginLeft: 4 }}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === "spots" && renderSpotsTab()}
      {activeTab === "photos" && renderPhotosTab()}
      {activeTab === "chat" && renderChatTab()}

      <ItemDetailModal />
      <ShareModal />

      <ImageViewer
        visible={showImageViewer}
        images={currentSpotImages}
        initialIndex={selectedImageIndex}
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
  headerButton: {
    padding: 5,
    marginLeft: 10,
  },

  // Tab Bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.forest,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.gray,
  },
  tabTextActive: {
    color: theme.colors.forest,
  },
  tabBadge: {
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  tabBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },

  // Spots Tab
  content: {
    flex: 1,
  },
  coverPhotoPlaceholder: {
    width: "100%",
    height: 200,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  coverPhotoContainer: {
    width: "100%",
    height: 200,
    overflow: "hidden",
    backgroundColor: theme.colors.offWhite,
    position: "relative",
  },
  placeholderText: {
    marginTop: 10,
    color: "#999",
    fontSize: 14,
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
  mapToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    margin: 15,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.forest,
    gap: 8,
  },
  mapToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.forest,
  },
  inlineMapContainer: {
    height: 300,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    overflow: "hidden",
  },
  inlineMap: {
    flex: 1,
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
  photoCount: {
    fontSize: 11,
    color: theme.colors.forest,
    fontStyle: "italic",
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

  // Photos Tab
  photosContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  photosGrid: {
    padding: 2,
  },
  photoThumbnailContainer: {
    width: (SCREEN_WIDTH - 8) / 3,
    height: (SCREEN_WIDTH - 8) / 3,
    padding: 2,
    position: "relative",
  },
  photoThumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
  },
  photoSourceBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    padding: 4,
  },
  emptyPhotos: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyPhotosText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#999",
    marginTop: 20,
  },
  emptyPhotosSubtext: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 10,
    textAlign: "center",
  },

  // Chat Tab
  chatContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  messagesList: {
    padding: 15,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
  },
  messageRowOwn: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  messageAvatar: {
    marginRight: 8,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 18,
  },
  messageBubbleOwn: {
    backgroundColor: theme.colors.forest,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: theme.colors.offWhite,
    borderBottomLeftRadius: 4,
  },
  messageUsername: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.forest,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: "white",
  },
  messageTextOther: {
    color: theme.colors.navy,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  messageTimeOwn: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "right",
  },
  messageTimeOther: {
    color: theme.colors.gray,
  },
  emptyChatContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyChatText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#999",
    marginTop: 20,
  },
  emptyChatSubtext: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 10,
  },
  chatInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  chatInput: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: theme.colors.navy,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.forest,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.borderGray,
  },
  chatLocked: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  chatLockedTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#999",
    marginTop: 20,
  },
  chatLockedText: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 10,
    textAlign: "center",
  },

  // Share Modal
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

  // Item Detail Modal
  detailModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  detailModalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  detailModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  detailModalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
    flex: 1,
    marginRight: 10,
  },
  detailModalClose: {
    padding: 5,
  },
  detailModalScroll: {
    maxHeight: 500,
  },
  detailPhotoScroll: {
    height: 250,
  },
  detailPhoto: {
    width: SCREEN_WIDTH,
    height: 250,
  },
  photoHint: {
    textAlign: "center",
    fontSize: 12,
    color: theme.colors.gray,
    paddingVertical: 8,
  },
  detailSection: {
    padding: 20,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  detailText: {
    fontSize: 16,
    color: theme.colors.navy,
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
    marginBottom: 8,
  },
  detailDescriptionContainer: {
    marginTop: 10,
    marginBottom: 15,
    padding: 15,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 10,
  },
  detailDescription: {
    fontSize: 15,
    color: theme.colors.navy,
    lineHeight: 22,
  },
  weatherCard: {
    backgroundColor: "white",
    marginHorizontal: 15,
    marginVertical: 10,
    padding: 15,
    borderRadius: 12,
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
  addItemsHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    paddingBottom: 30,
    gap: 8,
  },
  addItemsHintText: {
    color: theme.colors.gray,
    textAlign: "center",
    flex: 1,
  },
});
