// app/index.tsx - Complete new version with proper auth handling
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Modal,
    PanResponder,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { ExplorableIcon, ExplorableLogo } from "../components/Logo";
import { categories } from "../constants/categories";
import { theme } from "../constants/theme";
import { useActivity } from "../contexts/ActivityContext";
import { useAuth } from "../contexts/AuthContext";
import { useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext";

const { width, height } = Dimensions.get("window");
const BOTTOM_SHEET_MAX_HEIGHT = height * 0.5;
const BOTTOM_SHEET_MIN_HEIGHT = 80;

export default function DashboardScreen() {
  const router = useRouter();
  const { user, profile, isOfflineMode, loading: authLoading } = useAuth();
  const { savedSpots, location, getLocation } = useLocation();
  const { activities } = useActivity();
  const { formatDistance, formatSpeed, settings, getMapTileUrl } = useSettings();
  const webViewRef = useRef<WebView>(null);

  // State
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);

  // Bottom sheet animation
  const animatedValue = useRef(new Animated.Value(BOTTOM_SHEET_MIN_HEIGHT)).current;
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

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Wait for auth to be ready
        if (authLoading) {
          return;
        }

        // Check onboarding status
        const onboardingComplete = await AsyncStorage.getItem("onboardingComplete");
        
        if (onboardingComplete !== "true") {
          console.log("Onboarding not complete - redirecting");
          router.replace("/onboarding");
          return;
        }

        // Check authentication
        if (!user && !isOfflineMode) {
          console.log("No user and not offline - redirecting to login");
          router.replace("/auth/login");
          return;
        }

        // All checks passed
        console.log("Dashboard ready - User:", user?.id, "Offline:", isOfflineMode);
        setIsInitializing(false);

        // Get location after initialization
        if (!location) {
          getLocation();
        }
      } catch (error) {
        console.error("Error initializing dashboard:", error);
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, [user, isOfflineMode, authLoading, router]);

  // Show loading screen while checking auth
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

  // Calculate statistics
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
    currentStreak: calculateStreak(),
  };

  function calculateStreak() {
    if (activities.length === 0) return 0;

    const sortedActivities = [...activities].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const activity of sortedActivities) {
      const actDate = new Date(activity.startTime);
      actDate.setHours(0, 0, 0, 0);

      const dayDiff = Math.floor(
        (currentDate.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (dayDiff === streak) {
        streak++;
      } else if (dayDiff > streak) {
        break;
      }
    }

    return streak;
  }

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
        tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
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
          L.circleMarker([${spot.location.latitude}, ${spot.location.longitude}], {
            radius: 8,
            fillColor: '${category.mapColor || category.color}',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          })
          .addTo(adventureLayer)
          .bindPopup("<div style='text-align: center;'><b style='color: ${category.color}'>${escapedName}</b><br><small>${category.label}</small></div>");
        `;
      })
      .join("\n");

    const activityRoutes = activities
      .filter((act) => act.route && act.route.length > 0)
      .map((act) => {
        const coords = act.route.map((p) => `[${p.latitude}, ${p.longitude}]`).join(",");
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
            
            ${location ? `
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
            ` : ""}
            
            // Fit bounds if we have content
            var allLayers = [];
            adventureLayer.eachLayer(function(layer) {
              allLayers.push(layer);
            });
            
            ${location ? `
              var currentMarker = L.circleMarker([${location.latitude}, ${location.longitude}]);
              allLayers.push(currentMarker);
            ` : ""}
            
            if (allLayers.length > 0) {
              var group = new L.featureGroup(allLayers);
              map.fitBounds(group.getBounds().pad(0.15), {
                maxZoom: 14,
                animate: false
              });
            } else if (${location ? "true" : "false"}) {
              map.setView([${location?.latitude || centerLat}, ${location?.longitude || centerLng}], 13);
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
    { icon: "location", label: "Saved Spots", route: "/saved-spots" },
    { icon: "fitness", label: "Activities", route: "/past-activities" },
    { icon: "people", label: "Friends Feed", route: "/friends-feed" },
    { icon: "heart", label: "Wishlist", route: "/wishlist" },
    { icon: "add-circle", label: "Add New", route: "/save-location" },
    { divider: true },
    { icon: "stats-chart", label: "Statistics", route: "/statistics" },
    { icon: "trophy", label: "Achievements", route: "/statistics#achievements" },
    { divider: true },
    { icon: "settings", label: "Settings", route: "/settings" },
    { icon: "information-circle", label: "About", route: "/" },
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setShowSidebar(true)}
          style={styles.menuButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="menu" size={28} color={theme.colors.navy} />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <ExplorableLogo width={140} variant="default" />
        </View>

        <View style={styles.headerActions}>
          {user ? (
            <View style={styles.authIndicator}>
              <Ionicons name="cloud-done" size={20} color={theme.colors.forest} />
            </View>
          ) : isOfflineMode ? (
            <View style={styles.authIndicator}>
              <Ionicons name="cloud-offline" size={20} color={theme.colors.gray} />
            </View>
          ) : null}
        </View>
      </View>

      {/* Welcome Bar - Only show if we have a profile */}
      {profile && (
        <View style={styles.welcomeBar}>
          <View style={styles.welcomeContent}>
            <Text style={styles.welcomeText}>
              Welcome back, {profile.display_name || profile.username}!
            </Text>
            <View style={styles.treeIcon}>
              <View style={styles.triangle} />
              <View style={styles.trunk} />
            </View>
          </View>
        </View>
      )}

      {/* Main Content */}
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>This Week</Text>

          <View style={styles.statsGrid}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push("/statistics")}
              activeOpacity={0.7}
            >
              <View style={[styles.statIconContainer, { backgroundColor: "#9C27B0" + "20" }]}>
                <Ionicons name="stats-chart" size={24} color="#9C27B0" />
              </View>
              <Text style={styles.statNumber}>View</Text>
              <Text style={styles.statLabel}>Statistics</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push("/saved-spots")}
              activeOpacity={0.7}
            >
              <View style={[styles.statIconContainer, { backgroundColor: theme.colors.burntOrange + "20" }]}>
                <Ionicons name="location" size={24} color={theme.colors.burntOrange} />
              </View>
              <Text style={styles.statNumber}>{stats.totalLocations}</Text>
              <Text style={styles.statLabel}>Places</Text>
            </TouchableOpacity>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: theme.colors.navy + "20" }]}>
                <Ionicons name="trending-up" size={24} color={theme.colors.navy} />
              </View>
              <Text style={styles.statNumber}>
                {formatDistance(stats.totalDistance, 0).split(" ")[0]}
              </Text>
              <Text style={styles.statLabel}>
                {formatDistance(stats.totalDistance, 0).split(" ")[1]}
              </Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: "#FFB800" + "20" }]}>
                <Ionicons name="flame" size={24} color="#FFB800" />
              </View>
              <Text style={styles.statNumber}>{stats.currentStreak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
          </View>

          {/* Quick Stats Bar */}
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{formatDuration(stats.totalDuration)}</Text>
              <Text style={styles.quickStatLabel}>Total Time</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{stats.uniqueCategories}</Text>
              <Text style={styles.quickStatLabel}>Categories</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>
                {stats.totalActivities > 0
                  ? formatDistance(stats.totalDistance / stats.totalActivities, 1)
                  : "0 km"}
              </Text>
              <Text style={styles.quickStatLabel}>Avg Distance</Text>
            </View>
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
                {settings.mapStyle.charAt(0).toUpperCase() + settings.mapStyle.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.mapContainer}>
            <WebView
              ref={webViewRef}
              style={styles.map}
              source={{ html: generateMapHTML() }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scrollEnabled={false}
              scalesPageToFit={false}
            />

            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.burntOrange }]} />
                <Text style={styles.legendText}>You</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.forest }]} />
                <Text style={styles.legendText}>Routes</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.navy }]} />
                <Text style={styles.legendText}>Places</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Activities */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Adventures</Text>
          {activities.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No activities yet. Start tracking your adventures!</Text>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => router.push("/track-activity")}
              >
                <Ionicons name="fitness" size={20} color="white" />
                <Text style={styles.startButtonText}>Track Activity</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {[...activities]
                .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                .slice(0, 3)
                .map((activity) => {
                  const icon = activityIcons[activity.type] || "fitness";
                  return (
                    <TouchableOpacity
                      key={activity.id}
                      style={styles.recentCard}
                      onPress={() => router.push("/past-activities")}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.recentIcon, { backgroundColor: theme.colors.forest + "20" }]}>
                        <Ionicons name={icon as any} size={20} color={theme.colors.forest} />
                      </View>
                      <View style={styles.recentInfo}>
                        <Text style={styles.recentName}>{activity.name}</Text>
                        <Text style={styles.recentMeta}>
                          {new Date(activity.startTime).toLocaleDateString()} •{" "}
                          {formatDistance(activity.distance)} • {formatDuration(activity.duration)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.lightGray} />
                    </TouchableOpacity>
                  );
                })}
              <TouchableOpacity
                style={styles.viewStatsButton}
                onPress={() => router.push("/statistics")}
              >
                <Ionicons name="stats-chart" size={20} color={theme.colors.forest} />
                <Text style={styles.viewStatsText}>View Detailed Statistics</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.forest} />
              </TouchableOpacity>
            </>
          )}
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
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push("/save-location")}>
            <Ionicons name="location" size={24} color={theme.colors.forest} />
            <Text style={styles.quickActionText}>Save Spot</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push("/track-activity")}>
            <Ionicons name="fitness" size={24} color={theme.colors.navy} />
            <Text style={styles.quickActionText}>Track</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push("/saved-spots")}>
            <Ionicons name="map" size={24} color={theme.colors.burntOrange} />
            <Text style={styles.quickActionText}>Browse</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Sidebar Modal */}
      <Modal
        visible={showSidebar}
        animationType="none"
        transparent={true}
        onRequestClose={() => setShowSidebar(false)}
      >
        <View style={styles.sidebarContainer}>
          <TouchableOpacity
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setShowSidebar(false)}
          />

          <Animated.View style={[styles.sidebar]}>
            <View style={styles.profileSection}>
              <View style={styles.profileAvatar}>
                <ExplorableIcon size={60} color={theme.colors.forest} />
              </View>
              <Text style={styles.profileName}>
                {profile?.display_name || profile?.username || "Explorer"}
              </Text>
              <Text style={styles.profileStats}>
                {stats.totalLocations} places • {stats.totalActivities} activities
              </Text>
              {user && (
                <Text style={styles.profileEmail}>{user.email}</Text>
              )}
            </View>

            <ScrollView style={styles.sidebarMenu}>
              {sidebarItems.map((item, index) => {
                if (item.divider) {
                  return <View key={index} style={styles.sidebarDivider} />;
                }

                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.sidebarItem, item.active && styles.sidebarItemActive]}
                    onPress={() => {
                      setShowSidebar(false);
                      if (item.route) {
                        router.push(item.route as any);
                      }
                    }}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={24}
                      color={item.active ? theme.colors.forest : theme.colors.gray}
                    />
                    <Text
                      style={[styles.sidebarItemText, item.active && styles.sidebarItemTextActive]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Auth Status in Sidebar */}
            <View style={styles.sidebarFooter}>
              {user ? (
                <TouchableOpacity
                  style={styles.authStatusButton}
                  onPress={() => {
                    setShowSidebar(false);
                    router.push("/settings");
                  }}
                >
                  <Ionicons name="cloud-done" size={20} color={theme.colors.forest} />
                  <Text style={styles.authStatusText}>Synced</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.authStatusButton}
                  onPress={() => {
                    setShowSidebar(false);
                    router.push("/auth/login");
                  }}
                >
                  <Ionicons name="cloud-offline" size={20} color={theme.colors.gray} />
                  <Text style={styles.authStatusText}>
                    {isOfflineMode ? "Offline Mode" : "Sign In"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
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
  },
  authIndicator: {
    padding: 8,
  },
  welcomeBar: {
    backgroundColor: theme.colors.forest + "10",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.forest + "20",
  },
  welcomeContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeText: {
    fontSize: 14,
    color: theme.colors.forest,
    fontWeight: "500",
  },
  treeIcon: {
    marginLeft: 8,
    alignItems: "center",
  },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 12,
    borderStyle: "solid",
    backgroundColor: "transparent",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: theme.colors.forest,
  },
  trunk: {
    width: 4,
    height: 4,
    backgroundColor: theme.colors.navy,
    marginTop: -1,
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
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
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
  },
  quickStatLabel: {
    fontSize: 11,
    color: theme.colors.gray,
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: theme.colors.borderGray,
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
  },
  recentMeta: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
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
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
  },
  quickAction: {
    alignItems: "center",
  },
  quickActionText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 4,
  },
  sidebarContainer: {
    flex: 1,
    flexDirection: "row",
  },
  sidebarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sidebar: {
    width: width * 0.75,
    backgroundColor: theme.colors.white,
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
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
  },
  profileStats: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 5,
  },
  profileEmail: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 3,
  },
  sidebarMenu: {
    flex: 1,
  },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
  },
  sidebarItemActive: {
    backgroundColor: theme.colors.offWhite,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.forest,
  },
  sidebarItemText: {
    fontSize: 16,
    color: theme.colors.gray,
    marginLeft: 15,
  },
  sidebarItemTextActive: {
    color: theme.colors.forest,
    fontWeight: "600",
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