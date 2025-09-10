// app/today.tsx
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { categories, CategoryType } from "../constants/categories";
import { theme } from "../constants/theme";
import { useActivity } from "../contexts/ActivityContext";
import { useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext";

export default function TodayScreen() {
  const router = useRouter();
  const { activities } = useActivity();
  const { savedSpots } = useLocation();
  const { formatDistance, formatSpeed } = useSettings();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Filter activities and locations for today
  const todayData = useMemo(() => {
    const today = selectedDate.toISOString().split("T")[0];

    // Filter activities with activity_date
    const todayActivities = activities.filter((activity: any) => {
      const activityDateStr = activity.activityDate
        ? typeof activity.activityDate === "string"
          ? activity.activityDate
          : activity.activityDate.toISOString().split("T")[0]
        : new Date(activity.startTime).toISOString().split("T")[0];
      return activityDateStr === today;
    });

    // Filter locations with location_date
    const todayLocations = savedSpots.filter((spot: any) => {
      const locationDateStr = spot.locationDate
        ? typeof spot.locationDate === "string"
          ? spot.locationDate
          : spot.locationDate.toISOString().split("T")[0]
        : new Date(spot.timestamp).toISOString().split("T")[0];
      return locationDateStr === today;
    });

    // Combine and sort by time
    const combined = [
      ...todayActivities.map((a) => ({
        type: "activity" as const,
        data: a,
        time: new Date(a.startTime).getTime(),
        sortTime: a.startTime,
      })),
      ...todayLocations.map((l) => ({
        type: "location" as const,
        data: l,
        time: new Date(l.timestamp).getTime(),
        sortTime: l.timestamp,
      })),
    ].sort((a, b) => b.time - a.time);

    return {
      activities: todayActivities,
      locations: todayLocations,
      combined,
    };
  }, [activities, savedSpots, selectedDate]);

  // Calculate today's stats
  const todayStats = useMemo(() => {
    const totalDistance = todayData.activities.reduce(
      (sum, a) => sum + (a.distance || 0),
      0
    );
    const totalDuration = todayData.activities.reduce(
      (sum, a) => sum + (a.duration || 0),
      0
    );
    const totalPhotos = [
      ...todayData.activities.flatMap((a) => a.photos || []),
      ...todayData.locations.flatMap((l) => l.photos || []),
    ].length;

    return {
      activities: todayData.activities.length,
      locations: todayData.locations.length,
      distance: totalDistance,
      duration: totalDuration,
      photos: totalPhotos,
    };
  }, [todayData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Refresh data from contexts if needed
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const renderItem = ({ item }: any) => {
    if (item.type === "activity") {
      const activity = item.data;
      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/activity-detail/${activity.id}`)}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.typeIcon,
                { backgroundColor: theme.colors.forest + "20" },
              ]}
            >
              <Ionicons name="fitness" size={24} color={theme.colors.forest} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{activity.name}</Text>
              <Text style={styles.cardTime}>
                {formatTime(activity.startTime)}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="navigate" size={16} color={theme.colors.gray} />
              <Text style={styles.statText}>
                {formatDistance(activity.distance)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="time" size={16} color={theme.colors.gray} />
              <Text style={styles.statText}>
                {formatDuration(activity.duration)}
              </Text>
            </View>
            {activity.photos && activity.photos.length > 0 && (
              <View style={styles.stat}>
                <Ionicons name="images" size={16} color={theme.colors.gray} />
                <Text style={styles.statText}>{activity.photos.length}</Text>
              </View>
            )}
          </View>

          {activity.photos && activity.photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photoScroll}
            >
              {activity.photos
                .slice(0, 3)
                .map((photo: string, index: number) => (
                  <Image
                    key={index}
                    source={{ uri: photo }}
                    style={styles.thumbnail}
                  />
                ))}
            </ScrollView>
          )}
        </TouchableOpacity>
      );
    } else {
      const location = item.data;
      const category =
        categories[location.category as CategoryType] || categories.other;

      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/location-detail/${location.id}`)}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.typeIcon,
                { backgroundColor: category.color + "20" },
              ]}
            >
              <Ionicons name={category.icon} size={24} color={category.color} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{location.name}</Text>
              <Text style={styles.cardTime}>
                {formatTime(location.timestamp)}
              </Text>
            </View>
          </View>

          {location.description && (
            <Text style={styles.description} numberOfLines={2}>
              {location.description}
            </Text>
          )}

          <View style={styles.locationFooter}>
            <View style={styles.categoryBadge}>
              <Text style={[styles.categoryText, { color: category.color }]}>
                {category.label}
              </Text>
            </View>
            {location.photos && location.photos.length > 0 && (
              <View style={styles.stat}>
                <Ionicons name="images" size={16} color={theme.colors.gray} />
                <Text style={styles.statText}>{location.photos.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Today",
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
              onPress={() => router.push("/calendar-view")}
            >
              <Ionicons name="calendar" size={24} color="white" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity
          onPress={() => changeDate(-1)}
          style={styles.dateButton}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.forest} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateDisplay}
          onPress={() => setSelectedDate(new Date())}
        >
          <Text style={styles.dateText}>
            {isToday(selectedDate)
              ? "Today"
              : selectedDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
          </Text>
          {isToday(selectedDate) && (
            <Text style={styles.fullDate}>
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => changeDate(1)}
          style={styles.dateButton}
          disabled={isToday(selectedDate)}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={
              isToday(selectedDate)
                ? theme.colors.lightGray
                : theme.colors.forest
            }
          />
        </TouchableOpacity>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{todayStats.activities}</Text>
          <Text style={styles.statLabel}>Activities</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{todayStats.locations}</Text>
          <Text style={styles.statLabel}>Places</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {formatDistance(todayStats.distance)}
          </Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{todayStats.photos}</Text>
          <Text style={styles.statLabel}>Photos</Text>
        </View>
      </View>

      {/* Timeline */}
      {todayData.combined.length > 0 ? (
        <FlatList
          data={todayData.combined}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            `${item.type}-${item.data.id}-${index}`
          }
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.forest}
            />
          }
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>Your Days Journey</Text>
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons
            name="today-outline"
            size={80}
            color={theme.colors.lightGray}
          />
          <Text style={styles.emptyTitle}>
            {isToday(selectedDate)
              ? "No adventures yet today"
              : "No adventures on this day"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isToday(selectedDate)
              ? "Start exploring and make today memorable!"
              : "You didn't log any activities or places on this date"}
          </Text>
          {isToday(selectedDate) && (
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push("/track-activity")}
              >
                <Ionicons name="fitness" size={24} color="white" />
                <Text style={styles.quickActionText}>Track Activity</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push("/save-location")}
              >
                <Ionicons name="location" size={24} color="white" />
                <Text style={styles.quickActionText}>Save Location</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Floating Action Button for Today */}
      {isToday(selectedDate) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/quick-photo")}
        >
          <Ionicons name="camera" size={28} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  headerButton: {
    marginRight: 15,
  },
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  dateButton: {
    padding: 5,
  },
  dateDisplay: {
    flex: 1,
    alignItems: "center",
  },
  dateText: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  fullDate: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.forest,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 15,
    marginLeft: 5,
  },
  listContainer: {
    padding: 15,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  cardTime: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 15,
    marginTop: 10,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  description: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 8,
    lineHeight: 20,
  },
  locationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  categoryBadge: {
    backgroundColor: theme.colors.offWhite,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  photoScroll: {
    marginTop: 10,
    marginHorizontal: -5,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
    marginTop: 20,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 8,
    textAlign: "center",
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 30,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  quickActionText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.burntOrange,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
});
