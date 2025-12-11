// past-activities.tsx - Complete file with unit support
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import AddToTripButton from "../components/AddToTripButton";
import { ShareWithFriendsModal } from "../components/ShareWithFriendsModal";
import { theme } from "../constants/theme";
import { ActivityType, useActivity } from "../contexts/ActivityContext";
import { useFriends } from "../contexts/FriendsContext";
import { useSettings } from "../contexts/SettingsContext";
import { ShareService } from "../services/shareService";
import * as Haptics from "expo-haptics";

const activityIcons: Record<ActivityType, string> = {
  bike: "bicycle",
  run: "walk",
  walk: "footsteps",
  hike: "trail-sign",
  paddleboard: "boat",
  climb: "trending-up",
  other: "fitness",
};

export default function PastActivitiesScreen() {
  const { activities, deleteActivity, updateActivity } = useActivity();
  const { shareActivity, friends, privacySettings } = useFriends();
  const { formatDistance, formatSpeed, settings } = useSettings();
  const router = useRouter();

  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [showMap, setShowMap] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<ActivityType | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "distance" | "duration">(
    "recent"
  );
  const [showShareModal, setShowShareModal] = useState(false);
  const [activityToShare, setActivityToShare] = useState<any>(null);
  const [autoShareEnabled, setAutoShareEnabled] = useState(
    privacySettings.shareActivitiesWithFriends
  );
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [selectedActivityPhotos, setSelectedActivityPhotos] = useState<
    string[]
  >([]);

  const photoScrollRef = useRef<ScrollView>(null);

  // Filter and sort activities
  const filteredActivities = useMemo(() => {
    let filtered = activities;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (activity) =>
          activity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (activity.notes &&
            activity.notes.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by activity type
    if (selectedType !== "all") {
      filtered = filtered.filter((activity) => activity.type === selectedType);
    }

    // Sort activities
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "distance":
          return b.distance - a.distance;
        case "duration":
          return b.duration - a.duration;
        case "recent":
        default:
          return (
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          );
      }
    });

    return sorted;
  }, [activities, searchQuery, selectedType, sortBy]);

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) {
      return "0 min";
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs} seconds`;
    }
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleDeleteActivity = (id: string, name: string) => {
    Alert.alert(
      "Delete Activity",
      `Are you sure you want to delete "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteActivity(id),
        },
      ]
    );
  };

  const handleViewMap = (activity: any) => {
    setSelectedActivity(activity);
    setShowMap(true);
  };

  const handleShareActivity = async (activity: any) => {
    try {
      const shareOptions = {
        units: settings.units,
      };

      if (activity.route && activity.route.length > 0) {
        await ShareService.shareActivityWithMap(activity, shareOptions);
      } else {
        await ShareService.shareActivity(activity, shareOptions);
      }
    } catch (error) {
      console.error("Error sharing activity:", error);
      Alert.alert("Error", "Failed to share activity");
    }
  };

  const handleShareWithFriends = (activity: any) => {
    if (friends.filter((f) => f.status === "accepted").length === 0) {
      Alert.alert(
        "No Friends Yet",
        "Add some friends to share your activities with them!",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Find Friends", onPress: () => router.push("/friends") },
        ]
      );
      return;
    }
    setActivityToShare(activity);
    setShowShareModal(true);
  };

  const handleShareToFriends = async (
    selectedFriends: string[],
    message?: string
  ) => {
    try {
      await shareActivity(activityToShare.id, selectedFriends);
      Alert.alert("Success", "Activity shared with friends!");
      setShowShareModal(false);
      setActivityToShare(null);
    } catch (error) {
      Alert.alert("Error", "Failed to share activity with friends");
    }
  };

  const handleCopyActivity = async (activity: any) => {
    try {
      await ShareService.copyActivityToClipboard(activity, {
        units: settings.units,
      });
      Alert.alert("Copied!", "Activity details copied to clipboard");
    } catch (error) {
      console.error("Error copying activity:", error);
      Alert.alert("Error", "Failed to copy activity");
    }
  };

  const handleShareSummary = async () => {
    try {
      const totalDistance = filteredActivities.reduce(
        (sum, act) => sum + act.distance,
        0
      );
      const totalDuration = filteredActivities.reduce(
        (sum, act) => sum + act.duration,
        0
      );

      let message = `🏃 My ExplorAble Adventure Summary\n\n`;
      message += `📊 Total Stats:\n`;
      message += `• ${filteredActivities.length} activities completed\n`;
      message += `• ${formatDistance(totalDistance)} total distance\n`;
      message += `• ${ShareService.formatDuration(
        totalDuration
      )} total time\n\n`;

      message += `🎯 Recent Activities:\n`;
      filteredActivities.slice(0, 5).forEach((activity, index) => {
        const emoji = ShareService.getActivityEmoji(activity.type);
        message += `${index + 1}. ${emoji} ${activity.name} - ${formatDistance(
          activity.distance
        )}\n`;
      });

      if (filteredActivities.length > 5) {
        message += `\n... and ${
          filteredActivities.length - 5
        } more activities!\n`;
      }

      message += `\nShared from ExplorAble 🌲`;

      await Share.share({
        message,
        title: "My Adventure Summary",
      });
    } catch (error) {
      console.error("Error sharing summary:", error);
    }
  };

  const generateActivityMapHTML = () => {
    if (
      !selectedActivity ||
      !selectedActivity.route ||
      selectedActivity.route.length === 0
    ) {
      return "<html><body><p>No route data available</p></body></html>";
    }

    const route = selectedActivity.route;
    const routeCoords = route
      .map((point: any) => `[${point.latitude}, ${point.longitude}]`)
      .join(",");

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
          .info-box {
            position: absolute;
            top: 10px;
            left: 10px;
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 1000;
          }
        </style>
      </head>
      <body>
        <div class="info-box">
          <strong>${selectedActivity.name}</strong><br>
          Distance: ${formatDistance(selectedActivity.distance)}<br>
          Duration: ${formatDuration(selectedActivity.duration)}
        </div>
        <div id="map"></div>
        <script>
          var map = L.map('map');
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          var routeCoords = [${routeCoords}];
          if (routeCoords.length > 0) {
            var polyline = L.polyline(routeCoords, {
              color: '${theme.colors.forest}',
              weight: 4,
              opacity: 0.8
            }).addTo(map);

            var startIcon = L.divIcon({
              html: '<div style="background-color: ${
                theme.colors.forest
              }; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [24, 24],
              className: 'custom-div-icon'
            });
            L.marker(routeCoords[0], { icon: startIcon })
              .addTo(map)
              .bindPopup('Start');

            var endIcon = L.divIcon({
              html: '<div style="background-color: ${
                theme.colors.burntOrange
              }; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [24, 24],
              className: 'custom-div-icon'
            });
            L.marker(routeCoords[routeCoords.length - 1], { icon: endIcon })
              .addTo(map)
              .bindPopup('Finish');

            map.fitBounds(polyline.getBounds().pad(0.1));
          }
        </script>
      </body>
      </html>
    `;
  };

  const renderActivityItem = ({ item }: { item: any }) => {
    const iconName = (activityIcons as any)[item.type] || "fitness";

    const handleUpdateRating = async (activity: any, rating: number) => {
      try {
        await updateActivity(activity.id, { rating });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.error("Error updating rating:", error);
        Alert.alert("Error", "Failed to update rating");
      }
    };

    const formatActivityDate = (date: Date | string) => {
      const d = new Date(date);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const todayOnly = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const yesterdayOnly = new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate()
      );

      if (dateOnly.getTime() === todayOnly.getTime()) {
        return "Today";
      }
      if (dateOnly.getTime() === yesterdayOnly.getTime()) {
        return "Yesterday";
      }

      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    };

    return (
      <TouchableOpacity
        style={styles.activityCard}
        onPress={() => handleViewMap(item)}
        activeOpacity={0.7}
      >
        <View style={styles.activityHeader}>
          <View style={styles.activityIcon}>
            <Ionicons
              name={iconName as any}
              size={24}
              color={theme.colors.forest}
            />
          </View>
          <View style={styles.activityInfo}>
            <Text style={styles.activityName}>{item.name}</Text>
            <View style={styles.activityDateRow}>
              <Text style={styles.activityDate}>
                {formatActivityDate(item.activityDate || item.startTime)}
              </Text>
              <Text style={styles.activityTime}>
                {" at " + formatTime(item.startTime)}
              </Text>
            </View>
          </View>
          {item.isManualEntry && (
            <View style={styles.manualBadge}>
              <Text style={styles.manualBadgeText}>Manual</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>
              {formatDistance(item.distance)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>
              {formatDuration(item.duration)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Avg Speed</Text>
            <Text style={styles.statValue}>
              {formatSpeed(item.averageSpeed)}
            </Text>
          </View>
        </View>

        {/* Rating Row */}
        <View style={styles.ratingRow}>
          <Text style={styles.ratingLabel}>Rating:</Text>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleUpdateRating(item, star)}
              >
                <Ionicons
                  name={star <= (item.rating || 0) ? "star" : "star-outline"}
                  size={22}
                  color="#FFB800"
                  style={styles.star}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {item.photos && item.photos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.activityPhotos}
          >
            {item.photos.map((photo: string, index: number) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setSelectedPhotoIndex(index);
                  setSelectedActivityPhotos(item.photos);
                  setSelectedPhoto(photo);
                }}
              >
                <Image source={{ uri: photo }} style={styles.activityPhoto} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {item.notes && (
          <Text style={styles.notes} numberOfLines={2}>
            {item.notes}
          </Text>
        )}

        <View style={styles.activityActions}>
          <AddToTripButton
            item={item}
            type="activity"
            iconSize={28}
            style={styles.actionButton}
          />

          <TouchableOpacity
            style={[styles.actionButton, styles.shareButtonStyle]}
            onPress={() => handleShareActivity(item)}
          >
            <Ionicons
              name="share-social-outline"
              size={22}
              color={theme.colors.forest}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.friendsButton]}
            onPress={() => handleShareWithFriends(item)}
          >
            <Ionicons
              name="people-outline"
              size={22}
              color={theme.colors.navy}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.mapButton]}
            onPress={() => handleViewMap(item)}
          >
            <Ionicons name="map-outline" size={22} color={theme.colors.gray} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => router.push(`/edit-activity?activityId=${item.id}`)}
          >
            <Ionicons
              name="create-outline"
              size={22}
              color={theme.colors.navy}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.copyButton]}
            onPress={() => handleCopyActivity(item)}
          >
            <Ionicons name="copy-outline" size={22} color={theme.colors.gray} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteActivity(item.id, item.name)}
          >
            <Ionicons
              name="trash-outline"
              size={22}
              color={theme.colors.burntOrange}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (showMap && selectedActivity) {
    return (
      <View style={styles.container}>
        <View style={styles.mapHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowMap(false)}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.forest} />
            <Text style={styles.backButtonText}>Back to List</Text>
          </TouchableOpacity>
        </View>
        <WebView
          style={styles.map}
          source={{ html: generateActivityMapHTML() }}
          scrollEnabled={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    );
  }

  const totalDistance = filteredActivities.reduce(
    (sum, act) => sum + act.distance,
    0
  );
  const totalDuration = filteredActivities.reduce(
    (sum, act) => sum + act.duration,
    0
  );
  const totalActivities = filteredActivities.length;

  if (activities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="fitness-outline"
          size={80}
          color={theme.colors.lightGray}
        />
        <Text style={styles.emptyText}>No activities yet</Text>
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => router.push("/track-activity")}
        >
          <Text style={styles.startButtonText}>Start Your First Activity</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Auto-share Toggle Bar */}
      {friends.filter((f) => f.status === "accepted").length > 0 && (
        <View style={styles.autoShareBar}>
          <View style={styles.autoShareContent}>
            <Ionicons name="people" size={20} color={theme.colors.forest} />
            <Text style={styles.autoShareText}>Auto-share with friends</Text>
          </View>
          <Switch
            value={autoShareEnabled}
            onValueChange={(value) => {
              setAutoShareEnabled(value);
            }}
            trackColor={{
              false: theme.colors.borderGray,
              true: theme.colors.forest,
            }}
            thumbColor={
              autoShareEnabled ? theme.colors.white : theme.colors.lightGray
            }
          />
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.colors.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search activities..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.lightGray}
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.colors.gray}
              />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons
            name="filter"
            size={20}
            color={
              selectedType !== "all" || sortBy !== "recent"
                ? theme.colors.burntOrange
                : theme.colors.gray
            }
          />
          {(selectedType !== "all" || sortBy !== "recent") && (
            <View style={styles.filterIndicatorDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Options */}
      {showFilters && (
        <View style={styles.filterContainer}>
          <Text style={styles.filterTitle}>Activity Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedType === "all" && styles.filterChipActive,
              ]}
              onPress={() => setSelectedType("all")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedType === "all" && styles.filterChipTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {Object.entries(activityIcons).map(([type, icon]) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterChip,
                  selectedType === type && styles.filterChipActive,
                ]}
                onPress={() => setSelectedType(type as ActivityType)}
              >
                <Ionicons
                  name={icon as any}
                  size={16}
                  color={
                    selectedType === type
                      ? theme.colors.white
                      : theme.colors.gray
                  }
                />
                <Text
                  style={[
                    styles.filterChipText,
                    selectedType === type && styles.filterChipTextActive,
                  ]}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterTitle}>Sort By</Text>
          <View style={styles.sortOptions}>
            <TouchableOpacity
              style={[
                styles.sortChip,
                sortBy === "recent" && styles.sortChipActive,
              ]}
              onPress={() => setSortBy("recent")}
            >
              <Text
                style={[
                  styles.sortChipText,
                  sortBy === "recent" && styles.sortChipTextActive,
                ]}
              >
                Most Recent
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sortChip,
                sortBy === "distance" && styles.sortChipActive,
              ]}
              onPress={() => setSortBy("distance")}
            >
              <Text
                style={[
                  styles.sortChipText,
                  sortBy === "distance" && styles.sortChipTextActive,
                ]}
              >
                Distance
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sortChip,
                sortBy === "duration" && styles.sortChipActive,
              ]}
              onPress={() => setSortBy("duration")}
            >
              <Text
                style={[
                  styles.sortChipText,
                  sortBy === "duration" && styles.sortChipTextActive,
                ]}
              >
                Duration
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Summary Stats */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalActivities}</Text>
          <Text style={styles.summaryLabel}>
            {selectedType === "all" ? "Activities" : selectedType}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {formatDistance(totalDistance)}
          </Text>
          <Text style={styles.summaryLabel}>Total Distance</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {formatDuration(totalDuration)}
          </Text>
          <Text style={styles.summaryLabel}>Total Time</Text>
        </View>
      </View>

      {activities.length > 0 && (
        <View style={styles.shareAllContainer}>
          <TouchableOpacity
            style={styles.shareAllButton}
            onPress={handleShareSummary}
          >
            <Ionicons
              name="share-outline"
              size={20}
              color={theme.colors.forest}
            />
            <Text style={styles.shareAllButtonText}>
              Share Activity Summary
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {filteredActivities.length > 0 ? (
        <FlatList
          data={filteredActivities}
          renderItem={renderActivityItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.noResultsContainer}>
          <Ionicons
            name="search-outline"
            size={60}
            color={theme.colors.lightGray}
          />
          <Text style={styles.noResultsText}>No activities found</Text>
          {searchQuery !== "" && (
            <Text style={styles.noResultsSubtext}>
              Try adjusting your search
            </Text>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.floatingAddButton}
        onPress={() => router.push("/track-activity")}
      >
        <Ionicons name="add" size={30} color={theme.colors.white} />
      </TouchableOpacity>

      {/* Share with Friends Modal */}
      <ShareWithFriendsModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        item={activityToShare}
        itemType="activity"
        onShare={handleShareToFriends}
        formatDistance={formatDistance}
      />

      {/* Photo Viewer Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
        onShow={() => {
          setTimeout(() => {
            photoScrollRef.current?.scrollTo({
              x: selectedPhotoIndex * Dimensions.get("window").width,
              y: 0,
              animated: false,
            });
          }, 50);
        }}
      >
        <View style={styles.photoModal}>
          <ScrollView
            ref={photoScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x /
                  Dimensions.get("window").width
              );
              if (
                index !== selectedPhotoIndex &&
                index >= 0 &&
                index < selectedActivityPhotos.length
              ) {
                setSelectedPhotoIndex(index);
              }
            }}
            scrollEventThrottle={16}
          >
            {selectedActivityPhotos.map((photo: string, index: number) => (
              <View key={index} style={styles.fullPhotoContainer}>
                <Image source={{ uri: photo }} style={styles.fullPhoto} />
              </View>
            ))}
          </ScrollView>

          <View style={styles.photoIndicator}>
            <Text style={styles.photoIndicatorText}>
              {selectedPhotoIndex + 1} / {selectedActivityPhotos.length}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.closePhotoButton}
            onPress={() => {
              setSelectedPhoto(null);
              setSelectedActivityPhotos([]);
            }}
          >
            <Ionicons name="close-circle" size={40} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  autoShareBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.forest + "10",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.forest + "20",
  },
  autoShareContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  autoShareText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.forest,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: theme.colors.offWhite,
  },
  emptyText: {
    fontSize: 18,
    color: theme.colors.gray,
    marginTop: 20,
    marginBottom: 30,
  },
  startButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  summaryContainer: {
    flexDirection: "row",
    backgroundColor: theme.colors.forest,
    padding: 20,
    borderBottomWidth: 0,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.white,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.white + "CC",
    marginTop: 4,
  },
  shareAllContainer: {
    paddingHorizontal: 15,
    paddingBottom: 10,
    backgroundColor: theme.colors.white,
  },
  shareAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.forest + "10",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.forest,
  },
  shareAllButtonText: {
    color: theme.colors.forest,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  listContainer: {
    padding: 15,
    paddingBottom: 100,
  },
  activityCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.forest + "15",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  filterIndicatorDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.burntOrange,
  },
  manualBadge: {
    backgroundColor: theme.colors.burntOrange + "20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.burntOrange,
  },
  manualBadgeText: {
    fontSize: 11,
    color: theme.colors.burntOrange,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  notes: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 10,
    fontStyle: "italic",
  },
  activityActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.offWhite,
  },
  shareButtonStyle: {
    backgroundColor: theme.colors.forest + "10",
  },
  friendsButton: {
    backgroundColor: theme.colors.navy + "10",
  },
  mapButton: {
    backgroundColor: theme.colors.gray + "10",
  },
  copyButton: {
    backgroundColor: "transparent",
  },
  deleteButton: {
    backgroundColor: "transparent",
  },
  editButton: {
    backgroundColor: theme.colors.navy + "10",
  },
  mapHeader: {
    backgroundColor: theme.colors.white,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButtonText: {
    color: theme.colors.forest,
    fontSize: 16,
    marginLeft: 8,
    fontWeight: "500",
  },
  map: {
    flex: 1,
  },
  floatingAddButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.burntOrange,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  searchContainer: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: theme.colors.navy,
    borderBottomWidth: 0,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
    color: theme.colors.navy,
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterContainer: {
    backgroundColor: theme.colors.navy + "F5",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.navy,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.white,
    marginLeft: 15,
    marginBottom: 10,
  },
  filterScroll: {
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme.colors.forest,
  },
  filterChipText: {
    fontSize: 14,
    color: theme.colors.gray,
    marginLeft: 6,
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  sortOptions: {
    flexDirection: "row",
    paddingHorizontal: 15,
  },
  sortChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    marginRight: 8,
  },
  sortChipActive: {
    backgroundColor: theme.colors.forest,
  },
  sortChipText: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  sortChipTextActive: {
    color: theme.colors.white,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  noResultsText: {
    fontSize: 18,
    color: theme.colors.gray,
    marginTop: 20,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 8,
  },
  activityPhotos: {
    marginVertical: 10,
    paddingVertical: 5,
  },
  activityPhoto: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 10,
  },
  photoModal: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullPhoto: {
    width: "90%",
    height: "70%",
    resizeMode: "contain",
  },
  closePhotoButton: {
    position: "absolute",
    top: 50,
    right: 20,
  },
  fullPhotoContainer: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    justifyContent: "center",
    alignItems: "center",
  },
  photoIndicator: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  photoIndicatorText: {
    color: "white",
    fontSize: 14,
  },
  activityDateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  activityDate: {
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  activityTime: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  ratingLabel: {
    fontSize: 14,
    color: theme.colors.gray,
    marginRight: 10,
  },
  ratingContainer: {
    flexDirection: "row",
  },
  star: {
    marginRight: 4,
  },
});