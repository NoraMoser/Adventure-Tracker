import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
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
import { theme } from "../constants/theme";
import { categories } from "../constants/categories";
import { useActivity } from "../contexts/ActivityContext";
import { useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext";

const activityIcons: Record<string, string> = {
  bike: "bicycle",
  run: "walk",
  walk: "footsteps",
  hike: "trail-sign",
  paddleboard: "boat",
  climb: "trending-up",
  other: "fitness",
};

export default function TopRatedScreen() {
  const router = useRouter();
  const { savedSpots, updateSpot } = useLocation();
  const { activities, updateActivity } = useActivity();
  const { formatDistance } = useSettings();
  const [activeTab, setActiveTab] = useState<"all" | "spots" | "activities">("all");

  const topRatedSpots = savedSpots
    .filter((s) => s.rating && s.rating >= 4)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const topRatedActivities = activities
    .filter((a) => a.rating && a.rating >= 4)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const handleSpotRating = async (spotId: string, rating: number) => {
    try {
      const spot = savedSpots.find((s) => s.id === spotId);
      if (spot) {
        await updateSpot(spotId, { ...spot, rating });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update rating");
    }
  };

  const handleActivityRating = async (activityId: string, rating: number) => {
    try {
      await updateActivity(activityId, { rating });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert("Error", "Failed to update rating");
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const renderStars = (
    rating: number,
    onRate: (rating: number) => void
  ) => (
    <View style={styles.ratingContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onRate(star)}>
          <Ionicons
            name={star <= rating ? "star" : "star-outline"}
            size={20}
            color="#FFB800"
            style={styles.star}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSpotCard = (spot: any) => {
    const category = categories[spot.category] || categories.other;
    
    return (
      <TouchableOpacity
        key={spot.id}
        style={styles.card}
        onPress={() => router.push(`/location/${spot.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {spot.photos && spot.photos.length > 0 ? (
            <Image source={{ uri: spot.photos[0] }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImagePlaceholder, { backgroundColor: category.color + "20" }]}>
              <Ionicons name="location" size={24} color={category.color} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <View style={styles.cardTypeRow}>
              <View style={[styles.typeBadge, { backgroundColor: category.color + "20" }]}>
                <Ionicons name="location" size={12} color={category.color} />
                <Text style={[styles.typeBadgeText, { color: category.color }]}>
                  {category.label}
                </Text>
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{spot.name}</Text>
            <Text style={styles.cardMeta}>
              {spot.locationDate
                ? new Date(spot.locationDate).toLocaleDateString()
                : new Date(spot.timestamp).toLocaleDateString()}
            </Text>
          </View>
        </View>
        {renderStars(spot.rating || 0, (r) => handleSpotRating(spot.id, r))}
      </TouchableOpacity>
    );
  };

  const renderActivityCard = (activity: any) => {
    const iconName = activityIcons[activity.type] || "fitness";
    
    return (
      <TouchableOpacity
        key={activity.id}
        style={styles.card}
        onPress={() => router.push(`/activity/${activity.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {activity.photos && activity.photos.length > 0 ? (
            <Image source={{ uri: activity.photos[0] }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImagePlaceholder, { backgroundColor: theme.colors.forest + "20" }]}>
              <Ionicons name={iconName as any} size={24} color={theme.colors.forest} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <View style={styles.cardTypeRow}>
              <View style={[styles.typeBadge, { backgroundColor: theme.colors.forest + "20" }]}>
                <Ionicons name={iconName as any} size={12} color={theme.colors.forest} />
                <Text style={[styles.typeBadgeText, { color: theme.colors.forest }]}>
                  {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                </Text>
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{activity.name}</Text>
            <Text style={styles.cardMeta}>
              {formatDistance(activity.distance)} • {formatDuration(activity.duration)}
            </Text>
          </View>
        </View>
        {renderStars(activity.rating || 0, (r) => handleActivityRating(activity.id, r))}
      </TouchableOpacity>
    );
  };

  const totalCount = topRatedSpots.length + topRatedActivities.length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Top Rated</Text>
        <View style={styles.headerRight}>
          <Ionicons name="star" size={24} color="#FFB800" />
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {totalCount} item{totalCount !== 1 ? "s" : ""} rated 4+ stars
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "all" && styles.tabActive]}
          onPress={() => setActiveTab("all")}
        >
          <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>
            All ({totalCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "spots" && styles.tabActive]}
          onPress={() => setActiveTab("spots")}
        >
          <Text style={[styles.tabText, activeTab === "spots" && styles.tabTextActive]}>
            Spots ({topRatedSpots.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "activities" && styles.tabActive]}
          onPress={() => setActiveTab("activities")}
        >
          <Text style={[styles.tabText, activeTab === "activities" && styles.tabTextActive]}>
            Activities ({topRatedActivities.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {totalCount === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={64} color={theme.colors.lightGray} />
            <Text style={styles.emptyTitle}>No top-rated items yet</Text>
            <Text style={styles.emptyText}>
              Rate your spots and activities 4 stars or higher to see them here
            </Text>
          </View>
        ) : (
          <>
            {(activeTab === "all" || activeTab === "spots") && topRatedSpots.length > 0 && (
              <View style={styles.section}>
                {activeTab === "all" && (
                  <Text style={styles.sectionTitle}>
                    Spots ({topRatedSpots.length})
                  </Text>
                )}
                {topRatedSpots.map(renderSpotCard)}
              </View>
            )}

            {(activeTab === "all" || activeTab === "activities") && topRatedActivities.length > 0 && (
              <View style={styles.section}>
                {activeTab === "all" && (
                  <Text style={styles.sectionTitle}>
                    Activities ({topRatedActivities.length})
                  </Text>
                )}
                {topRatedActivities.map(renderActivityCard)}
              </View>
            )}
          </>
        )}
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  headerRight: {
    padding: 5,
  },
  summary: {
    backgroundColor: "#FFB800" + "15",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#FFB800" + "30",
  },
  summaryText: {
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "500",
    textAlign: "center",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: theme.colors.white,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#FFB800" + "20",
  },
  tabText: {
    fontSize: 14,
    color: theme.colors.gray,
    fontWeight: "500",
  },
  tabTextActive: {
    color: theme.colors.navy,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 12,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    marginBottom: 12,
  },
  cardImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  cardImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
    justifyContent: "center",
  },
  cardTypeRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: 13,
    color: theme.colors.gray,
  },
  ratingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  star: {
    marginHorizontal: 3,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
    lineHeight: 20,
  },
  bottomPadding: {
    height: 30,
  },
});