// components/ActivityStats.tsx

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";
import { useSettings } from "../contexts/SettingsContext";
import { Activity } from "../types/activity";
import { formatDuration } from "../utils/activity";

interface ActivityStatsProps {
  activity: Activity;
}

interface StatItemProps {
  icon: string;
  value: string;
  label: string;
}

function StatItem({ icon, value, label }: StatItemProps) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon as any} size={20} color={theme.colors.navy} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function ActivityStats({ activity }: ActivityStatsProps) {
  const { formatDistance, formatSpeed } = useSettings();

  return (
    <View style={styles.statsGrid}>
      <StatItem
        icon="speedometer"
        value={formatDistance(activity.distance)}
        label="Distance"
      />
      <StatItem
        icon="time"
        value={formatDuration(activity.duration)}
        label="Duration"
      />
      {activity.average_speed ? (
        <StatItem
          icon="speedometer-outline"
          value={formatSpeed(activity.average_speed)}
          label="Avg Speed"
        />
      ) : null}
      {activity.elevation_gain ? (
        <StatItem
          icon="trending-up"
          value={`${activity.elevation_gain.toFixed(0)}m`}
          label="Elevation"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
    marginBottom: 16,
  },
  statItem: {
    width: "50%",
    paddingHorizontal: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.navy,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
});