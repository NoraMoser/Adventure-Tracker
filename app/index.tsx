import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  AppState,
  Modal,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { ExplorableIcon, ExplorableLogo } from "../components/Logo";
import { categories } from "../constants/categories";
import { theme } from "../constants/theme";
import { useActivity } from "../contexts/ActivityContext";
import { useAuth } from "../contexts/AuthContext";
import { useFriends } from "../contexts/FriendsContext";
import { useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext";
import { supabase } from "../lib/supabase";
import { MemoryNotificationService } from "../services/memoryNotificationService";
import { useWishlist } from "../contexts/WishlistContext";
import { useTrips } from "../contexts/TripContext";
import { useJournal } from "../contexts/JournalContext";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { UserAvatar } from "../components/UserAvatar";

const { width, height } = Dimensions.get("window");
const BOTTOM_SHEET_MAX_HEIGHT = height * 0.5;
const BOTTOM_SHEET_MIN_HEIGHT = 80;

// Get time-based greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

export default function DashboardScreen() {
  const router = useRouter();

  // Get the full auth context object to avoid stale closures
  const authContext = useAuth();

  // Now extract the values
  const user = authContext.user;
  const profile = authContext.profile;
  const session = authContext.session;
  const isOfflineMode = authContext.isOfflineMode;
  const authLoading = authContext.loading;
  const refreshProfile = authContext.refreshProfile;

  const { savedSpots, location, getLocation } = useLocation();
  const { activities } = useActivity();
  const { formatDistance, formatSpeed, settings, getMapTileUrl } =
    useSettings();
  const { friendRequests } = useFriends();
  const webViewRef = useRef<WebView>(null);

  // State
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const { wishlistItems } = useWishlist();
  const { trips, triggerAutoDetection, showPendingClusters } = useTrips();
  const { entries: journalEntries } = useJournal();
  const [reviewingTrips, setReviewingTrips] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [activeTab, setActiveTab] = useState<"recent" | "friends">("recent");

  // Force re-render when auth state changes
  const [authVersion, setAuthVersion] = useState(0);
  useEffect(() => {
    setAuthVersion((v) => v + 1);
  }, [user?.id, session?.user?.id]);

  // Sidebar animation
  const sidebarAnimation = useRef(new Animated.Value(-width * 0.75)).current;

  const toggleSidebar = (show: boolean) => {
    Animated.timing(sidebarAnimation, {
      toValue: show ? 0 : -width * 0.75,
      duration: 250,
      useNativeDriver: true,
    }).start();
    setShowSidebar(show);
  };

  // Bottom sheet animation
  const animatedValue = useRef(
    new Animated.Value(BOTTOM_SHEET_MIN_HEIGHT)
  ).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        animatedValue.extractOffset();
      },
      onPanResponderMove: (e, gesture) => {
        animatedValue.setValue(-gesture.dy);
      },
      onPanResponderRelease: (e, gesture) => {
        animatedValue.flattenOffset();
        if (gesture.dy < -50) {
          springAnimation(BOTTOM_SHEET_MAX_HEIGHT);
        } else if (gesture.dy > 50) {
          springAnimation(BOTTOM_SHEET_MIN_HEIGHT);
        } else {
          springAnimation(BOTTOM_SHEET_MIN_HEIGHT);
        }
      },
    })
  ).current;

  const springAnimation = (toValue: number) => {
    Animated.spring(animatedValue, {
      toValue,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Wait for auth to be ready
        if (authLoading) {
          return;
        }

        // Mark that we've checked auth
        if (!hasCheckedAuth) {
          setHasCheckedAuth(true);
        }

        // Get current auth state
        const currentUser = authContext.user;
        const currentSession = authContext.session;
        const hasAuth = !!(currentUser?.id || currentSession?.user?.id);

        // Only check onboarding if user is authenticated
        if (hasAuth) {
          const onboardingComplete = await AsyncStorage.getItem(
            "onboardingComplete"
          );

          if (onboardingComplete !== "true") {
            // Use dismissAll to prevent shaking
            setTimeout(() => {
              router.dismissAll();
              router.replace("/onboarding");
            }, 200);
            return;
          }
          triggerAutoDetection();
        }
        setIsInitializing(false);

        // Get location if available
        if (!location) {
          getLocation();
        }
      } catch (error) {
        console.error("Dashboard: Error initializing:", error);
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, [
    authLoading,
    hasCheckedAuth,
    authContext.user?.id,
    authContext.session?.user?.id,
    isOfflineMode,
    location,
    getLocation,
    router,
    authContext.session,
    authContext.user,
  ]);

  // Request permissions on first launch (after initialization)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const requestInitialPermissions = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const locationResult =
          await Location.requestForegroundPermissionsAsync();
        const notificationResult = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowDisplayInCarPlay: false,
            allowCriticalAlerts: false,
            provideAppNotificationSettings: false,
            allowProvisional: false,
          },
        });

        if (locationResult.status === "denied") {
          setTimeout(() => {
            Alert.alert(
              "Location Access",
              "Location access is needed to track activities. You can enable it in Settings.",
              [
                { text: "Not Now", style: "cancel" },
                {
                  text: "Open Settings",
                  onPress: () => Linking.openSettings(),
                },
              ]
            );
          }, 500);
        }
      } catch (error) {
        console.error("Error requesting permissions:", error);
      }
    };

    const shouldRequest =
      !isInitializing && !authLoading && (user?.id || isOfflineMode);

    if (shouldRequest) {
      timeoutId = setTimeout(() => {
        requestInitialPermissions();
      }, 500);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user?.id, isInitializing, authLoading, isOfflineMode]);

  useEffect(() => {
    const fetchNotificationCount = async () => {
      if (!user) return;

      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false);

        if (!error && count !== null) {
          setUnreadNotificationCount(count);
        }
      } catch (err) {
        console.error("Error fetching notification count:", err);
      }
    };

    if (user) {
      MemoryNotificationService.initialize(user.id);
      MemoryNotificationService.initializeForegroundChecks(user.id);

      fetchNotificationCount();

      const subscription = supabase
        .channel("notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotificationCount();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotificationCount();
          }
        )
        .subscribe();

      const appStateSubscription = AppState.addEventListener(
        "change",
        (nextAppState) => {
          if (nextAppState === "active") {
            MemoryNotificationService.initializeForegroundChecks(user.id);
          } else if (nextAppState === "background") {
            MemoryNotificationService.stopForegroundChecks();
          }
        }
      );

      return () => {
        subscription.unsubscribe();
        appStateSubscription.remove();
        MemoryNotificationService.stopForegroundChecks();
      };
    }
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      const fetchNotificationCount = async () => {
        if (!user) return;

        try {
          const { count, error } = await supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("read", false);

          if (!error && count !== null) {
            setUnreadNotificationCount(count);
          }
        } catch (err) {
          console.error("Error fetching notification count:", err);
        }
      };

      if (user) {
        fetchNotificationCount();
      }
    }, [user])
  );

  // Profile Edit Modal Component
  const ProfileEditModal = () => {
    const [localDisplayName, setLocalDisplayName] = useState(
      profile?.display_name || profile?.username || ""
    );
    const [localUsername, setLocalUsername] = useState(profile?.username || "");
    const [saving, setSaving] = useState(false);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState("");

    const checkUsernameAvailability = async (username: string) => {
      if (!username || username === profile?.username) {
        setUsernameError("");
        return true;
      }

      setCheckingUsername(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username.toLowerCase())
          .single();

        if (data) {
          setUsernameError("Username already taken");
          setCheckingUsername(false);
          return false;
        }

        setUsernameError("");
        setCheckingUsername(false);
        return true;
      } catch (err) {
        setUsernameError("");
        setCheckingUsername(false);
        return true;
      }
    };

    const handleUsernameChange = (text: string) => {
      const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, "");
      setLocalUsername(cleaned);

      if (usernameError) {
        setUsernameError("");
      }
    };

    const handleSave = async () => {
      if (!user || !localDisplayName.trim() || !localUsername.trim()) {
        Alert.alert("Error", "Display name and username are required");
        return;
      }

      if (localUsername !== profile?.username) {
        const isAvailable = await checkUsernameAvailability(localUsername);
        if (!isAvailable) {
          Alert.alert("Error", "Username is already taken");
          return;
        }
      }

      setSaving(true);
      try {
        const updates: any = {
          display_name: localDisplayName.trim(),
          updated_at: new Date().toISOString(),
        };

        if (localUsername !== profile?.username) {
          updates.username = localUsername.toLowerCase();
        }

        const { error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", user.id);

        if (error) throw error;

        await refreshProfile();
        Alert.alert("Success", "Profile updated successfully!");
        setShowProfileEdit(false);
      } catch (error: any) {
        console.error("Error updating profile:", error);
        if (error.code === "23505") {
          Alert.alert("Error", "Username is already taken");
        } else {
          Alert.alert("Error", "Failed to update profile");
        }
      } finally {
        setSaving(false);
      }
    };

    return (
      <Modal
        visible={showProfileEdit}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileEdit(false)}
      >
        <View style={profileEditStyles.overlay}>
          <View style={profileEditStyles.content}>
            <View style={profileEditStyles.header}>
              <Text style={profileEditStyles.title}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowProfileEdit(false)}>
                <Ionicons name="close" size={24} color={theme.colors.gray} />
              </TouchableOpacity>
            </View>

            <View style={profileEditStyles.form}>
              <Text style={profileEditStyles.label}>Display Name</Text>
              <TextInput
                style={profileEditStyles.input}
                value={localDisplayName}
                onChangeText={setLocalDisplayName}
                placeholder="Enter your display name"
                placeholderTextColor={theme.colors.lightGray}
                autoFocus
                maxLength={50}
              />
              <Text style={profileEditStyles.hint}>
                This is how your name appears to friends
              </Text>

              <Text style={profileEditStyles.label}>Username</Text>
              <View style={profileEditStyles.usernameContainer}>
                <Text style={profileEditStyles.usernamePrefix}>@</Text>
                <TextInput
                  style={[
                    profileEditStyles.usernameInput,
                    usernameError && profileEditStyles.inputError,
                  ]}
                  value={localUsername}
                  onChangeText={handleUsernameChange}
                  onBlur={() => checkUsernameAvailability(localUsername)}
                  placeholder="username"
                  placeholderTextColor={theme.colors.lightGray}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                />
                {checkingUsername && (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.forest}
                    style={profileEditStyles.usernameSpinner}
                  />
                )}
              </View>
              {usernameError ? (
                <Text style={profileEditStyles.errorText}>{usernameError}</Text>
              ) : (
                <Text style={profileEditStyles.hint}>
                  Unique identifier for your profile (letters, numbers,
                  underscore only)
                </Text>
              )}

              <View style={profileEditStyles.currentInfo}>
                <Text style={profileEditStyles.infoLabel}>Email:</Text>
                <Text style={profileEditStyles.infoValue}>{user?.email}</Text>
              </View>
            </View>

            <View style={profileEditStyles.actions}>
              <TouchableOpacity
                style={profileEditStyles.cancelBtn}
                onPress={() => setShowProfileEdit(false)}
              >
                <Text style={profileEditStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  profileEditStyles.saveBtn,
                  saving && profileEditStyles.saveBtnDisabled,
                ]}
                onPress={handleSave}
                disabled={saving || !localDisplayName.trim()}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text style={profileEditStyles.saveText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Show loading screen while initializing or auth is loading
  if (isInitializing || authLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ExplorableIcon size={80} />
        <ActivityIndicator
          size="large"
          color={theme.colors.forest}
          style={{ marginTop: 20 }}
        />
        <Text style={styles.loadingText}>Loading your adventures...</Text>
      </SafeAreaView>
    );
  }

  // Check if user is authenticated (check both user and session)
  const isAuthenticated = !!(user?.id || session?.user?.id);

  // If not authenticated and not in offline mode, show sign in prompt
  if (!isAuthenticated && !isOfflineMode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authPromptContainer}>
          <ExplorableIcon size={80} />
          <Text style={styles.authPromptTitle}>Welcome to ExplorAble</Text>
          <Text style={styles.authPromptText}>
            Track your adventures, save your favorite spots, and share with
            friends
          </Text>
          <TouchableOpacity
            style={styles.authPromptButton}
            onPress={() => router.push("/auth/login")}
          >
            <Text style={styles.authPromptButtonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.authPromptLinkButton}
            onPress={() => {
              AsyncStorage.setItem("offlineMode", "true").then(() => {
                router.replace("/");
              });
            }}
          >
            <Text style={styles.authPromptLinkText}>Continue Offline</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate stats
  const stats = {
    totalDistance: activities.reduce((sum, act) => sum + act.distance, 0),
    totalDuration: activities.reduce((sum, act) => sum + act.duration, 0),
    totalActivities: activities.length,
    totalLocations: savedSpots.length,
    thisWeekActivities: activities.filter((act) => {
      const actDate = new Date(act.startTime);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return actDate > weekAgo;
    }).length,
    thisWeekSpots: savedSpots.filter((spot) => {
      const spotDate = new Date(spot.timestamp);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return spotDate > weekAgo;
    }).length,
    uniqueCategories: new Set(savedSpots.map((s) => s.category)).size,
  };

  const getHeroPhoto = () => {
    // Collect all items with photos and their dates
    const allPhotos: { uri: string; name: string; date: Date }[] = [];

    // Add spots with photos
    savedSpots
      .filter((s) => s.photos && s.photos.length > 0)
      .forEach((s) => {
        allPhotos.push({
          uri: s.photos[0],
          name: s.name,
          date: new Date(s.timestamp),
        });
      });

    // Add activities with photos
    activities
      .filter(
        (a) =>
          a.photos && a.photos.length > 0 && !a.photos[0].startsWith("file://")
      )
      .forEach((a) => {
        allPhotos.push({
          uri: a.photos[0],
          name: a.name || `${a.type} activity`,
          date: new Date(a.createdAt),
        });
      });

    // Add trips with cover photos
    trips
      .filter((t) => t.cover_photo)
      .forEach((t) => {
        allPhotos.push({
          uri: t.cover_photo,
          name: t.name,
          date: new Date(t.created_at),
        });
      });

    // Sort by date (most recent first) and return the newest
    if (allPhotos.length > 0) {
      allPhotos.sort((a, b) => b.date.getTime() - a.date.getTime());
      return allPhotos[0];
    }

    return null;
  };

  const heroPhoto = getHeroPhoto();

  const generateMapHTML = () => {
    const centerLat = location?.latitude || 47.6062;
    const centerLng = location?.longitude || -122.3321;

    let tileUrl = "";
    let attribution = "";
    let maxZoom = 19;

    switch (settings.mapStyle) {
      case "satellite":
        tileUrl =
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
        attribution = "© Esri, Maxar, Earthstar Geographics";
        maxZoom = 18;
        break;
      case "terrain":
        tileUrl = "https://a.tile.opentopomap.org/{z}/{x}/{y}.png";
        attribution = "© OpenTopoMap contributors";
        maxZoom = 17;
        break;
      case "standard":
      default:
        tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
        attribution = "© OpenStreetMap contributors";
        maxZoom = 19;
        break;
    }

    const spotMarkers = savedSpots
      .map((spot) => {
        const category = categories[spot.category] || categories.other;
        const escapedName = spot.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
        return `
          L.circleMarker([${spot.location.latitude}, ${
          spot.location.longitude
        }], {
            radius: 8,
            fillColor: '${category.mapColor || category.color}',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          })
          .addTo(adventureLayer)
          .bindPopup("<div style='text-align: center;'><b style='color: ${
            category.color
          }'>${escapedName}</b><br><small>${category.label}</small></div>");
        `;
      })
      .join("\n");

    const activityRoutes = activities
      .filter((act) => act.route && act.route.length > 0)
      .map((act) => {
        const coords = act.route
          .map((p) => `[${p.latitude}, ${p.longitude}]`)
          .join(",");
        return `
          L.polyline([${coords}], {
            color: '${theme.colors.forest}',
            weight: 3,
            opacity: 0.6
          }).addTo(adventureLayer);
        `;
      })
      .join("\n");

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
          .leaflet-container { background: #e0e0e0; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          try {
            var map = L.map('map', {
              center: [${centerLat}, ${centerLng}],
              zoom: 12,
              zoomControl: true,
              attributionControl: true,
              preferCanvas: true
            });
            
            L.tileLayer('${tileUrl}', {
              attribution: '${attribution}',
              maxZoom: ${maxZoom},
              crossOrigin: false
            }).addTo(map);
            
            var adventureLayer = L.layerGroup().addTo(map);
            
            ${spotMarkers}
            ${activityRoutes}
            
            ${
              location
                ? `
              L.circleMarker([${location.latitude}, ${location.longitude}], {
                radius: 10,
                fillColor: '${theme.colors.burntOrange}',
                color: '#fff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.8
              })
              .addTo(map)
              .bindPopup('You are here');
            `
                : ""
            }
            
            var allLayers = [];
            adventureLayer.eachLayer(function(layer) {
              allLayers.push(layer);
            });
            
            ${
              location
                ? `
              var currentMarker = L.circleMarker([${location.latitude}, ${location.longitude}]);
              allLayers.push(currentMarker);
            `
                : ""
            }
            
            if (allLayers.length > 0) {
              var group = new L.featureGroup(allLayers);
              map.fitBounds(group.getBounds().pad(0.15), {
                maxZoom: 14,
                animate: false
              });
            } else if (${location ? "true" : "false"}) {
              map.setView([${location?.latitude || centerLat}, ${
      location?.longitude || centerLng
    }], 13);
            }
          } catch (error) {
            console.error('Map initialization error:', error);
            document.getElementById('map').innerHTML = '<div style="padding: 20px; text-align: center;">Map loading error. Please refresh.</div>';
          }
        </script>
      </body>
      </html>
    `;
  };

  const sidebarItems = [
    { icon: "map", label: "Dashboard", route: "/", active: true },
    { icon: "person-circle", label: "Edit Profile", route: "/profile-edit" },
    {
      icon: "notifications",
      label: "Notifications",
      route: "/notifications",
      badge: unreadNotificationCount,
    },
    { icon: "location", label: "Saved Spots", route: "/saved-spots" },
    { icon: "fitness", label: "Activities", route: "/past-activities" },
    { icon: "book", label: "Journal Entries", route: "/journal" },
    { icon: "airplane", label: "My Trips", route: "/trips" },
    {
      icon: "people",
      label: "Friends Feed",
      route: "/friends-feed",
      badge: friendRequests.length,
    },
    { icon: "heart", label: "Wishlist", route: "/wishlist" },
    { divider: true },
    { icon: "settings", label: "Settings", route: "/settings" },
  ];

  const activityIcons: Record<string, string> = {
    bike: "bicycle",
    run: "walk",
    walk: "footsteps",
    hike: "trail-sign",
    paddleboard: "boat",
    climb: "trending-up",
    other: "fitness",
  };

  // Get recent items for the activity tab
  const getRecentItems = () => {
    const allItems = [
      ...savedSpots.map((spot) => ({
        type: "spot" as const,
        id: spot.id,
        name: spot.name,
        timestamp: spot.timestamp,
        category: spot.category,
      })),
      ...trips.map((trip) => ({
        type: "trip" as const,
        id: trip.id,
        name: trip.name,
        timestamp: trip.created_at,
      })),
      ...activities.map((activity) => ({
        type: "activity" as const,
        id: activity.id,
        name: activity.name,
        timestamp: activity.startTime,
        activityType: activity.type,
      })),
    ];

    return allItems
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 5);
  };

  const recentItems = getRecentItems();

  // Main dashboard render
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => toggleSidebar(true)}
          style={styles.menuButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="menu" size={28} color={theme.colors.navy} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <ExplorableLogo width={120} variant="default" />
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push("/notifications")}
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={theme.colors.navy}
            />
            {unreadNotificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        onScrollBeginDrag={() => setScrollEnabled(true)}
      >
        {/* Hero Section */}
        {heroPhoto ? (
          <TouchableOpacity
            style={styles.heroSection}
            onPress={() => router.push("/saved-spots")}
            activeOpacity={0.9}
          >
            <ImageBackground
              source={{ uri: heroPhoto.uri }}
              style={styles.heroImage}
              imageStyle={styles.heroImageStyle}
            >
              <View style={styles.heroOverlay}>
                <View style={styles.heroContent}>
                  <Text style={styles.heroGreeting}>
                    {getGreeting()},{" "}
                    {profile?.display_name?.split(" ")[0] ||
                      profile?.username ||
                      "Explorer"}
                  </Text>
                  <Text style={styles.heroLabel}>Latest Adventure</Text>
                  <Text style={styles.heroTitle}>{heroPhoto.name}</Text>
                </View>
                <View style={styles.heroStats}>
                  <TouchableOpacity
                    style={styles.heroStatItem}
                    onPress={() => router.push("/saved-spots")}
                  >
                    <Text style={styles.heroStatNumber}>
                      {stats.totalLocations}
                    </Text>
                    <Text style={styles.heroStatLabel}>Places</Text>
                  </TouchableOpacity>
                  <View style={styles.heroStatDivider} />
                  <TouchableOpacity
                    style={styles.heroStatItem}
                    onPress={() => router.push("/past-activities")}
                  >
                    <Text style={styles.heroStatNumber}>
                      {stats.totalActivities}
                    </Text>
                    <Text style={styles.heroStatLabel}>Activities</Text>
                  </TouchableOpacity>
                  <View style={styles.heroStatDivider} />
                  <TouchableOpacity
                    style={styles.heroStatItem}
                    onPress={() => router.push("/trips")}
                  >
                    <Text style={styles.heroStatNumber}>
                      {trips?.length || 0}
                    </Text>
                    <Text style={styles.heroStatLabel}>Trips</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        ) : (
          <View style={styles.heroPlaceholder}>
            <View style={styles.heroPlaceholderContent}>
              <Text style={styles.heroPlaceholderGreeting}>
                {getGreeting()},{" "}
                {profile?.display_name?.split(" ")[0] ||
                  profile?.username ||
                  "Explorer"}
              </Text>
              <ExplorableIcon size={60} />
              <Text style={styles.heroPlaceholderTitle}>
                Start Your Adventure
              </Text>
              <Text style={styles.heroPlaceholderText}>
                Save your first spot to see it featured here
              </Text>
              <TouchableOpacity
                style={styles.heroPlaceholderButton}
                onPress={() => router.push("/save-location")}
              >
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.heroPlaceholderButtonText}>
                  Add First Spot
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.heroStats}>
              <TouchableOpacity
                style={styles.heroStatItem}
                onPress={() => router.push("/saved-spots")}
              >
                <Text
                  style={[styles.heroStatNumber, { color: theme.colors.navy }]}
                >
                  {stats.totalLocations}
                </Text>
                <Text
                  style={[styles.heroStatLabel, { color: theme.colors.gray }]}
                >
                  Places
                </Text>
              </TouchableOpacity>
              <View
                style={[
                  styles.heroStatDivider,
                  { backgroundColor: theme.colors.borderGray },
                ]}
              />
              <TouchableOpacity
                style={styles.heroStatItem}
                onPress={() => router.push("/past-activities")}
              >
                <Text
                  style={[styles.heroStatNumber, { color: theme.colors.navy }]}
                >
                  {stats.totalActivities}
                </Text>
                <Text
                  style={[styles.heroStatLabel, { color: theme.colors.gray }]}
                >
                  Activities
                </Text>
              </TouchableOpacity>
              <View
                style={[
                  styles.heroStatDivider,
                  { backgroundColor: theme.colors.borderGray },
                ]}
              />
              <TouchableOpacity
                style={styles.heroStatItem}
                onPress={() => router.push("/trips")}
              >
                <Text
                  style={[styles.heroStatNumber, { color: theme.colors.navy }]}
                >
                  {trips?.length || 0}
                </Text>
                <Text
                  style={[styles.heroStatLabel, { color: theme.colors.gray }]}
                >
                  Trips
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Weekly Streak */}
        {(stats.thisWeekSpots > 0 || stats.thisWeekActivities > 0) && (
          <View style={styles.streakSection}>
            <View style={styles.streakContent}>
              <View style={styles.streakIcon}>
                <Ionicons name="flame" size={24} color="#FF6B35" />
              </View>
              <View style={styles.streakText}>
                <Text style={styles.streakTitle}>This Week</Text>
                <Text style={styles.streakSubtitle}>
                  {stats.thisWeekSpots > 0 &&
                    `${stats.thisWeekSpots} spot${
                      stats.thisWeekSpots > 1 ? "s" : ""
                    }`}
                  {stats.thisWeekSpots > 0 &&
                    stats.thisWeekActivities > 0 &&
                    " • "}
                  {stats.thisWeekActivities > 0 &&
                    `${stats.thisWeekActivities} activit${
                      stats.thisWeekActivities > 1 ? "ies" : "y"
                    }`}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Stats Row */}
        <View style={styles.quickStatsSection}>
          <TouchableOpacity
            style={styles.quickStatCard}
            onPress={() => router.push("/journal")}
            activeOpacity={0.7}
          >
            <Ionicons name="book" size={20} color="#9C27B0" />
            <Text style={styles.quickStatNumber}>{journalEntries.length}</Text>
            <Text style={styles.quickStatLabel}>Journal Entries</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickStatCard}
            onPress={() =>
              router.push({
                pathname: "/saved-spots",
                params: { filter: "withPhotos" },
              } as any)
            }
            activeOpacity={0.7}
          >
            <Ionicons
              name="camera"
              size={20}
              color={theme.colors.burntOrange}
            />
            <Text style={styles.quickStatNumber}>
              {savedSpots.filter((s) => s.photos && s.photos.length > 0).length}
            </Text>
            <Text style={styles.quickStatLabel}>With Photos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickStatCard}
            onPress={() => router.push("/top-rated")}
            activeOpacity={0.7}
          >
            <Ionicons name="star" size={20} color="#FFB800" />
            <Text style={styles.quickStatNumber}>
              {savedSpots.filter((s) => s.rating && s.rating >= 4).length +
                activities.filter((a) => a.rating && a.rating >= 4).length}
            </Text>
            <Text style={styles.quickStatLabel}>Top Rated</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickStatCard}
            onPress={() => router.push("/wishlist")}
            activeOpacity={0.7}
          >
            <Ionicons name="heart" size={20} color="#9C27B0" />
            <Text style={styles.quickStatNumber}>
              {wishlistItems?.length || 0}
            </Text>
            <Text style={styles.quickStatLabel}>Wishlist</Text>
          </TouchableOpacity>
        </View>

        {/* Activity Section with Tabs */}
        <View style={styles.activitySection}>
          <View style={styles.tabHeader}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "recent" && styles.tabActive]}
              onPress={() => setActiveTab("recent")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "recent" && styles.tabTextActive,
                ]}
              >
                Recent
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "friends" && styles.tabActive]}
              onPress={() => setActiveTab("friends")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "friends" && styles.tabTextActive,
                ]}
              >
                Friends
              </Text>
              {friendRequests.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {friendRequests.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {activeTab === "recent" ? (
            <View style={styles.tabContent}>
              {recentItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="compass-outline"
                    size={48}
                    color={theme.colors.lightGray}
                  />
                  <Text style={styles.emptyText}>No adventures yet</Text>
                  <Text style={styles.emptySubtext}>
                    Start exploring to see your activity here
                  </Text>
                </View>
              ) : (
                recentItems.map((item) => {
                  let icon = "ellipse";
                  let color = theme.colors.gray;
                  let onPress = () => {};

                  if (item.type === "spot") {
                    const category =
                      categories[item.category] || categories.other;
                    icon = "location";
                    color = category.color;
                    onPress = () => router.push(`/location/${item.id}` as any);
                  } else if (item.type === "trip") {
                    icon = "airplane";
                    color = theme.colors.navy;
                    onPress = () =>
                      router.push({
                        pathname: "/trip-detail",
                        params: { tripId: item.id },
                      } as any);
                  } else if (item.type === "activity") {
                    const activityIcon =
                      activityIcons[item.activityType] || "fitness";
                    icon = activityIcon;
                    color = theme.colors.burntOrange;
                    onPress = () => router.push(`/activity/${item.id}` as any);
                  }

                  return (
                    <TouchableOpacity
                      key={`${item.type}-${item.id}`}
                      style={styles.recentCard}
                      onPress={onPress}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.recentIcon,
                          { backgroundColor: color + "15" },
                        ]}
                      >
                        <Ionicons name={icon as any} size={18} color={color} />
                      </View>
                      <View style={styles.recentInfo}>
                        <Text style={styles.recentName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.recentMeta}>
                          {item.type.charAt(0).toUpperCase() +
                            item.type.slice(1)}{" "}
                          • {new Date(item.timestamp).toLocaleDateString()}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={theme.colors.lightGray}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          ) : (
            <View style={styles.tabContent}>
              <TouchableOpacity
                style={styles.friendsCard}
                onPress={() => router.push("/friends-feed")}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.friendsCardIcon,
                    { backgroundColor: theme.colors.forest + "15" },
                  ]}
                >
                  <Ionicons
                    name="people"
                    size={24}
                    color={theme.colors.forest}
                  />
                </View>
                <View style={styles.friendsCardInfo}>
                  <Text style={styles.friendsCardTitle}>Friends Feed</Text>
                  <Text style={styles.friendsCardSubtitle}>
                    See what friends are up to
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.lightGray}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.friendsCard}
                onPress={() => router.push("/friends")}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.friendsCardIcon,
                    { backgroundColor: theme.colors.burntOrange + "15" },
                  ]}
                >
                  <Ionicons
                    name="person-add"
                    size={24}
                    color={theme.colors.burntOrange}
                  />
                </View>
                <View style={styles.friendsCardInfo}>
                  <Text style={styles.friendsCardTitle}>Find Friends</Text>
                  <Text style={styles.friendsCardSubtitle}>
                    Connect with other explorers
                  </Text>
                </View>
                {friendRequests.length > 0 && (
                  <View style={styles.friendsRequestBadge}>
                    <Text style={styles.friendsRequestBadgeText}>
                      {friendRequests.length}
                    </Text>
                  </View>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.lightGray}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Collapsible Map Section */}
        <View style={styles.mapSection}>
          <TouchableOpacity
            style={styles.mapToggle}
            onPress={() => setShowMap(!showMap)}
            activeOpacity={0.7}
          >
            <View style={styles.mapToggleLeft}>
              <Ionicons name="map" size={20} color={theme.colors.forest} />
              <Text style={styles.mapToggleText}>Adventure Map</Text>
            </View>
            <View style={styles.mapToggleRight}>
              <Text style={styles.mapToggleHint}>
                {savedSpots.length} places • {activities.length} routes
              </Text>
              <Ionicons
                name={showMap ? "chevron-up" : "chevron-down"}
                size={20}
                color={theme.colors.gray}
              />
            </View>
          </TouchableOpacity>

          {showMap && (
            <View
              style={styles.mapContainer}
              onTouchStart={() => setScrollEnabled(false)}
              onTouchEnd={() => setTimeout(() => setScrollEnabled(true), 100)}
              onTouchCancel={() =>
                setTimeout(() => setScrollEnabled(true), 100)
              }
            >
              <WebView
                ref={webViewRef}
                style={styles.map}
                source={{ html: generateMapHTML() }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scrollEnabled={true}
                scalesPageToFit={false}
              />
              <View style={styles.mapLegend} pointerEvents="none">
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: theme.colors.burntOrange },
                    ]}
                  />
                  <Text style={styles.legendText}>You</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: theme.colors.forest },
                    ]}
                  />
                  <Text style={styles.legendText}>Routes</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: theme.colors.navy },
                    ]}
                  />
                  <Text style={styles.legendText}>Places</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Bottom padding for scroll */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            height: animatedValue,
          },
        ]}
      >
        <View style={styles.bottomSheetHeader} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
          <Text style={styles.bottomSheetTitle}>Quick Actions</Text>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push("/save-location")}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: theme.colors.forest + "15" },
              ]}
            >
              <Ionicons name="location" size={22} color={theme.colors.forest} />
            </View>
            <Text style={styles.quickActionText}>Save Spot</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push("/quick-photo")}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: "#FFB800" + "15" },
              ]}
            >
              <Ionicons name="camera" size={22} color="#FFB800" />
            </View>
            <Text style={styles.quickActionText}>Quick Log</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push("/track-activity")}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: theme.colors.navy + "15" },
              ]}
            >
              <Ionicons name="fitness" size={22} color={theme.colors.navy} />
            </View>
            <Text style={styles.quickActionText}>Track</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push("/create-trip")}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: theme.colors.burntOrange + "15" },
              ]}
            >
              <Ionicons
                name="airplane"
                size={22}
                color={theme.colors.burntOrange}
              />
            </View>
            <Text style={styles.quickActionText}>New Trip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push("/add-journal")}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: "#9C27B0" + "15" },
              ]}
            >
              <Ionicons name="book" size={22} color="#9C27B0" />
            </View>
            <Text style={styles.quickActionText}>New Journal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickAction,
              reviewingTrips && styles.quickActionDisabled,
            ]}
            onPress={async () => {
              if (reviewingTrips) return;
              try {
                setReviewingTrips(true);
                await showPendingClusters();
              } catch (error) {
                console.error("Error reviewing trips:", error);
                Alert.alert(
                  "Error",
                  "Failed to check for trips. Please try again."
                );
              } finally {
                setReviewingTrips(false);
              }
            }}
            disabled={reviewingTrips}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: theme.colors.forest + "15" },
              ]}
            >
              {reviewingTrips ? (
                <ActivityIndicator size="small" color={theme.colors.forest} />
              ) : (
                <Ionicons
                  name="sparkles"
                  size={22}
                  color={theme.colors.forest}
                />
              )}
            </View>
            <Text style={styles.quickActionText}>
              {reviewingTrips ? "..." : "Auto Trip"}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Sidebar Modal */}
      <Modal
        visible={showSidebar}
        animationType="none"
        transparent={true}
        onRequestClose={() => toggleSidebar(false)}
      >
        <View style={styles.sidebarContainer}>
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => toggleSidebar(false)}
          />

          <Animated.View
            style={[
              styles.sidebar,
              {
                transform: [{ translateX: sidebarAnimation }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.profileSection}
              onPress={() => {
                toggleSidebar(false);
                setShowProfileEdit(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.profileAvatar}>
                <UserAvatar user={profile} size={60} />
              </View>
              <Text style={styles.profileName}>
                {profile?.display_name || profile?.username || "Explorer"}
              </Text>
              <Text style={styles.profileStats}>
                {stats.totalLocations} places • {stats.totalActivities}{" "}
                activities
              </Text>
              {user && <Text style={styles.profileEmail}>{user.email}</Text>}
              <View style={styles.editIndicator}>
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={theme.colors.gray}
                />
                <Text style={styles.editText}>Tap to edit</Text>
              </View>
            </TouchableOpacity>

            <ScrollView style={styles.sidebarMenu}>
              {sidebarItems.map((item, index) => {
                if (item.divider) {
                  return <View key={index} style={styles.sidebarDivider} />;
                }

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.sidebarItem,
                      item.active && styles.sidebarItemActive,
                    ]}
                    onPress={() => {
                      toggleSidebar(false);
                      if (item.route) {
                        router.push(item.route as any);
                      }
                    }}
                  >
                    <View style={styles.sidebarItemContent}>
                      <Ionicons
                        name={item.icon as any}
                        size={24}
                        color={
                          item.active ? theme.colors.forest : theme.colors.gray
                        }
                      />
                      <Text
                        style={[
                          styles.sidebarItemText,
                          item.active && styles.sidebarItemTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>
                    {item.badge !== undefined && item.badge > 0 && (
                      <View style={styles.sidebarBadge}>
                        <Text style={styles.sidebarBadgeText}>
                          {item.badge}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.sidebarFooter}>
              {user ? (
                <TouchableOpacity
                  style={styles.authStatusButton}
                  onPress={() => {
                    toggleSidebar(false);
                    router.push("/settings");
                  }}
                >
                  <Ionicons
                    name="cloud-done"
                    size={20}
                    color={theme.colors.forest}
                  />
                  <Text style={styles.authStatusText}>Synced</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.authStatusButton}
                  onPress={() => {
                    toggleSidebar(false);
                    router.push("/auth/login");
                  }}
                >
                  <Ionicons
                    name="cloud-offline"
                    size={20}
                    color={theme.colors.gray}
                  />
                  <Text style={styles.authStatusText}>
                    {isOfflineMode ? "Offline Mode" : "Sign In"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Profile Edit Modal */}
      <ProfileEditModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.gray,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  authPromptContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: theme.colors.offWhite,
  },
  authPromptTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
    marginTop: 20,
    marginBottom: 10,
  },
  authPromptText: {
    fontSize: 16,
    color: theme.colors.gray,
    textAlign: "center",
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  authPromptButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 15,
  },
  authPromptButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  authPromptLinkButton: {
    padding: 10,
  },
  authPromptLinkText: {
    color: theme.colors.forest,
    fontSize: 14,
    textDecorationLine: "underline",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  menuButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  notificationButton: {
    padding: 4,
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },

  scrollContainer: {
    flex: 1,
  },

  // Hero Section
  heroSection: {
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  heroImage: {
    height: 200,
    justifyContent: "flex-end",
  },
  heroImageStyle: {
    borderRadius: 16,
  },
  heroOverlay: {
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  heroContent: {
    marginBottom: 12,
  },
  heroGreeting: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
  },
  heroStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  heroStatItem: {
    alignItems: "center",
  },
  heroStatNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: "white",
  },
  heroStatLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.3)",
  },

  // Hero Placeholder
  heroPlaceholder: {
    margin: 16,
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  heroPlaceholderContent: {
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  heroPlaceholderGreeting: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.forest,
    marginBottom: 12,
  },
  heroPlaceholderTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginTop: 12,
  },
  heroPlaceholderText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  heroPlaceholderButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  heroPlaceholderButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },

  // Streak Section
  streakSection: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#FFF8F0",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FFE4CC",
  },
  streakContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  streakIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFECE0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  streakText: {
    flex: 1,
  },
  streakTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  streakSubtitle: {
    fontSize: 13,
    color: "#FF6B35",
    marginTop: 2,
  },

  // Quick Stats
  quickStatsSection: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  quickStatNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.navy,
    marginTop: 6,
  },
  quickStatLabel: {
    fontSize: 10,
    color: theme.colors.gray,
    marginTop: 2,
    textAlign: "center",
  },

  // Activity Section with Tabs
  activitySection: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  tabHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
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
    fontWeight: "600",
  },
  tabBadge: {
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  tabContent: {
    padding: 12,
  },

  // Recent Cards
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.navy,
  },
  recentMeta: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },

  // Friends Cards
  friendsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  friendsCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  friendsCardInfo: {
    flex: 1,
  },
  friendsCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  friendsCardSubtitle: {
    fontSize: 13,
    color: theme.colors.gray,
    marginTop: 2,
  },
  friendsRequestBadge: {
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    marginRight: 8,
  },
  friendsRequestBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.gray,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.lightGray,
    marginTop: 4,
  },

  // Map Section
  mapSection: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  mapToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  mapToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mapToggleText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  mapToggleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mapToggleHint: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  mapContainer: {
    height: height * 0.35,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  mapLegend: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    color: theme.colors.gray,
  },

  // Bottom Sheet
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomSheetHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.borderGray,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  bottomSheetTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.navy,
    textAlign: "center",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  quickAction: {
    alignItems: "center",
    width: 60,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  quickActionText: {
    fontSize: 11,
    color: theme.colors.gray,
    textAlign: "center",
  },
  quickActionDisabled: {
    opacity: 0.6,
  },

  // Sidebar
  sidebarContainer: {
    flex: 1,
    flexDirection: "row",
  },
  sidebarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: width * 0.75,
    backgroundColor: theme.colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 100,
  },
  profileSection: {
    backgroundColor: theme.colors.offWhite,
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  profileAvatar: {
    marginBottom: 10,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
    textAlign: "center",
  },
  profileStats: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 5,
    textAlign: "center",
  },
  profileEmail: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 3,
    textAlign: "center",
  },
  editIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
  },
  editText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginLeft: 4,
  },
  sidebarMenu: {
    flex: 1,
  },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
  },
  sidebarItemActive: {
    backgroundColor: theme.colors.offWhite,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.forest,
  },
  sidebarItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sidebarItemText: {
    fontSize: 16,
    color: theme.colors.gray,
    marginLeft: 15,
    flex: 1,
  },
  sidebarItemTextActive: {
    color: theme.colors.forest,
    fontWeight: "600",
  },
  sidebarBadge: {
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  sidebarBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: theme.colors.borderGray,
    marginVertical: 10,
  },
  sidebarFooter: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  authStatusButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.offWhite,
    padding: 12,
    borderRadius: 8,
  },
  authStatusText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.navy,
    marginLeft: 8,
  },
});

// Profile Edit Modal Styles
const profileEditStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  content: {
    backgroundColor: "white",
    borderRadius: 20,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.navy,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  inputError: {
    borderColor: "#FF4757",
  },
  hint: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 4,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 12,
    color: "#FF4757",
    marginTop: 4,
    marginBottom: 20,
  },
  usernameContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    paddingLeft: 12,
  },
  usernamePrefix: {
    fontSize: 16,
    color: theme.colors.gray,
    marginRight: 2,
  },
  usernameInput: {
    flex: 1,
    padding: 12,
    paddingLeft: 2,
    fontSize: 16,
    color: theme.colors.navy,
  },
  usernameSpinner: {
    marginRight: 12,
  },
  currentInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    padding: 20,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
  },
  cancelText: {
    fontSize: 16,
    color: theme.colors.gray,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: theme.colors.forest,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
});
