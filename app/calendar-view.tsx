import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DayCell } from "../components/DayCell";
import { DayDetailsModal } from "../components/DayDetailsModal";
import { theme } from "../constants/theme";
import { useActivity } from "../contexts/ActivityContext";
import { useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext";
import { DayData, useCalendarData } from "../hooks/useCalendarData";

export default function CalendarViewScreen() {
  const { activities } = useActivity();
  const { savedSpots } = useLocation();
  const { formatDistance } = useSettings();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const { calendarData, monthStats } = useCalendarData(
    currentDate,
    activities,
    savedSpots
  );

  const changeMonth = (increment: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + increment);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayPress = (day: DayData) => {
    if (day.activities.length > 0 || day.locations.length > 0) {
      setSelectedDate(day.date);
      setShowDetailModal(true);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Calendar",
          headerStyle: { backgroundColor: theme.colors.forest },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "bold" },
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
          {calendarData.map((day) => (
            <DayCell
              key={day.date.toISOString()}
              day={day}
              onPress={handleDayPress}
            />
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: theme.colors.forest }]}
            />
            <Text style={styles.legendText}>Activities</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: theme.colors.burntOrange }]}
            />
            <Text style={styles.legendText}>Locations</Text>
          </View>
        </View>
      </ScrollView>

      {/* Day Details Modal */}
      <DayDetailsModal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        selectedDate={selectedDate}
        activities={activities}
        locations={savedSpots}
        formatDistance={formatDistance}
      />
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
});