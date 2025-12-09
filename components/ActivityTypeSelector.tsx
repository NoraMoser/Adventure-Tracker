// components/ActivityTypeSelector.tsx

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../constants/theme";
import { ActivityType } from "../contexts/ActivityContext";

interface ActivityTypeSelectorProps {
  selectedType: ActivityType;
  onSelectType: (type: ActivityType) => void;
}

const activityTypes: { type: ActivityType; label: string; icon: string }[] = [
  { type: "bike", label: "Bike", icon: "bicycle" },
  { type: "run", label: "Run", icon: "walk" },
  { type: "walk", label: "Walk", icon: "footsteps" },
  { type: "hike", label: "Hike", icon: "trail-sign" },
  { type: "paddleboard", label: "Paddle", icon: "boat" },
  { type: "climb", label: "Climb", icon: "trending-up" },
  { type: "other", label: "Other", icon: "fitness" },
];

export function ActivityTypeSelector({
  selectedType,
  onSelectType,
}: ActivityTypeSelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.activityTypes}>
        {activityTypes.map((activity) => (
          <TouchableOpacity
            key={activity.type}
            style={[
              styles.activityCard,
              selectedType === activity.type && styles.activityCardSelected,
            ]}
            onPress={() => onSelectType(activity.type)}
          >
            <Ionicons
              name={activity.icon as any}
              size={24}
              color={
                selectedType === activity.type
                  ? theme.colors.white
                  : theme.colors.navy
              }
            />
            <Text
              style={[
                styles.activityLabel,
                selectedType === activity.type && styles.activityLabelSelected,
              ]}
            >
              {activity.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// Export for use elsewhere
export { activityTypes };

const styles = StyleSheet.create({
  activityTypes: {
    flexDirection: "row",
  },
  activityCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    alignItems: "center",
    minWidth: 80,
    borderWidth: 2,
    borderColor: theme.colors.borderGray,
  },
  activityCardSelected: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  activityLabel: {
    marginTop: 6,
    fontSize: 12,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  activityLabelSelected: {
    color: theme.colors.white,
  },
});