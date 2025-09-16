// app/calendar-view.tsx
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { categories } from "../constants/categories";
import { theme } from "../constants/theme";
import { useActivity } from "../contexts/ActivityContext";
import { useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext";

interface DayData {
  date: Date;
  activities: any[];
  locations: any[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

export default function CalendarViewScreen() {
  const router = useRouter();
  const { activities } = useActivity();
  const { savedSpots } = useLocation();
  const { formatDistance } = useSettings();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Get calendar data for the current month
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: DayData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      // Filter activities and locations for this date
      const dayActivities = activities.filter((a) => {
        const activityDateStr = new Date(a.activityDate || a.startTime)
          .toISOString()
          .split("T")[0];
        return activityDateStr === dateStr;
      });

      const dayLocations = savedSpots.filter((l) => {
        const locationDateStr = new Date(l.locationDate || l.timestamp)
          .toISOString()
          .split("T")[0];
        return locationDateStr === dateStr;
      });

      days.push({
        date,
        activities: dayActivities,
        locations: dayLocations,
        isToday: date.getTime() === today.getTime(),
        isCurrentMonth: date.getMonth() === month,
      });
    }

    return days;
  }, [currentDate, activities, savedSpots]);

  // Get month statistics
  const monthStats = useMemo(() => {
    const monthActivities = calendarData
      .filter((d) => d.isCurrentMonth)
      .flatMap((d) => d.activities);

    const monthLocations = calendarData
      .filter((d) => d.isCurrentMonth)
      .flatMap((d) => d.locations);

    const totalDistance = monthActivities.reduce(
      (sum, a) => sum + (a.distance || 0),
      0
    );
    const totalDuration = monthActivities.reduce(
      (sum, a) => sum + (a.duration || 0),
      0
    );
    const activeDays = calendarData.filter(
      (d) =>
        d.isCurrentMonth && (d.activities.length > 0 || d.locations.length > 0)
    ).length;

    return {
      activities: monthActivities.length,
      locations: monthLocations.length,
      distance: totalDistance,
      duration: totalDuration,
      activeDays,
    };
  }, [calendarData]);

  const changeMonth = (increment: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + increment);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    if (hours > 0) {
      return `${hours}h`;
    }
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${minutes}m`;
  };

  const handleDayPress = (day: DayData) => {
    if (day.activities.length > 0 || day.locations.length > 0) {
      setSelectedDate(day.date);
      setShowDetailModal(true);
    }
  };

  const renderDayDetails = () => {
    if (!selectedDate) return null;

    const dateStr = selectedDate.toISOString().split("T")[0];
    const dayActivities = activities.filter((a) => {
      const activityDateStr = new Date(a.activityDate || a.startTime)
        .toISOString()
        .split("T")[0];
      return activityDateStr === dateStr;
    });

    const dayLocations = savedSpots.filter((l) => {
      const locationDateStr = new Date(l.locationDate || l.timestamp)
        .toISOString()
        .split("T")[0];
      return locationDateStr === dateStr;
    });

    const combined = [
      ...dayActivities.map((a) => ({ type: "activity" as const, data: a })),
      ...dayLocations.map((l) => ({ type: "location" as const, data: l })),
    ].sort((a, b) => {
      const timeA =
        a.type === "activity"
          ? new Date(a.data.startTime).getTime()
          : new Date(a.data.timestamp).getTime();
      const timeB =
        b.type === "activity"
          ? new Date(b.data.startTime).getTime()
          : new Date(b.data.timestamp).getTime();
      return timeB - timeA;
    });

    return (
      <FlatList
        data={combined}
        keyExtractor={(item, index) => `${item.type}-${item.data.id}-${index}`}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.detailItem}
            onPress={() => {
              setShowDetailModal(false);
              if (item.type === "activity") {
                router.push(`/activity-detail/${item.data.id}`);
              } else {
                router.push(`/location-detail/${item.data.id}`);
              }
            }}
          >
            <View style={styles.detailIcon}>
              <Ionicons
                name={item.type === "activity" ? "fitness" : "location"}
                size={20}
                color={
                  item.type === "activity"
                    ? theme.colors.forest
                    : theme.colors.burntOrange
                }
              />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailTitle}>{item.data.name}</Text>
              {item.type === "activity" ? (
                <Text style={styles.detailSubtitle}>
                  {formatDistance(item.data.distance)} •{" "}
                  {formatDuration(item.data.duration)}
                </Text>
              ) : (
                <Text style={styles.detailSubtitle}>
                  {categories[item.data.category]?.label || "Location"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    );
  };

  const renderDay = (day: DayData) => {
    const hasContent = day.activities.length > 0 || day.locations.length > 0;
    const dotCount = Math.min(day.activities.length + day.locations.length, 3);

    return (
      <TouchableOpacity
        key={day.date.toISOString()}
        style={[
          styles.dayCell,
          !day.isCurrentMonth && styles.dayCellInactive,
          day.isToday && styles.dayCellToday,
          hasContent && styles.dayCellWithContent,
        ]}
        onPress={() => handleDayPress(day)}
        disabled={!hasContent}
      >
        <Text
          style={[
            styles.dayNumber,
            !day.isCurrentMonth && styles.dayNumberInactive,
            day.isToday && styles.dayNumberToday,
          ]}
        >
          {day.date.getDate()}
        </Text>

        {hasContent && (
          <View style={styles.dayIndicators}>
            {Array.from({ length: dotCount }).map((_, i) => {
              const isActivity = i < day.activities.length;
              return (
                <View
                  key={i}
                  style={[
                    styles.dayDot,
                    {
                      backgroundColor: isActivity
                        ? theme.colors.forest
                        : theme.colors.burntOrange,
                    },
                  ]}
                />
              );
            })}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Calendar",
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          headerRight: () => (
            <TouchableOpacity style={styles.headerButton} onPress={goToToday}>
              <Text style={styles.todayButton}>Today</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* Month Navigation */}
      <View style={styles.monthHeader}>
        <TouchableOpacity
          onPress={() => changeMonth(-1)}
          style={styles.monthButton}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.forest} />
        </TouchableOpacity>

        <View style={styles.monthTitle}>
          <Text style={styles.monthText}>
            {currentDate.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => changeMonth(1)}
          style={styles.monthButton}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={theme.colors.forest}
          />
        </TouchableOpacity>
      </View>

      {/* Month Statistics */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{monthStats.activeDays}</Text>
          <Text style={styles.statLabel}>Active Days</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{monthStats.activities}</Text>
          <Text style={styles.statLabel}>Activities</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{monthStats.locations}</Text>
          <Text style={styles.statLabel}>Places</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatDistance(monthStats.distance)}
          </Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
      </View>

      {/* Calendar Grid */}
      <ScrollView style={styles.calendarContainer}>
        {/* Weekday Headers */}
        <View style={styles.weekHeaders}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <View key={day} style={styles.weekHeader}>
              <Text style={styles.weekHeaderText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Days */}
        <View style={styles.calendarGrid}>
          {calendarData.map((day) => renderDay(day))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: theme.colors.forest },
              ]}
            />
            <Text style={styles.legendText}>Activities</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: theme.colors.burntOrange },
              ]}
            />
            <Text style={styles.legendText}>Locations</Text>
          </View>
        </View>
      </ScrollView>

      {/* Day Details Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDate?.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.gray} />
              </TouchableOpacity>
            </View>
            {renderDayDetails()}
          </View>
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
  headerButton: {
    marginRight: 15,
  },
  todayButton: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  monthButton: {
    padding: 5,
  },
  monthTitle: {
    flex: 1,
    alignItems: "center",
  },
  monthText: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  statsBar: {
    flexDirection: "row",
    backgroundColor: theme.colors.forest + "10",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.forest + "20",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.forest,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.gray,
    marginTop: 2,
  },
  calendarContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  weekHeaders: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  weekHeader: {
    flex: 1,
    alignItems: "center",
  },
  weekHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.gray,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    padding: 5,
    borderWidth: 0.5,
    borderColor: theme.colors.borderGray,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellInactive: {
    backgroundColor: theme.colors.offWhite + "50",
  },
  dayCellToday: {
    backgroundColor: theme.colors.forest + "10",
    borderColor: theme.colors.forest,
    borderWidth: 2,
  },
  dayCellWithContent: {
    backgroundColor: "white",
  },
  dayNumber: {
    fontSize: 14,
    color: theme.colors.navy,
    marginBottom: 2,
  },
  dayNumberInactive: {
    color: theme.colors.lightGray,
  },
  dayNumberToday: {
    fontWeight: "bold",
    color: theme.colors.forest,
  },
  dayIndicators: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    padding: 20,
    gap: 30,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    flex: 1,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  detailSubtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
  },
});
