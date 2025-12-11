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
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { UserAvatar } from "../components/UserAvatar";

const { width, height } = Dimensions.get("window");
const BOTTOM_SHEET_MAX_HEIGHT = height * 0.5;
const BOTTOM_SHEET_MIN_HEIGHT = 80;

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
  const [reviewingTrips, setReviewingTrips] = useState(false);

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
  // FIXED: Works for all users (new and existing) without hanging in React 19
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const requestInitialPermissions = async () => {
      try {
        // Wait to ensure app UI is fully rendered (iOS needs this)
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Request location - works for everyone:
        // - Already granted? Returns immediately, no prompt
        // - Never asked? Shows prompt
        // - Previously denied? Returns immediately, no prompt
        const locationResult =
          await Location.requestForegroundPermissionsAsync();
        // Request notifications with explicit iOS options
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

        // Show alert if location was denied
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

    // Run for all users after initialization (authenticated or offline mode)
    const shouldRequest =
      !isInitializing && !authLoading && (user?.id || isOfflineMode);

    if (shouldRequest) {
      // Additional delay to ensure UI is fully rendered
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
      // Initialize background tracking (for "always on" users)
      MemoryNotificationService.initialize(user.id);

      // Initialize foreground checks (for "when in use" users)
      MemoryNotificationService.initializeForegroundChecks(user.id);

      fetchNotificationCount();

      // Set up real-time subscription for notifications
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

      // Handle app state changes for foreground checks
      const appStateSubscription = AppState.addEventListener(
        "change",
        (nextAppState) => {
          if (nextAppState === "active") {
            // App came to foreground - restart foreground checks
            MemoryNotificationService.initializeForegroundChecks(user.id);
          } else if (nextAppState === "background") {
            // App went to background - stop foreground checks
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

  // Refresh notification count when screen comes into focus
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
    uniqueCategories: new Set(savedSpots.map((s) => s.category)).size,
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

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

        <View style={styles.logoContainer}>
          <ExplorableLogo width={140} variant="default" />
        </View>

        <View style={styles.headerActions}>
          {unreadNotificationCount > 0 && (
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => router.push("/notifications")}
            >
              <Ionicons
                name="notifications"
                size={24}
                color={theme.colors.burntOrange}
              />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotificationCount}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          {user ? (
            <View style={styles.authIndicator}>
              <Ionicons
                name="cloud-done"
                size={20}
                color={theme.colors.forest}
              />
            </View>
          ) : isOfflineMode ? (
            <View style={styles.authIndicator}>
              <Ionicons
                name="cloud-offline"
                size={20}
                color={theme.colors.gray}
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* Welcome Bar */}
      {profile && (
        <View style={styles.welcomeBar}>
          <View style={styles.welcomeContent}>
            <Text style={styles.welcomeText}>
              Welcome back, {profile.display_name || profile.username}!
            </Text>
          </View>
        </View>
      )}

      {/* Main Content */}
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        onScrollBeginDrag={() => setScrollEnabled(true)}
      >
        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Adventure Summary</Text>

          <View style={styles.statsGrid}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push("/saved-spots")}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: theme.colors.forest + "20" },
                ]}
              >
                <Ionicons
                  name="location"
                  size={24}
                  color={theme.colors.forest}
                />
              </View>
              <Text style={styles.statNumber}>{stats.totalLocations}</Text>
              <Text style={styles.statLabel}>Places</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push("/past-activities")}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: theme.colors.burntOrange + "20" },
                ]}
              >
                <Ionicons
                  name="fitness"
                  size={24}
                  color={theme.colors.burntOrange}
                />
              </View>
              <Text style={styles.statNumber}>{activities.length}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push("/trips")}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: theme.colors.navy + "20" },
                ]}
              >
                <Ionicons name="airplane" size={24} color={theme.colors.navy} />
              </View>
              <Text style={styles.statNumber}>{trips?.length || 0}</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push("/wishlist")}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: "#9C27B0" + "20" },
                ]}
              >
                <Ionicons name="heart" size={24} color="#9C27B0" />
              </View>
              <Text style={styles.statNumber}>
                {wishlistItems?.length || 0}
              </Text>
              <Text style={styles.statLabel}>Wishlist</Text>
            </TouchableOpacity>
          </View>

          {/* Updated Quick Stats - travel focused */}
          <View style={styles.quickStats}>
            <TouchableOpacity
              style={styles.quickStatItem}
              onPress={() =>
                router.push({
                  pathname: "/saved-spots",
                  params: { filter: "categories" },
                } as any)
              }
              activeOpacity={0.7}
            >
              <Text style={styles.quickStatValue}>
                {stats.uniqueCategories}
              </Text>
              <Text style={styles.quickStatLabel}>Categories</Text>
            </TouchableOpacity>
            <View style={styles.quickStatDivider} />
            <TouchableOpacity
              style={styles.quickStatItem}
              onPress={() =>
                router.push({
                  pathname: "/saved-spots",
                  params: { filter: "withPhotos" },
                } as any)
              }
              activeOpacity={0.7}
            >
              <Text style={styles.quickStatValue}>
                {
                  savedSpots.filter((s) => s.photos && s.photos.length > 0)
                    .length
                }
              </Text>
              <Text style={styles.quickStatLabel}>With Photos</Text>
            </TouchableOpacity>
            <View style={styles.quickStatDivider} />
            <TouchableOpacity
              style={styles.quickStatItem}
              onPress={() => router.push("/top-rated")}
              activeOpacity={0.7}
            >
              <Text style={styles.quickStatValue}>
                {savedSpots.filter((s) => s.rating && s.rating >= 4).length +
                  activities.filter((a) => a.rating && a.rating >= 4).length}
              </Text>
              <Text style={styles.quickStatLabel}>Top Rated</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Map Section */}
        <View style={styles.mapSection}>
          <View style={styles.mapTitleRow}>
            <Text style={styles.sectionTitle}>Your Adventure Map</Text>
            <View style={styles.mapStyleBadge}>
              <Ionicons
                name={
                  settings.mapStyle === "satellite"
                    ? "globe"
                    : settings.mapStyle === "terrain"
                    ? "trail-sign"
                    : "map"
                }
                size={14}
                color={theme.colors.forest}
              />
              <Text style={styles.mapStyleText}>
                {settings.mapStyle.charAt(0).toUpperCase() +
                  settings.mapStyle.slice(1)}
              </Text>
            </View>
          </View>
          <View
            style={styles.mapContainer}
            onTouchStart={() => {
              setScrollEnabled(false);
            }}
            onTouchEnd={() => {
              // Small delay to let map finish processing touch
              setTimeout(() => setScrollEnabled(true), 100);
            }}
            onTouchCancel={() => {
              setTimeout(() => setScrollEnabled(true), 100);
            }}
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
        </View>

        {/* Friends Section */}
        <View style={styles.friendsSection}>
          <Text style={styles.sectionTitle}>Friends & Social</Text>
          <View style={styles.friendsButtons}>
            <TouchableOpacity
              style={styles.friendButton}
              onPress={() => router.push("/friends-feed")}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.friendIconContainer,
                  { backgroundColor: theme.colors.forest + "20" },
                ]}
              >
                <Ionicons name="people" size={24} color={theme.colors.forest} />
              </View>
              <Text style={styles.friendButtonTitle}>Friends Feed</Text>
              <Text style={styles.friendButtonSubtitle}>
                See what friends are up to
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.friendButton}
              onPress={() => router.push("/friends")}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.friendIconContainer,
                  { backgroundColor: theme.colors.burntOrange + "20" },
                ]}
              >
                <Ionicons
                  name="person-add"
                  size={24}
                  color={theme.colors.burntOrange}
                />
              </View>
              <Text style={styles.friendButtonTitle}>Manage Friends</Text>
              <Text style={styles.friendButtonSubtitle}>
                Add or find friends
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Latest Additions - Show actual recent items */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Latest Additions</Text>
          </View>

          {(() => {
            // Combine all items with timestamps
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

            // Sort by timestamp (most recent first) and take top 5
            const recentItems = allItems
              .sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime()
              )
              .slice(0, 5);

            if (recentItems.length === 0) {
              return (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    Start exploring! Save your favorite spots and track your
                    adventures.
                  </Text>
                  <TouchableOpacity
                    style={styles.startButton}
                    onPress={() => router.push("/save-location")}
                  >
                    <Ionicons name="add-circle" size={20} color="white" />
                    <Text style={styles.startButtonText}>
                      Add Your First Place
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }

            return recentItems.map((item) => {
              let icon = "ellipse";
              let color = theme.colors.gray;
              let onPress = () => {};

              if (item.type === "spot") {
                const category = categories[item.category] || categories.other;
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
                      { backgroundColor: color + "20" },
                    ]}
                  >
                    <Ionicons name={icon as any} size={20} color={color} />
                  </View>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentName}>{item.name}</Text>
                    <Text style={styles.recentMeta}>
                      {item.type.charAt(0).toUpperCase() + item.type.slice(1)} •{" "}
                      {new Date(item.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.lightGray}
                  />
                </TouchableOpacity>
              );
            });
          })()}
        </View>
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
            <Ionicons name="location" size={24} color={theme.colors.forest} />
            <Text style={styles.quickActionText}>Save Spot</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push("/quick-photo")}
          >
            <Ionicons name="camera" size={24} color="#FFB800" />
            <Text style={styles.quickActionText}>Quick Log</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push("/track-activity")}
          >
            <Ionicons name="fitness" size={24} color={theme.colors.navy} />
            <Text style={styles.quickActionText}>Track</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push("/friends")}
          >
            <Ionicons
              name="people"
              size={24}
              color={theme.colors.burntOrange}
            />
            <Text style={styles.quickActionText}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push("/notifications")}
          >
            <Ionicons name="notifications" size={24} color="#9C27B0" />
            <Text style={styles.quickActionText}>Alerts</Text>
            {unreadNotificationCount > 0 && (
              <View style={styles.quickActionBadge}>
                <Text style={styles.quickActionBadgeText}>
                  {unreadNotificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {/* ADD THIS NEW BUTTON */}
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
            {reviewingTrips ? (
              <ActivityIndicator size="small" color={theme.colors.forest} />
            ) : (
              <Ionicons name="airplane" size={24} color={theme.colors.forest} />
            )}
            <Text style={styles.quickActionText}>
              {reviewingTrips ? "Checking..." : "Create Trips"}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.white,
    paddingVertical: 12,
    paddingHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 10,
  },
  logoContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  menuButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationButton: {
    padding: 8,
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
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
  authIndicator: {
    padding: 8,
  },
  welcomeBar: {
    backgroundColor: theme.colors.forest + "10",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.forest + "20",
    minHeight: 44,
  },
  welcomeText: {
    fontSize: 14,
    color: theme.colors.forest,
    fontWeight: "500",
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  welcomeContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  statsSection: {
    backgroundColor: theme.colors.white,
    paddingVertical: 20,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 15,
    lineHeight: 28,
    includeFontPadding: false,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  statCard: {
    width: "48%",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    alignItems: "center",
    minHeight: 120,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
    lineHeight: 32,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 4,
    lineHeight: 16,
    includeFontPadding: false,
    textAlign: "center",
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 15,
  },
  quickStatItem: {
    alignItems: "center",
  },
  quickStatValue: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    lineHeight: 22,
    includeFontPadding: false,
  },
  quickStatLabel: {
    fontSize: 11,
    color: theme.colors.gray,
    marginTop: 2,
    lineHeight: 15,
    includeFontPadding: false,
    textAlign: "center",
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: theme.colors.borderGray,
  },
  friendsSection: {
    backgroundColor: theme.colors.white,
    paddingVertical: 20,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  friendsButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  friendButton: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },
  friendIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  friendButtonTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 4,
    lineHeight: 20,
    includeFontPadding: false,
    textAlign: "center",
  },
  friendButtonSubtitle: {
    fontSize: 11,
    color: theme.colors.gray,
    textAlign: "center",
    lineHeight: 15,
    includeFontPadding: false,
  },
  mapSection: {
    backgroundColor: theme.colors.white,
    padding: 15,
    marginBottom: 10,
  },
  mapTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  mapStyleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  mapStyleText: {
    fontSize: 12,
    color: theme.colors.forest,
    marginLeft: 5,
    fontWeight: "500",
  },
  mapContainer: {
    height: height * 0.4,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  map: {
    flex: 1,
  },
  mapLegend: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
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
  recentSection: {
    backgroundColor: theme.colors.white,
    padding: 15,
    marginBottom: 100,
  },
  emptyState: {
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
    marginBottom: 15,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  startButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
    lineHeight: 22,
    includeFontPadding: false,
  },
  recentMeta: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
    lineHeight: 16,
    includeFontPadding: false,
  },
  viewStatsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  viewStatsText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.forest,
    marginHorizontal: 8,
    flex: 1,
    textAlign: "center",
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  bottomSheetHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.borderGray,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 10,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    textAlign: "center",
    lineHeight: 22,
    includeFontPadding: false,
  },
  quickActionText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 4,
    lineHeight: 16,
    includeFontPadding: false,
    textAlign: "center",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
  },
  quickAction: {
    alignItems: "center",
    position: "relative",
  },
  quickActionBadge: {
    position: "absolute",
    top: -5,
    right: -8,
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  quickActionBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
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
    lineHeight: 28,
    includeFontPadding: false,
    textAlign: "center",
  },
  profileStats: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 5,
    lineHeight: 20,
    includeFontPadding: false,
    textAlign: "center",
  },
  profileEmail: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 3,
    lineHeight: 16,
    includeFontPadding: false,
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
    lineHeight: 22,
    includeFontPadding: false,
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
  memoryTestSection: {
    backgroundColor: "#FFF3E0",
    paddingVertical: 20,
    paddingHorizontal: 15,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#FFB800",
    borderStyle: "dashed" as any,
  },
  memoryTestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  memoryTestContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  memoryTestText: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.navy,
    marginLeft: 12,
  },
  tripManagementSection: {
    backgroundColor: theme.colors.white,
    paddingVertical: 20,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  tripCount: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  reviewTripsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 15,
  },
  reviewTripsContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  reviewTripsText: {
    marginLeft: 12,
    flex: 1,
  },
  reviewTripsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 2,
  },
  reviewTripsSubtitle: {
    fontSize: 13,
    color: theme.colors.gray,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  quickActionDisabled: {
    opacity: 0.6,
  },
  latestGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  latestCard: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  latestNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.colors.navy,
    marginTop: 8,
  },
  latestLabel: {
    fontSize: 13,
    color: theme.colors.gray,
    marginTop: 4,
    textAlign: "center",
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
