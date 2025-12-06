// app/friend-profile/[id].tsx - Complete file with profile picture support
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../../constants/theme";
import { Activity } from "../../contexts/ActivityContext";
import { useAuth } from "../../contexts/AuthContext";
import { Friend, useFriends } from "../../contexts/FriendsContext";
import { SavedSpot, useLocation } from "../../contexts/LocationContext";
import { useSettings } from "../../contexts/SettingsContext";
import { supabase } from "../../lib/supabase";
import { FriendDataService } from "../../services/friendDataService";

const { width, height } = Dimensions.get("window");

// Privacy Settings Modal
const PrivacySettingsModal = ({
  visible,
  onClose,
  friend,
  settings,
  onUpdateSettings,
}: {
  visible: boolean;
  onClose: () => void;
  friend: Friend;
  settings: any;
  onUpdateSettings: (settings: any) => void;
}) => {
  const [privacySettings, setPrivacySettings] = useState({
    shareMyActivities: settings?.shareMyActivities ?? true,
    shareMyLocations: settings?.shareMyLocations ?? true,
    shareMyRoute: settings?.shareMyRoute ?? false,
    shareMyStats: settings?.shareMyStats ?? true,
    allowViewMyFriends: settings?.allowViewMyFriends ?? true,
  });

  const handleSave = () => {
    onUpdateSettings(privacySettings);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={privacyStyles.overlay}>
        <View style={privacyStyles.content}>
          <View style={privacyStyles.header}>
            <Text style={privacyStyles.title}>Privacy Settings</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <Text style={privacyStyles.subtitle}>
            Control what {friend.displayName} can see
          </Text>

          <View style={privacyStyles.settingsList}>
            <View style={privacyStyles.settingItem}>
              <View style={privacyStyles.settingInfo}>
                <Text style={privacyStyles.settingLabel}>
                  Share My Activities
                </Text>
                <Text style={privacyStyles.settingDescription}>
                  They can see your activity summaries
                </Text>
              </View>
              <Switch
                value={privacySettings.shareMyActivities}
                onValueChange={(value) =>
                  setPrivacySettings({
                    ...privacySettings,
                    shareMyActivities: value,
                  })
                }
                trackColor={{
                  false: theme.colors.borderGray,
                  true: theme.colors.forest,
                }}
              />
            </View>

            <View style={privacyStyles.settingItem}>
              <View style={privacyStyles.settingInfo}>
                <Text style={privacyStyles.settingLabel}>
                  Share My Locations
                </Text>
                <Text style={privacyStyles.settingDescription}>
                  They can see places you have saved
                </Text>
              </View>
              <Switch
                value={privacySettings.shareMyLocations}
                onValueChange={(value) =>
                  setPrivacySettings({
                    ...privacySettings,
                    shareMyLocations: value,
                  })
                }
                trackColor={{
                  false: theme.colors.borderGray,
                  true: theme.colors.forest,
                }}
              />
            </View>

            <View style={privacyStyles.settingItem}>
              <View style={privacyStyles.settingInfo}>
                <Text style={privacyStyles.settingLabel}>
                  Share Exact Routes
                </Text>
                <Text style={privacyStyles.settingDescription}>
                  Show detailed route paths on activities
                </Text>
              </View>
              <Switch
                value={privacySettings.shareMyRoute}
                onValueChange={(value) =>
                  setPrivacySettings({
                    ...privacySettings,
                    shareMyRoute: value,
                  })
                }
                trackColor={{
                  false: theme.colors.borderGray,
                  true: theme.colors.forest,
                }}
              />
            </View>

            <View style={privacyStyles.settingItem}>
              <View style={privacyStyles.settingInfo}>
                <Text style={privacyStyles.settingLabel}>Share Statistics</Text>
                <Text style={privacyStyles.settingDescription}>
                  They can see your achievement stats
                </Text>
              </View>
              <Switch
                value={privacySettings.shareMyStats}
                onValueChange={(value) =>
                  setPrivacySettings({
                    ...privacySettings,
                    shareMyStats: value,
                  })
                }
                trackColor={{
                  false: theme.colors.borderGray,
                  true: theme.colors.forest,
                }}
              />
            </View>

            <View style={privacyStyles.settingItem}>
              <View style={privacyStyles.settingInfo}>
                <Text style={privacyStyles.settingLabel}>
                  Show My Friends List
                </Text>
                <Text style={privacyStyles.settingDescription}>
                  They can see who else you are friends with
                </Text>
              </View>
              <Switch
                value={privacySettings.allowViewMyFriends}
                onValueChange={(value) =>
                  setPrivacySettings({
                    ...privacySettings,
                    allowViewMyFriends: value,
                  })
                }
                trackColor={{
                  false: theme.colors.borderGray,
                  true: theme.colors.forest,
                }}
              />
            </View>
          </View>

          <View style={privacyStyles.actions}>
            <TouchableOpacity style={privacyStyles.cancelBtn} onPress={onClose}>
              <Text style={privacyStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={privacyStyles.saveBtn}
              onPress={handleSave}
            >
              <Text style={privacyStyles.saveText}>Save Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { friends, removeFriend, blockUser } = useFriends();
  const { savedSpots } = useLocation();
  const { formatDistance, formatSpeed } = useSettings();

  const [selectedTab, setSelectedTab] = useState<
    "overview" | "activities" | "places" | "trips"
  >("overview");
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [friendPrivacySettings, setFriendPrivacySettings] = useState({});

  // State for friend's data
  const [friendActivities, setFriendActivities] = useState<Activity[]>([]);
  const [friendLocations, setFriendLocations] = useState<SavedSpot[]>([]);
  const [friendTrips, setFriendTrips] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [friendStats, setFriendStats] = useState({
    totalActivities: 0,
    totalLocations: 0,
    totalTrips: 0,
  });
  const [mutualFriends, setMutualFriends] = useState<Friend[]>([]);
  const [mutualTrips, setMutualTrips] = useState<any[]>([]);
  const [mutualActivities, setMutualActivities] = useState<Activity[]>([]);
  const { user } = useAuth();

  const friend = friends.find((f) => f.id === id);

  useEffect(() => {
    if (friend && user && friends.length > 0) {
      loadFriendData();
      loadMutualFriends();
      loadMutualData();
    }
  }, [friend?.id, friends.length, user?.id]);

  const loadFriendData = async () => {
    if (!friend) return;

    setLoadingData(true);
    try {
      const [activities, locations, stats] = await Promise.all([
        FriendDataService.loadFriendActivities(friend.id),
        FriendDataService.loadFriendLocations(friend.id),
        FriendDataService.loadFriendStats(friend.id),
      ]);

     // Load friend's trips (created by them OR shared with them)
      const { data: createdTrips } = await supabase
        .from('trips')
        .select(`
          *,
          trip_items (
            id,
            type,
            data
          )
        `)
        .eq('created_by', friend.id)
        .order('start_date', { ascending: false });

      // Also get trips shared with them
      const { data: sharedTripTags } = await supabase
        .from('trip_tags')
        .select('trip_id')
        .eq('user_id', friend.id);

      let trips = createdTrips || [];

      if (sharedTripTags && sharedTripTags.length > 0) {
        const sharedTripIds = sharedTripTags.map(t => t.trip_id);
        const { data: sharedTrips } = await supabase
          .from('trips')
          .select(`
            *,
            trip_items (
              id,
              type,
              data
            )
          `)
          .in('id', sharedTripIds)
          .order('start_date', { ascending: false });

        if (sharedTrips) {
          // Merge and deduplicate
          const tripIds = new Set(trips.map(t => t.id));
          sharedTrips.forEach(trip => {
            if (!tripIds.has(trip.id)) {
              trips.push(trip);
            }
          });
          // Re-sort by start_date
          trips.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        }
      }

      setFriendActivities(activities);
      setFriendLocations(locations);
      setFriendTrips(trips || []);
      setFriendStats({
        ...stats,
        totalTrips: trips?.length || 0,
      });
    } catch (error) {
      console.error("Error loading friend data:", error);
      Alert.alert("Error", "Failed to load friend data");
    } finally {
      setLoadingData(false);
    }
  };

  const loadMutualFriends = async () => {
    if (!friend || !user) return;
    
    try {
      const { data: friendsFriendships, error } = await supabase
        .from('friendships')
        .select('user_id, friend_id, status')
        .or(`user_id.eq.${friend.id},friend_id.eq.${friend.id}`)
        .eq('status', 'accepted');

      if (!friendsFriendships) return;

      const profileFriendIds = new Set<string>();
      friendsFriendships.forEach(f => {
        if (f.user_id === friend.id) {
          profileFriendIds.add(f.friend_id);
        } else if (f.friend_id === friend.id) {
          profileFriendIds.add(f.user_id);
        }
      });

      profileFriendIds.delete(user.id);

      const mutuals = friends.filter(f => 
        f.id !== friend.id &&
        profileFriendIds.has(f.id)
      );
      
      setMutualFriends(mutuals);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadMutualData = async () => {
    if (!friend || !user) return;
    
    try {
      // Get all trips and their items
      const { data: allTrips, error } = await supabase
        .from('trips')
        .select(`
          *,
          trip_items (
            id,
            type,
            data,
            added_by
          )
        `);

      if (error || !allTrips) return;

      // Find trips that have items from both users
      const sharedTrips = allTrips.filter(trip => {
        const addedByUsers = new Set(trip.trip_items.map((item: any) => item.added_by));
        return addedByUsers.has(user.id) && addedByUsers.has(friend.id);
      });

      setMutualTrips(sharedTrips);

      // Get activities from mutual trips
      const mutualActivityIds = new Set();
      sharedTrips.forEach(trip => {
        trip.trip_items.forEach((item: any) => {
          if (item.type === 'activity') {
            mutualActivityIds.add(item.data.id);
          }
        });
      });

      // Filter friend's activities that are in mutual trips
      const sharedActivities = friendActivities.filter(activity => 
        mutualActivityIds.has(activity.id)
      );

      setMutualActivities(sharedActivities);
    } catch (error) {
      console.error('Error loading mutual data:', error);
    }
  };

  // Calculate mutual spots
  const mutualSpots = savedSpots.filter((mySpot) =>
    friendLocations.some(
      (friendLoc) =>
        Math.abs(friendLoc.location.latitude - mySpot.location.latitude) <
          0.001 &&
        Math.abs(friendLoc.location.longitude - mySpot.location.longitude) <
          0.001
    )
  );

  const totalActivities = friendActivities.length;

  const getLastActiveText = (lastActive?: Date) => {
    if (!lastActive) return "Offline";

    const now = new Date();
    const diff = now.getTime() - new Date(lastActive).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 5) return "Online now";
    if (hours < 1) return `Active ${minutes}m ago`;
    if (days < 1) return `Active ${hours}h ago`;
    if (days === 1) return "Active yesterday";
    return `Active ${days} days ago`;
  };

  const isOnline =
    friend?.lastActive &&
    new Date().getTime() - new Date(friend.lastActive).getTime() < 300000;

  if (!friend) {
    return (
      <View style={styles.container}>
        <Text>Friend not found</Text>
      </View>
    );
  }

  const handleRemoveFriend = () => {
    Alert.alert(
      "Remove Friend",
      `Are you sure you want to remove ${friend.displayName} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await removeFriend(friend.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    Alert.alert(
      "Block User",
      `Are you sure you want to block ${friend.displayName}? They won't be able to see your content or send you friend requests.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            await blockUser(friend.id);
            router.back();
          },
        },
      ]
    );
  };

  const generateMapHTML = () => {
    const centerLat = friendLocations[0]?.location.latitude || 47.6062;
    const centerLng = friendLocations[0]?.location.longitude || -122.3321;

    const locationMarkers = friendLocations
      .map(
        (loc) => `
      L.circleMarker([${loc.location.latitude}, ${loc.location.longitude}], {
        radius: 8,
        fillColor: '${theme.colors.forest}',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map).bindPopup('${loc.name.replace(/'/g, "\\'")}');
    `
      )
      .join("\n");

    const mutualMarkers = mutualSpots
      .map(
        (spot) => `
      L.circleMarker([${spot.location.latitude}, ${spot.location.longitude}], {
        radius: 10,
        fillColor: '${theme.colors.burntOrange}',
        color: '#fff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map).bindPopup('Mutual: ${spot.name.replace(/'/g, "\\'")}');
    `
      )
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
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([${centerLat}, ${centerLng}], 11);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
          }).addTo(map);
          ${locationMarkers}
          ${mutualMarkers}
        </script>
      </body>
      </html>
    `;
  };

  // Helper function to render avatars with profile picture support
  const renderAvatar = (user: Friend, size: "small" | "large" = "small") => {
    const imageStyle =
      size === "large" ? styles.profileAvatarImage : styles.smallAvatarImage;
    const textStyle =
      size === "large" ? styles.profileAvatarText : styles.smallAvatarText;

    if (user.profile_picture) {
      return (
        <Image source={{ uri: user.profile_picture }} style={imageStyle} />
      );
    }
    return <Text style={textStyle}>{user.avatar || "👤"}</Text>;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: friend.displayName,
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowOptionsModal(true)}
            >
              <Ionicons name="ellipsis-vertical" size={24} color="white" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            {renderAvatar(friend, "large")}
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>

          <Text style={styles.profileName}>{friend.displayName}</Text>
          <Text style={styles.profileUsername}>@{friend.username}</Text>
          <Text style={styles.lastActive}>
            {getLastActiveText(friend.lastActive)}
          </Text>

          <View style={styles.profileActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowPrivacyModal(true)}
            >
              <Ionicons
                name="shield-checkmark"
                size={20}
                color={theme.colors.forest}
              />
              <Text style={styles.actionButtonText}>Privacy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                Alert.alert("Coming Soon", "Messaging feature coming soon!")
              }
            >
              <Ionicons name="chatbubble" size={20} color={theme.colors.navy} />
              <Text style={styles.actionButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {loadingData ? "..." : totalActivities}
            </Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {loadingData ? "..." : friendLocations.length}
            </Text>
            <Text style={styles.statLabel}>Places</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {loadingData ? "..." : friendStats.totalTrips}
            </Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
        </View>

        {/* Mutual Friends Section */}
        {mutualFriends.length > 0 && (
          <View style={styles.mutualSection}>
            <Text style={styles.sectionTitle}>Mutual Friends</Text>
            <View style={styles.mutualCard}>
              <View style={styles.mutualHeader}>
                <Ionicons
                  name="people"
                  size={20}
                  color={theme.colors.forest}
                />
                <Text style={styles.mutualTitle}>
                  {mutualFriends.length} Mutual{" "}
                  {mutualFriends.length === 1 ? "Friend" : "Friends"}
                </Text>
              </View>
              <View style={styles.mutualFriendsList}>
                {mutualFriends.map((mFriend) => (
                  <TouchableOpacity
                    key={mFriend.id}
                    style={styles.mutualFriendItem}
                    onPress={() =>
                      router.push(`/friend-profile/${mFriend.id}` as any)
                    }
                  >
                    <View style={styles.mutualFriendAvatar}>
                      {renderAvatar(mFriend, "small")}
                    </View>
                    <Text style={styles.mutualFriendName}>
                      {mFriend.displayName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Shared Adventures Section */}
        {(mutualTrips.length > 0 || mutualSpots.length > 0 || mutualActivities.length > 0) && (
          <View style={styles.mutualSection}>
            <Text style={styles.sectionTitle}>Shared Adventures</Text>

            {mutualTrips.length > 0 && (
              <View style={styles.mutualCard}>
                <View style={styles.mutualHeader}>
                  <Ionicons
                    name="map"
                    size={20}
                    color={theme.colors.navy}
                  />
                  <Text style={styles.mutualTitle}>
                    {mutualTrips.length} Mutual{" "}
                    {mutualTrips.length === 1 ? "Trip" : "Trips"}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {mutualTrips.map((trip) => (
                    <View key={trip.id} style={styles.mutualTripItem}>
                      <Ionicons
                        name="map-outline"
                        size={16}
                        color={theme.colors.navy}
                      />
                      <Text style={styles.mutualItemName}>{trip.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {mutualSpots.length > 0 && (
              <View style={styles.mutualCard}>
                <View style={styles.mutualHeader}>
                  <Ionicons
                    name="location"
                    size={20}
                    color={theme.colors.burntOrange}
                  />
                  <Text style={styles.mutualTitle}>
                    {mutualSpots.length} Mutual{" "}
                    {mutualSpots.length === 1 ? "Spot" : "Spots"}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {mutualSpots.map((spot, index) => (
                    <View key={index} style={styles.mutualSpotItem}>
                      <Ionicons
                        name="pin"
                        size={16}
                        color={theme.colors.burntOrange}
                      />
                      <Text style={styles.mutualSpotName}>{spot.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {mutualActivities.length > 0 && (
              <View style={styles.mutualCard}>
                <View style={styles.mutualHeader}>
                  <Ionicons
                    name="bicycle"
                    size={20}
                    color={theme.colors.forest}
                  />
                  <Text style={styles.mutualTitle}>
                    {mutualActivities.length} Mutual{" "}
                    {mutualActivities.length === 1 ? "Activity" : "Activities"}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {mutualActivities.map((activity) => (
                    <View key={activity.id} style={styles.mutualActivityItem}>
                      <Ionicons
                        name={activity.type === "bike" ? "bicycle" : "fitness"}
                        size={16}
                        color={theme.colors.forest}
                      />
                      <Text style={styles.mutualItemName}>{activity.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Content Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === "overview" && styles.tabActive]}
            onPress={() => setSelectedTab("overview")}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === "overview" && styles.tabTextActive,
              ]}
            >
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === "activities" && styles.tabActive,
            ]}
            onPress={() => setSelectedTab("activities")}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === "activities" && styles.tabTextActive,
              ]}
            >
              Activities
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === "places" && styles.tabActive]}
            onPress={() => setSelectedTab("places")}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === "places" && styles.tabTextActive,
              ]}
            >
              Places
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === "trips" && styles.tabActive]}
            onPress={() => setSelectedTab("trips")}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === "trips" && styles.tabTextActive,
              ]}
            >
              Trips
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {loadingData ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.forest} />
              <Text style={styles.loadingText}>Loading friend data...</Text>
            </View>
          ) : (
            <>
              {selectedTab === "overview" && (
                <View>
                  {friendLocations.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>Adventure Map</Text>
                      <View style={styles.mapContainer}>
                        <WebView
                          style={styles.map}
                          source={{ html: generateMapHTML() }}
                          javaScriptEnabled={true}
                          domStorageEnabled={true}
                        />
                        <View style={styles.mapLegend}>
                          <View style={styles.legendItem}>
                            <View
                              style={[
                                styles.legendDot,
                                { backgroundColor: theme.colors.forest },
                              ]}
                            />
                            <Text style={styles.legendText}>Their Spots</Text>
                          </View>
                          <View style={styles.legendItem}>
                            <View
                              style={[
                                styles.legendDot,
                                { backgroundColor: theme.colors.burntOrange },
                              ]}
                            />
                            <Text style={styles.legendText}>Mutual</Text>
                          </View>
                        </View>
                      </View>
                    </>
                  )}

                  <View style={styles.friendSince}>
                    <Ionicons
                      name="calendar"
                      size={20}
                      color={theme.colors.gray}
                    />
                    <Text style={styles.friendSinceText}>
                      Friends since{" "}
                      {new Date(friend.friendsSince).toLocaleDateString(
                        "en-US",
                        {
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </Text>
                  </View>
                </View>
              )}

              {selectedTab === "activities" && (
                <View>
                  {friendActivities.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons
                        name="bicycle-outline"
                        size={60}
                        color={theme.colors.lightGray}
                      />
                      <Text style={styles.emptyText}>No activities yet</Text>
                    </View>
                  ) : (
                    friendActivities.map((activity) => (
                      <View key={activity.id} style={styles.activityCard}>
                        <View style={styles.activityHeader}>
                          <View style={styles.activityType}>
                            <Ionicons
                              name={
                                activity.type === "bike" ? "bicycle" : "fitness"
                              }
                              size={20}
                              color={theme.colors.forest}
                            />
                            <Text style={styles.activityTypeName}>
                              {activity.type}
                            </Text>
                          </View>
                          <Text style={styles.activityDate}>
                            {new Date(activity.startTime).toLocaleDateString()}
                          </Text>
                        </View>
                        <Text style={styles.activityName}>{activity.name}</Text>
                        <View style={styles.activityStats}>
                          <View style={styles.activityStat}>
                            <Ionicons
                              name="navigate"
                              size={14}
                              color={theme.colors.gray}
                            />
                            <Text style={styles.activityStatText}>
                              {formatDistance(activity.distance)}
                            </Text>
                          </View>
                          <View style={styles.activityStat}>
                            <Ionicons
                              name="time"
                              size={14}
                              color={theme.colors.gray}
                            />
                            <Text style={styles.activityStatText}>
                              {Math.round(activity.duration / 60)}min
                            </Text>
                          </View>
                          <View style={styles.activityStat}>
                            <Ionicons
                              name="speedometer"
                              size={14}
                              color={theme.colors.gray}
                            />
                            <Text style={styles.activityStatText}>
                              {formatSpeed(activity.averageSpeed)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {selectedTab === "places" && (
                <View>
                  {friendLocations.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons
                        name="location-outline"
                        size={60}
                        color={theme.colors.lightGray}
                      />
                      <Text style={styles.emptyText}>No places yet</Text>
                    </View>
                  ) : (
                    friendLocations.map((location) => (
                      <View key={location.id} style={styles.locationCard}>
                        <View style={styles.locationHeader}>
                          <Ionicons
                            name="location"
                            size={20}
                            color={theme.colors.burntOrange}
                          />
                          <Text style={styles.locationName}>
                            {location.name}
                          </Text>
                        </View>
                        {location.description && (
                          <Text style={styles.locationDescription}>
                            {location.description}
                          </Text>
                        )}
                        <View style={styles.locationMeta}>
                          <Text style={styles.locationCategory}>
                            {location.category}
                          </Text>
                          {mutualSpots.some(
                            (spot) =>
                              Math.abs(
                                spot.location.latitude -
                                  location.location.latitude
                              ) < 0.001
                          ) && (
                            <View style={styles.mutualBadge}>
                              <Text style={styles.mutualBadgeText}>
                                Mutual Spot
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {selectedTab === "trips" && (
                <View>
                  {friendTrips.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons
                        name="map-outline"
                        size={60}
                        color={theme.colors.lightGray}
                      />
                      <Text style={styles.emptyText}>No trips yet</Text>
                    </View>
                  ) : (
                    friendTrips.map((trip) => (
                      <View key={trip.id} style={styles.tripCard}>
                        <View style={styles.tripHeader}>
                          <Ionicons
                            name="map"
                            size={20}
                            color={theme.colors.navy}
                          />
                          <Text style={styles.tripName}>{trip.name}</Text>
                        </View>
                        <View style={styles.tripDates}>
                          <Ionicons
                            name="calendar-outline"
                            size={14}
                            color={theme.colors.gray}
                          />
                          <Text style={styles.tripDateText}>
                            {new Date(trip.start_date).toLocaleDateString()} -{" "}
                            {new Date(trip.end_date).toLocaleDateString()}
                          </Text>
                        </View>
                        <View style={styles.tripStats}>
                          <View style={styles.tripStat}>
                            <Ionicons
                              name="bicycle"
                              size={14}
                              color={theme.colors.gray}
                            />
                            <Text style={styles.tripStatText}>
                              {trip.trip_items.filter((item: any) => item.type === 'activity').length} activities
                            </Text>
                          </View>
                          <View style={styles.tripStat}>
                            <Ionicons
                              name="location"
                              size={14}
                              color={theme.colors.gray}
                            />
                            <Text style={styles.tripStatText}>
                              {trip.trip_items.filter((item: any) => item.type === 'spot').length} spots
                            </Text>
                          </View>
                        </View>
                        {mutualTrips.some(mt => mt.id === trip.id) && (
                          <View style={styles.mutualBadge}>
                            <Text style={styles.mutualBadgeText}>
                              Mutual Trip
                            </Text>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Privacy Settings Modal */}
      <PrivacySettingsModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        friend={friend}
        settings={friendPrivacySettings}
        onUpdateSettings={(settings) => {
          setFriendPrivacySettings(settings);
          Alert.alert("Success", "Privacy settings updated");
        }}
      />

      {/* Options Modal */}
      <Modal
        visible={showOptionsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.optionsModal}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsModal(false);
                setShowPrivacyModal(true);
              }}
            >
              <Ionicons
                name="shield-checkmark"
                size={22}
                color={theme.colors.forest}
              />
              <Text style={styles.optionText}>Privacy Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsModal(false);
                handleRemoveFriend();
              }}
            >
              <Ionicons
                name="person-remove"
                size={22}
                color={theme.colors.burntOrange}
              />
              <Text style={styles.optionText}>Remove Friend</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionItem, styles.optionDanger]}
              onPress={() => {
                setShowOptionsModal(false);
                handleBlockUser();
              }}
            >
              <Ionicons name="ban" size={22} color="#FF4757" />
              <Text style={[styles.optionText, { color: "#FF4757" }]}>
                Block User
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionItem, styles.optionCancel]}
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={styles.optionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: theme.colors.gray,
  },
  headerButton: {
    marginRight: 10,
  },
  profileHeader: {
    backgroundColor: "white",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: 15,
    borderWidth: 2,
    borderColor: theme.colors.borderGray,
    overflow: "hidden",
  },
  profileAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
  },
  profileAvatarText: {
    fontSize: 48,
  },
  smallAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  smallAvatarText: {
    fontSize: 20,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
    borderWidth: 3,
    borderColor: "white",
  },
  profileName: {
    fontSize: 24,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 5,
  },
  profileUsername: {
    fontSize: 16,
    color: theme.colors.gray,
    marginBottom: 5,
  },
  lastActive: {
    fontSize: 14,
    color: theme.colors.lightGray,
    marginBottom: 20,
  },
  profileActions: {
    flexDirection: "row",
    gap: 15,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionButtonText: {
    fontSize: 14,
    color: theme.colors.navy,
    marginLeft: 5,
    fontWeight: "500",
  },
  statsSection: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    paddingVertical: 20,
    marginTop: 10,
  },
  statCard: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 4,
  },
  mutualSection: {
    backgroundColor: "white",
    padding: 15,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 15,
  },
  mutualCard: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  mutualHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  mutualTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.navy,
    marginLeft: 8,
  },
  mutualSpotItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
  },
  mutualSpotName: {
    fontSize: 12,
    color: theme.colors.navy,
    marginLeft: 5,
  },
  mutualTripItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
  },
  mutualActivityItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
  },
  mutualItemName: {
    fontSize: 12,
    color: theme.colors.navy,
    marginLeft: 5,
  },
  mutualFriendsList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  mutualFriendItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  mutualFriendAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  mutualFriendName: {
    fontSize: 12,
    color: theme.colors.navy,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
    marginTop: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.forest,
  },
  tabText: {
    fontSize: 14,
    color: theme.colors.gray,
    fontWeight: "500",
  },
  tabTextActive: {
    color: theme.colors.forest,
  },
  tabContent: {
    backgroundColor: "white",
    padding: 15,
    minHeight: 300,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    marginBottom: 15,
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
  friendSince: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
  },
  friendSinceText: {
    fontSize: 14,
    color: theme.colors.gray,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.lightGray,
    marginTop: 10,
  },
  activityCard: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  activityType: {
    flexDirection: "row",
    alignItems: "center",
  },
  activityTypeName: {
    fontSize: 14,
    color: theme.colors.forest,
    marginLeft: 5,
    fontWeight: "500",
  },
  activityDate: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  activityName: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
    marginBottom: 10,
  },
  activityStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  activityStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  activityStatText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginLeft: 4,
  },
  locationCard: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  locationName: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
    marginLeft: 8,
    flex: 1,
  },
  locationDescription: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: 10,
  },
  locationMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationCategory: {
    fontSize: 12,
    color: theme.colors.gray,
    textTransform: "capitalize",
  },
  tripCard: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  tripHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tripName: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
    marginLeft: 8,
    flex: 1,
  },
  tripDates: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  tripDateText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginLeft: 5,
  },
  tripStats: {
    flexDirection: "row",
    gap: 15,
  },
  tripStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  tripStatText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginLeft: 4,
  },
  mutualBadge: {
    backgroundColor: theme.colors.burntOrange + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  mutualBadgeText: {
    fontSize: 11,
    color: theme.colors.burntOrange,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  optionsModal: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  optionText: {
    fontSize: 16,
    color: theme.colors.navy,
    marginLeft: 15,
  },
  optionDanger: {
    borderBottomWidth: 0,
  },
  optionCancel: {
    justifyContent: "center",
    borderBottomWidth: 0,
    marginTop: 10,
  },
  optionCancelText: {
    fontSize: 16,
    color: theme.colors.gray,
    fontWeight: "600",
  },
});

// Privacy Modal Styles
const privacyStyles = StyleSheet.create({
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
  subtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
    marginTop: 15,
    marginHorizontal: 20,
  },
  settingsList: {
    padding: 20,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: theme.colors.gray,
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
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: theme.colors.forest,
  },
  saveText: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
  },
});