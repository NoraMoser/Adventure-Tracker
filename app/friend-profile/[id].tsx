// app/friend-profile/[id].tsx

import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { FriendOptionsModal } from "../../components/FriendOptionsModal";
import { PrivacySettingsModal } from "../../components/PrivacySettingsModal";
import { theme } from "../../constants/theme";
import { Friend } from "../../contexts/FriendsContext";
import { useSettings } from "../../contexts/SettingsContext";
import { useFriendProfile } from "../../hooks/useFriendProfile";
import { getLastActiveText, isOnlineNow, formatFriendsSince } from "../../utils/date";

type TabType = "overview" | "activities" | "places" | "trips";

export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { formatDistance, formatSpeed } = useSettings();

  const [selectedTab, setSelectedTab] = useState<TabType>("overview");
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [friendPrivacySettings, setFriendPrivacySettings] = useState({});

  const {
    friend,
    friendActivities,
    friendLocations,
    friendTrips,
    friendStats,
    mutualFriends,
    mutualTrips,
    mutualActivities,
    mutualSpots,
    loadingData,
    handleRemoveFriend,
    handleBlockUser,
  } = useFriendProfile(id as string, () => router.back());

  if (!friend) {
    return (
      <View style={styles.container}>
        <Text>Friend not found</Text>
      </View>
    );
  }

  const isOnline = isOnlineNow(friend.lastActive);

  const renderAvatar = (user: Friend, size: "small" | "large" = "small") => {
    const imageStyle = size === "large" ? styles.profileAvatarImage : styles.smallAvatarImage;
    const textStyle = size === "large" ? styles.profileAvatarText : styles.smallAvatarText;

    if (user.profile_picture) {
      return <Image source={{ uri: user.profile_picture }} style={imageStyle} />;
    }
    return <Text style={textStyle}>{user.avatar || "👤"}</Text>;
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

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: friend.displayName,
          headerStyle: { backgroundColor: theme.colors.forest },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "bold" },
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
              <Ionicons name="shield-checkmark" size={20} color={theme.colors.forest} />
              <Text style={styles.actionButtonText}>Privacy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert("Coming Soon", "Messaging feature coming soon!")}
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
              {loadingData ? "..." : friendActivities.length}
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
                <Ionicons name="people" size={20} color={theme.colors.forest} />
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
                    onPress={() => router.push(`/friend-profile/${mFriend.id}` as any)}
                  >
                    <View style={styles.mutualFriendAvatar}>
                      {renderAvatar(mFriend, "small")}
                    </View>
                    <Text style={styles.mutualFriendName}>{mFriend.displayName}</Text>
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
                  <Ionicons name="map" size={20} color={theme.colors.navy} />
                  <Text style={styles.mutualTitle}>
                    {mutualTrips.length} Mutual {mutualTrips.length === 1 ? "Trip" : "Trips"}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {mutualTrips.map((trip) => (
                    <View key={trip.id} style={styles.mutualItemChip}>
                      <Ionicons name="map-outline" size={16} color={theme.colors.navy} />
                      <Text style={styles.mutualItemName}>{trip.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {mutualSpots.length > 0 && (
              <View style={styles.mutualCard}>
                <View style={styles.mutualHeader}>
                  <Ionicons name="location" size={20} color={theme.colors.burntOrange} />
                  <Text style={styles.mutualTitle}>
                    {mutualSpots.length} Mutual {mutualSpots.length === 1 ? "Spot" : "Spots"}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {mutualSpots.map((spot, index) => (
                    <View key={index} style={styles.mutualItemChip}>
                      <Ionicons name="pin" size={16} color={theme.colors.burntOrange} />
                      <Text style={styles.mutualItemName}>{spot.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {mutualActivities.length > 0 && (
              <View style={styles.mutualCard}>
                <View style={styles.mutualHeader}>
                  <Ionicons name="bicycle" size={20} color={theme.colors.forest} />
                  <Text style={styles.mutualTitle}>
                    {mutualActivities.length} Mutual{" "}
                    {mutualActivities.length === 1 ? "Activity" : "Activities"}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {mutualActivities.map((activity) => (
                    <View key={activity.id} style={styles.mutualItemChip}>
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
          {(["overview", "activities", "places", "trips"] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selectedTab === tab && styles.tabActive]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
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
                            <View style={[styles.legendDot, { backgroundColor: theme.colors.forest }]} />
                            <Text style={styles.legendText}>Their Spots</Text>
                          </View>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: theme.colors.burntOrange }]} />
                            <Text style={styles.legendText}>Mutual</Text>
                          </View>
                        </View>
                      </View>
                    </>
                  )}

                  <View style={styles.friendSince}>
                    <Ionicons name="calendar" size={20} color={theme.colors.gray} />
                    <Text style={styles.friendSinceText}>
                      Friends since {formatFriendsSince(friend.friendsSince)}
                    </Text>
                  </View>
                </View>
              )}

              {selectedTab === "activities" && (
                <View>
                  {friendActivities.length === 0 ? (
                    <EmptyState icon="bicycle-outline" text="No activities yet" />
                  ) : (
                    friendActivities.map((activity) => (
                      <View key={activity.id} style={styles.activityCard}>
                        <View style={styles.activityHeader}>
                          <View style={styles.activityType}>
                            <Ionicons
                              name={activity.type === "bike" ? "bicycle" : "fitness"}
                              size={20}
                              color={theme.colors.forest}
                            />
                            <Text style={styles.activityTypeName}>{activity.type}</Text>
                          </View>
                          <Text style={styles.activityDate}>
                            {new Date(activity.startTime).toLocaleDateString()}
                          </Text>
                        </View>
                        <Text style={styles.activityName}>{activity.name}</Text>
                        <View style={styles.activityStats}>
                          <View style={styles.activityStat}>
                            <Ionicons name="navigate" size={14} color={theme.colors.gray} />
                            <Text style={styles.activityStatText}>
                              {formatDistance(activity.distance)}
                            </Text>
                          </View>
                          <View style={styles.activityStat}>
                            <Ionicons name="time" size={14} color={theme.colors.gray} />
                            <Text style={styles.activityStatText}>
                              {Math.round(activity.duration / 60)}min
                            </Text>
                          </View>
                          <View style={styles.activityStat}>
                            <Ionicons name="speedometer" size={14} color={theme.colors.gray} />
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
                    <EmptyState icon="location-outline" text="No places yet" />
                  ) : (
                    friendLocations.map((location) => (
                      <View key={location.id} style={styles.locationCard}>
                        <View style={styles.locationHeader}>
                          <Ionicons name="location" size={20} color={theme.colors.burntOrange} />
                          <Text style={styles.locationName}>{location.name}</Text>
                        </View>
                        {location.description && (
                          <Text style={styles.locationDescription}>{location.description}</Text>
                        )}
                        <View style={styles.locationMeta}>
                          <Text style={styles.locationCategory}>{location.category}</Text>
                          {mutualSpots.some(
                            (spot) =>
                              Math.abs(spot.location.latitude - location.location.latitude) < 0.001
                          ) && (
                            <View style={styles.mutualBadge}>
                              <Text style={styles.mutualBadgeText}>Mutual Spot</Text>
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
                    <EmptyState icon="map-outline" text="No trips yet" />
                  ) : (
                    friendTrips.map((trip) => (
                      <View key={trip.id} style={styles.tripCard}>
                        <View style={styles.tripHeader}>
                          <Ionicons name="map" size={20} color={theme.colors.navy} />
                          <Text style={styles.tripName}>{trip.name}</Text>
                        </View>
                        <View style={styles.tripDates}>
                          <Ionicons name="calendar-outline" size={14} color={theme.colors.gray} />
                          <Text style={styles.tripDateText}>
                            {new Date(trip.start_date).toLocaleDateString()} -{" "}
                            {new Date(trip.end_date).toLocaleDateString()}
                          </Text>
                        </View>
                        <View style={styles.tripStats}>
                          <View style={styles.tripStat}>
                            <Ionicons name="bicycle" size={14} color={theme.colors.gray} />
                            <Text style={styles.tripStatText}>
                              {trip.trip_items.filter((item: any) => item.type === "activity").length}{" "}
                              activities
                            </Text>
                          </View>
                          <View style={styles.tripStat}>
                            <Ionicons name="location" size={14} color={theme.colors.gray} />
                            <Text style={styles.tripStatText}>
                              {trip.trip_items.filter((item: any) => item.type === "spot").length} spots
                            </Text>
                          </View>
                        </View>
                        {mutualTrips.some((mt) => mt.id === trip.id) && (
                          <View style={styles.mutualBadge}>
                            <Text style={styles.mutualBadgeText}>Mutual Trip</Text>
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

      {/* Modals */}
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

      <FriendOptionsModal
        visible={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        onPrivacySettings={() => setShowPrivacyModal(true)}
        onRemoveFriend={handleRemoveFriend}
        onBlockUser={handleBlockUser}
      />
    </View>
  );
}

// Simple empty state component
function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon as any} size={60} color={theme.colors.lightGray} />
      <Text style={styles.emptyText}>{text}</Text>
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
  mutualItemChip: {
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
});