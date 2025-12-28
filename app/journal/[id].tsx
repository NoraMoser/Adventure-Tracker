import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "../../constants/theme";
import { useJournal, JournalEntry } from "../../contexts/JournalContext";
import { TouchableImage } from "../../components/TouchableImage";
import { supabase } from "../../lib/supabase";

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

const WEATHER_ICONS: Record<string, string> = {
  "Sunny": "sunny",
  "Partly Cloudy": "partly-sunny",
  "Cloudy": "cloudy",
  "Rainy": "rainy",
  "Stormy": "thunderstorm",
  "Snowy": "snow",
};

export default function JournalEntryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { deleteEntry } = useJournal();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Use useFocusEffect to reload entry whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadEntry();
    }, [id])
  );

  const loadEntry = async () => {
    setLoading(true);
    
    // Fetch directly from database to ensure fresh data
    const { data, error } = await supabase
      .from("journal_entries")
      .select(`
        *,
        trip:trips(id, name),
        activity:activities(id, name, type),
        spot:locations(id, name)
      `)
      .eq("id", id as string)
      .single();
    
    if (error) {
      console.error("Error loading journal entry:", error);
      setEntry(null);
    } else {
      setEntry(data);
    }
    
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
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

  const handleDelete = () => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this journal entry? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            const success = await deleteEntry(id as string);
            setDeleting(false);
            if (success) {
              router.back();
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    router.push(`/edit-journal/${id}` as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.forest} />
        </View>
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.gray} />
          <Text style={styles.errorText}>Entry not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const moodInfo = entry.mood ? MOODS[entry.mood] : null;
  const weatherIcon = entry.weather ? WEATHER_ICONS[entry.weather] : null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Info */}
        <View style={styles.headerSection}>
          <Text style={styles.date}>{formatDate(entry.created_at)}</Text>
          <Text style={styles.time}>{formatTime(entry.created_at)}</Text>
          
          <View style={styles.badges}>
            {entry.mood && moodInfo && (
              <View style={[styles.badge, { backgroundColor: moodInfo.color + "20" }]}>
                <Text style={styles.moodEmoji}>{entry.mood}</Text>
                <Text style={[styles.badgeText, { color: moodInfo.color }]}>
                  {moodInfo.label}
                </Text>
              </View>
            )}
            {entry.weather && weatherIcon && (
              <View style={styles.badge}>
                <Ionicons name={weatherIcon as any} size={16} color={theme.colors.navy} />
                <Text style={styles.badgeText}>{entry.weather}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Title */}
        {entry.title && (
          <View style={styles.titleSection}>
            <Text style={styles.title}>{entry.title}</Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.contentSection}>
          <Text style={styles.content}>{entry.content}</Text>
        </View>

        {/* Photos */}
        {entry.photos && entry.photos.length > 0 && (
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photosContainer}
            >
              {entry.photos.map((photo, index) => (
                <TouchableImage
                  key={index}
                  source={{ uri: photo }}
                  style={styles.photo}
                  images={entry.photos!}
                  imageIndex={index}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Location */}
        {entry.location && (
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Ionicons name="location" size={20} color={theme.colors.forest} />
              <Text style={styles.infoText}>
                {entry.location.name || `${entry.location.latitude.toFixed(4)}, ${entry.location.longitude.toFixed(4)}`}
              </Text>
            </View>
          </View>
        )}

        {/* Linked Items */}
        {(entry.trip || entry.activity || entry.spot) && (
          <View style={styles.linkedSection}>
            <Text style={styles.sectionTitle}>Linked To</Text>
            
            {entry.trip && (
              <TouchableOpacity
                style={styles.linkedCard}
                onPress={() => router.push({
                  pathname: "/trip-detail",
                  params: { tripId: entry.trip!.id },
                } as any)}
              >
                <View style={[styles.linkedIcon, { backgroundColor: theme.colors.navy + "15" }]}>
                  <Ionicons name="airplane" size={20} color={theme.colors.navy} />
                </View>
                <View style={styles.linkedInfo}>
                  <Text style={styles.linkedLabel}>Trip</Text>
                  <Text style={styles.linkedName}>{entry.trip.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.lightGray} />
              </TouchableOpacity>
            )}
            
            {entry.activity && (
              <TouchableOpacity
                style={styles.linkedCard}
                onPress={() => router.push(`/activity/${entry.activity!.id}` as any)}
              >
                <View style={[styles.linkedIcon, { backgroundColor: theme.colors.burntOrange + "15" }]}>
                  <Ionicons name="fitness" size={20} color={theme.colors.burntOrange} />
                </View>
                <View style={styles.linkedInfo}>
                  <Text style={styles.linkedLabel}>Activity</Text>
                  <Text style={styles.linkedName}>{entry.activity.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.lightGray} />
              </TouchableOpacity>
            )}
            
            {entry.spot && (
              <TouchableOpacity
                style={styles.linkedCard}
                onPress={() => router.push(`/location/${entry.spot!.id}` as any)}
              >
                <View style={[styles.linkedIcon, { backgroundColor: theme.colors.forest + "15" }]}>
                  <Ionicons name="location" size={20} color={theme.colors.forest} />
                </View>
                <View style={styles.linkedInfo}>
                  <Text style={styles.linkedLabel}>Spot</Text>
                  <Text style={styles.linkedName}>{entry.spot.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.lightGray} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Updated timestamp */}
        {entry.updated_at !== entry.created_at && (
          <View style={styles.updatedSection}>
            <Text style={styles.updatedText}>
              Last edited {new Date(entry.updated_at).toLocaleDateString()}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#FF4757" />
          ) : (
            <Ionicons name="trash-outline" size={22} color="#FF4757" />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Ionicons name="create-outline" size={20} color="white" />
          <Text style={styles.editButtonText}>Edit Entry</Text>
        </TouchableOpacity>
      </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.gray,
    marginTop: 12,
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.colors.forest,
    borderRadius: 8,
  },
  backButtonText: {
    color: "white",
    fontWeight: "600",
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Header
  headerSection: {
    padding: 20,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  date: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  time: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 4,
  },
  badges: {
    flexDirection: "row",
    marginTop: 12,
    gap: 10,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.offWhite,
    gap: 6,
  },
  moodEmoji: {
    fontSize: 16,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.navy,
  },

  // Title
  titleSection: {
    padding: 20,
    paddingBottom: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.navy,
  },

  // Content
  contentSection: {
    padding: 20,
  },
  content: {
    fontSize: 16,
    lineHeight: 26,
    color: theme.colors.navy,
  },

  // Photos
  photosSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
    marginBottom: 12,
  },
  photosContainer: {
    gap: 10,
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },

  // Info Section
  infoSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.navy,
    flex: 1,
  },

  // Linked Section
  linkedSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  linkedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  linkedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  linkedInfo: {
    flex: 1,
  },
  linkedLabel: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  linkedName: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.navy,
    marginTop: 2,
  },

  // Updated
  updatedSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: "center",
  },
  updatedText: {
    fontSize: 12,
    color: theme.colors.lightGray,
    fontStyle: "italic",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    padding: 16,
    gap: 12,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  deleteButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF475715",
    justifyContent: "center",
    alignItems: "center",
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.forest,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});