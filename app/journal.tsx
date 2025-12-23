// app/journal.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../constants/theme";
import { useJournal, JournalEntry } from "../contexts/JournalContext";

const MOODS: Record<string, { label: string; color: string }> = {
  "😊": { label: "Happy", color: "#4CAF50" },
  "🤩": { label: "Excited", color: "#FF9800" },
  "😌": { label: "Peaceful", color: "#2196F3" },
  "🥱": { label: "Tired", color: "#9E9E9E" },
  "😢": { label: "Sad", color: "#607D8B" },
  "😤": { label: "Frustrated", color: "#F44336" },
  "🤔": { label: "Thoughtful", color: "#9C27B0" },
  "🥰": { label: "Grateful", color: "#E91E63" },
};

export default function JournalScreen() {
  const router = useRouter();
  const { entries, loading, refreshEntries } = useJournal();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "with-photos" | "with-trips">("all");

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshEntries();
    setRefreshing(false);
  };

  const filteredEntries = entries.filter((entry) => {
    if (filter === "with-photos") {
      return entry.photos && entry.photos.length > 0;
    }
    if (filter === "with-trips") {
      return entry.trip_id;
    }
    return true;
  });

  // Group entries by month
  const groupedEntries = filteredEntries.reduce((groups, entry) => {
    const date = new Date(entry.created_at);
    const monthYear = date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(entry);
    return groups;
  }, {} as Record<string, JournalEntry[]>);

  const sections = Object.entries(groupedEntries).map(([title, data]) => ({
    title,
    data,
  }));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const renderEntry = ({ item }: { item: JournalEntry }) => (
    <TouchableOpacity
      style={styles.entryCard}
      onPress={() => router.push(`/journal/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.entryHeader}>
        <View style={styles.entryDateContainer}>
          <Text style={styles.entryDate}>{formatDate(item.created_at)}</Text>
          <Text style={styles.entryTime}>{formatTime(item.created_at)}</Text>
        </View>
        {item.mood && (
          <View style={styles.moodBadge}>
            <Text style={styles.moodEmoji}>{item.mood}</Text>
          </View>
        )}
      </View>

      {item.title && <Text style={styles.entryTitle}>{item.title}</Text>}

      <Text style={styles.entryContent} numberOfLines={3}>
        {item.content}
      </Text>

      {item.photos && item.photos.length > 0 && (
        <View style={styles.photoPreview}>
          {item.photos.slice(0, 3).map((photo, index) => (
            <Image
              key={index}
              source={{ uri: photo }}
              style={styles.previewPhoto}
            />
          ))}
          {item.photos.length > 3 && (
            <View style={styles.morePhotos}>
              <Text style={styles.morePhotosText}>+{item.photos.length - 3}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.entryFooter}>
        {item.trip && (
          <View style={styles.linkedItem}>
            <Ionicons name="airplane" size={14} color={theme.colors.navy} />
            <Text style={styles.linkedItemText}>{item.trip.name}</Text>
          </View>
        )}
        {item.spot && (
          <View style={styles.linkedItem}>
            <Ionicons name="location" size={14} color={theme.colors.forest} />
            <Text style={styles.linkedItemText}>{item.spot.name}</Text>
          </View>
        )}
        {item.activity && (
          <View style={styles.linkedItem}>
            <Ionicons name="fitness" size={14} color={theme.colors.burntOrange} />
            <Text style={styles.linkedItemText}>{item.activity.name}</Text>
          </View>
        )}
        {item.location?.name && !item.spot && (
          <View style={styles.linkedItem}>
            <Ionicons name="navigate" size={14} color={theme.colors.gray} />
            <Text style={styles.linkedItemText}>{item.location.name}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  if (loading && entries.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.forest} />
          <Text style={styles.loadingText}>Loading journal...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterButton, filter === "all" && styles.filterButtonActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === "with-photos" && styles.filterButtonActive]}
          onPress={() => setFilter("with-photos")}
        >
          <Ionicons
            name="camera"
            size={14}
            color={filter === "with-photos" ? "white" : theme.colors.gray}
          />
          <Text style={[styles.filterText, filter === "with-photos" && styles.filterTextActive]}>
            Photos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === "with-trips" && styles.filterButtonActive]}
          onPress={() => setFilter("with-trips")}
        >
          <Ionicons
            name="airplane"
            size={14}
            color={filter === "with-trips" ? "white" : theme.colors.gray}
          />
          <Text style={[styles.filterText, filter === "with-trips" && styles.filterTextActive]}>
            Trips
          </Text>
        </TouchableOpacity>
      </View>

      {filteredEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="book-outline" size={64} color={theme.colors.lightGray} />
          <Text style={styles.emptyTitle}>
            {filter === "all" ? "No journal entries yet" : "No matching entries"}
          </Text>
          <Text style={styles.emptyText}>
            {filter === "all"
              ? "Start documenting your adventures and thoughts"
              : "Try a different filter"}
          </Text>
          {filter === "all" && (
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push("/add-journal")}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.emptyButtonText}>Write First Entry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.title}
          renderItem={({ item: section }) => (
            <View>
              {renderSectionHeader(section.title)}
              {section.data.map((entry) => (
                <View key={entry.id}>{renderEntry({ item: entry })}</View>
              ))}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.forest}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/add-journal")}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.gray,
  },

  // Filter Bar
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.offWhite,
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.forest,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.gray,
  },
  filterTextActive: {
    color: "white",
  },

  // List
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
  },

  // Entry Card
  entryCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  entryDateContainer: {
    flex: 1,
  },
  entryDate: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  entryTime: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  moodBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    alignItems: "center",
  },
  moodEmoji: {
    fontSize: 18,
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 6,
  },
  entryContent: {
    fontSize: 14,
    color: theme.colors.gray,
    lineHeight: 20,
  },

  // Photo Preview
  photoPreview: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  previewPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  morePhotos: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    alignItems: "center",
  },
  morePhotosText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
  },

  // Footer
  entryFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 8,
  },
  linkedItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  linkedItemText: {
    fontSize: 12,
    color: theme.colors.navy,
    fontWeight: "500",
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
    marginTop: 8,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    gap: 8,
  },
  emptyButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.forest,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});