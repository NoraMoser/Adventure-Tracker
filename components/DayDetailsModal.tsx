// components/DayDetailsModal.tsx

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { categories } from "../constants/categories";
import { theme } from "../constants/theme";

interface DayDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  activities: any[];
  locations: any[];
  formatDistance: (meters: number) => string;
}

type CombinedItem =
  | { type: "activity"; data: any }
  | { type: "location"; data: any };

export function DayDetailsModal({
  visible,
  onClose,
  selectedDate,
  activities,
  locations,
  formatDistance,
}: DayDetailsModalProps) {
  const router = useRouter();

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    if (hours > 0) {
      return `${hours}h`;
    }
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${minutes}m`;
  };

  const combinedItems = useMemo((): CombinedItem[] => {
    if (!selectedDate) return [];

    const dateStr = selectedDate.toISOString().split("T")[0];

    const dayActivities = activities.filter((a) => {
      const activityDateStr = new Date(a.startTime).toISOString().split("T")[0];
      return activityDateStr === dateStr;
    });

    const dayLocations = locations.filter((l) => {
      const locationDateStr = new Date(l.timestamp).toISOString().split("T")[0];
      return locationDateStr === dateStr;
    });

    return [
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
  }, [selectedDate, activities, locations]);

  const handleItemPress = (item: CombinedItem) => {
    onClose();
    if (item.type === "activity") {
      router.push(`/activity-detail/${item.data.id}`);
    } else {
      router.push(`/location-detail/${item.data.id}`);
    }
  };

  const renderItem = ({ item }: { item: CombinedItem }) => (
    <TouchableOpacity
      style={styles.detailItem}
      onPress={() => handleItemPress(item)}
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
            {formatDistance(item.data.distance || 0)} •{" "}
            {formatDuration(item.data.duration || 0)}
          </Text>
        ) : (
          <Text style={styles.detailSubtitle}>
            {categories[item.data.category || "other"]?.label ||
              "Location"}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
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
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={combinedItems}
            keyExtractor={(item, index) =>
              `${item.type}-${item.data.id}-${index}`
            }
            renderItem={renderItem}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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