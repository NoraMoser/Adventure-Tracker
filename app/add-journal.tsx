import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../constants/theme";
import { useJournal } from "../contexts/JournalContext";
import { useTrips } from "../contexts/TripContext";
import { useActivity } from "../contexts/ActivityContext";
import { useLocation } from "../contexts/LocationContext";
import { useAuth } from "../contexts/AuthContext";
import { PhotoService } from "../services/photoService";

const MOODS = [
  { emoji: "😊", label: "Happy" },
  { emoji: "🤩", label: "Excited" },
  { emoji: "😌", label: "Peaceful" },
  { emoji: "🥱", label: "Tired" },
  { emoji: "😢", label: "Sad" },
  { emoji: "😤", label: "Frustrated" },
  { emoji: "🤔", label: "Thoughtful" },
  { emoji: "🥰", label: "Grateful" },
];

const WEATHER_OPTIONS = [
  { icon: "sunny", label: "Sunny" },
  { icon: "partly-sunny", label: "Partly Cloudy" },
  { icon: "cloudy", label: "Cloudy" },
  { icon: "rainy", label: "Rainy" },
  { icon: "thunderstorm", label: "Stormy" },
  { icon: "snow", label: "Snowy" },
];

export default function AddJournalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { createEntry } = useJournal();
  const { trips } = useTrips();
  const { activities } = useActivity();
  const { savedSpots, location: currentLocation } = useLocation();

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [weather, setWeather] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(
    (params.tripId as string) || null
  );
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    (params.activityId as string) || null
  );
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(
    (params.spotId as string) || null
  );
  const [locationData, setLocationData] = useState<{
    latitude: number;
    longitude: number;
    name?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Linking options visibility
  const [showTripPicker, setShowTripPicker] = useState(false);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [showSpotPicker, setShowSpotPicker] = useState(false);

  // Set current location on mount
  useEffect(() => {
    if (currentLocation) {
      setLocationData({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
    }
  }, [currentLocation]);

  const handleAddPhoto = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to add photos");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - photos.length,
      });

      if (!result.canceled && result.assets) {
        setUploadingPhoto(true);

        for (const asset of result.assets) {
          const uploadedUrl = await PhotoService.uploadPhoto(
            asset.uri,
            "location-photos",
            user.id
          );
          if (uploadedUrl) {
            setPhotos((prev) => [...prev, uploadedUrl]);
          }
        }

        setUploadingPhoto(false);
      }
    } catch (error) {
      console.error("Error picking images:", error);
      setUploadingPhoto(false);
      Alert.alert("Error", "Failed to add photos");
    }
  };

  const handleTakePhoto = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to take photos");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingPhoto(true);
        const uploadedUrl = await PhotoService.uploadPhoto(
          result.assets[0].uri,
          "location-photos",
          user.id
        );
        if (uploadedUrl) {
          setPhotos((prev) => [...prev, uploadedUrl]);
        }
        setUploadingPhoto(false);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      setUploadingPhoto(false);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});

      // Try to get address
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      let name = "";
      if (address) {
        name = [address.city, address.region].filter(Boolean).join(", ");
      }

      setLocationData({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        name: name || undefined,
      });
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Failed to get location");
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert("Required", "Please write something in your entry");
      return;
    }

    setSaving(true);

    const entry = await createEntry({
      title: title.trim() || undefined,
      content: content.trim(),
      mood: mood || undefined,
      weather: weather || undefined,
      photos: photos.length > 0 ? photos : undefined,
      location: locationData || undefined,
      trip_id: selectedTripId || undefined,
      activity_id: selectedActivityId || undefined,
      spot_id: selectedSpotId || undefined,
    });

    setSaving(false);

    if (entry) {
      Alert.alert("Success", "Journal entry saved!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  };

  const selectedTrip = trips.find((t) => t.id === selectedTripId);
  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedSpot = savedSpots.find((s) => s.id === selectedSpotId);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Mood Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How are you feeling?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.moodContainer}
            >
              {MOODS.map((m) => (
                <TouchableOpacity
                  key={m.emoji}
                  style={[
                    styles.moodButton,
                    mood === m.emoji && styles.moodButtonActive,
                  ]}
                  onPress={() => setMood(mood === m.emoji ? null : m.emoji)}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text
                    style={[
                      styles.moodLabel,
                      mood === m.emoji && styles.moodLabelActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <TextInput
              style={styles.titleInput}
              placeholder="Title (optional)"
              placeholderTextColor={theme.colors.lightGray}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Content */}
          <View style={styles.section}>
            <TextInput
              style={styles.contentInput}
              placeholder="Write about your adventure..."
              placeholderTextColor={theme.colors.lightGray}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.photosContainer}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoWrapper}>
                  <Image source={{ uri: photo }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#FF4757" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 5 && (
                <View style={styles.addPhotoButtons}>
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={handleAddPhoto}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.forest}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="images"
                          size={24}
                          color={theme.colors.forest}
                        />
                        <Text style={styles.addPhotoText}>Gallery</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={handleTakePhoto}
                    disabled={uploadingPhoto}
                  >
                    <Ionicons
                      name="camera"
                      size={24}
                      color={theme.colors.forest}
                    />
                    <Text style={styles.addPhotoText}>Camera</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Weather */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Weather</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weatherContainer}
            >
              {WEATHER_OPTIONS.map((w) => (
                <TouchableOpacity
                  key={w.label}
                  style={[
                    styles.weatherButton,
                    weather === w.label && styles.weatherButtonActive,
                  ]}
                  onPress={() =>
                    setWeather(weather === w.label ? null : w.label)
                  }
                >
                  <Ionicons
                    name={w.icon as any}
                    size={20}
                    color={weather === w.label ? "white" : theme.colors.gray}
                  />
                  <Text
                    style={[
                      styles.weatherLabel,
                      weather === w.label && styles.weatherLabelActive,
                    ]}
                  >
                    {w.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            {locationData ? (
              <View style={styles.locationCard}>
                <View style={styles.locationInfo}>
                  <Ionicons
                    name="location"
                    size={20}
                    color={theme.colors.forest}
                  />
                  <Text style={styles.locationText}>
                    {locationData.name ||
                      `${locationData.latitude.toFixed(
                        4
                      )}, ${locationData.longitude.toFixed(4)}`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setLocationData(null)}>
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={theme.colors.gray}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addLocationButton}
                onPress={handleGetLocation}
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={theme.colors.forest}
                />
                <Text style={styles.addLocationText}>Add Current Location</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Link to Trip/Activity/Spot */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Link To</Text>

            {/* Trip */}
            {selectedTrip ? (
              <View style={styles.linkedItemCard}>
                <View style={styles.linkedItemInfo}>
                  <Ionicons
                    name="airplane"
                    size={20}
                    color={theme.colors.navy}
                  />
                  <Text style={styles.linkedItemText}>{selectedTrip.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedTripId(null)}>
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={theme.colors.gray}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setShowTripPicker(!showTripPicker)}
              >
                <Ionicons
                  name="airplane-outline"
                  size={20}
                  color={theme.colors.navy}
                />
                <Text style={styles.linkButtonText}>Link to Trip</Text>
                <Ionicons
                  name={showTripPicker ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.colors.gray}
                />
              </TouchableOpacity>
            )}
            {showTripPicker && !selectedTrip && (
              <View style={styles.pickerList}>
                {trips.length === 0 ? (
                  <Text style={styles.pickerEmpty}>No trips available</Text>
                ) : (
                  trips.slice(0, 5).map((trip) => (
                    <TouchableOpacity
                      key={trip.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        setSelectedTripId(trip.id);
                        setShowTripPicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{trip.name}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* Activity */}
            {selectedActivity ? (
              <View style={styles.linkedItemCard}>
                <View style={styles.linkedItemInfo}>
                  <Ionicons
                    name="fitness"
                    size={20}
                    color={theme.colors.burntOrange}
                  />
                  <Text style={styles.linkedItemText}>
                    {selectedActivity.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedActivityId(null)}>
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={theme.colors.gray}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setShowActivityPicker(!showActivityPicker)}
              >
                <Ionicons
                  name="fitness-outline"
                  size={20}
                  color={theme.colors.burntOrange}
                />
                <Text style={styles.linkButtonText}>Link to Activity</Text>
                <Ionicons
                  name={showActivityPicker ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.colors.gray}
                />
              </TouchableOpacity>
            )}
            {showActivityPicker && !selectedActivity && (
              <View style={styles.pickerList}>
                {activities.length === 0 ? (
                  <Text style={styles.pickerEmpty}>
                    No activities available
                  </Text>
                ) : (
                  activities.slice(0, 5).map((activity) => (
                    <TouchableOpacity
                      key={activity.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        setSelectedActivityId(activity.id);
                        setShowActivityPicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{activity.name}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* Spot */}
            {selectedSpot ? (
              <View style={styles.linkedItemCard}>
                <View style={styles.linkedItemInfo}>
                  <Ionicons
                    name="location"
                    size={20}
                    color={theme.colors.forest}
                  />
                  <Text style={styles.linkedItemText}>{selectedSpot.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedSpotId(null)}>
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={theme.colors.gray}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setShowSpotPicker(!showSpotPicker)}
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={theme.colors.forest}
                />
                <Text style={styles.linkButtonText}>Link to Spot</Text>
                <Ionicons
                  name={showSpotPicker ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.colors.gray}
                />
              </TouchableOpacity>
            )}
            {showSpotPicker && !selectedSpot && (
              <View style={styles.pickerList}>
                {savedSpots.length === 0 ? (
                  <Text style={styles.pickerEmpty}>No spots available</Text>
                ) : (
                  savedSpots.slice(0, 5).map((spot) => (
                    <TouchableOpacity
                      key={spot.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        setSelectedSpotId(spot.id);
                        setShowSpotPicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{spot.name}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={styles.saveButtonText}>Save Entry</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Section
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
    marginBottom: 10,
  },

  // Mood
  moodContainer: {
    paddingRight: 16,
    gap: 8,
  },
  moodButton: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    minWidth: 70,
  },
  moodButtonActive: {
    backgroundColor: theme.colors.forest + "15",
    borderColor: theme.colors.forest,
  },
  moodEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 11,
    color: theme.colors.gray,
  },
  moodLabelActive: {
    color: theme.colors.forest,
    fontWeight: "500",
  },

  // Title
  titleInput: {
    backgroundColor: theme.colors.white,
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },

  // Content
  contentInput: {
    backgroundColor: theme.colors.white,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: theme.colors.navy,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    minHeight: 150,
  },

  // Photos
  photosContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoWrapper: {
    position: "relative",
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "white",
    borderRadius: 12,
  },
  addPhotoButtons: {
    flexDirection: "row",
    gap: 10,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  addPhotoText: {
    fontSize: 11,
    color: theme.colors.forest,
    marginTop: 4,
  },

  // Weather
  weatherContainer: {
    gap: 8,
  },
  weatherButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    gap: 6,
  },
  weatherButtonActive: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  weatherLabel: {
    fontSize: 13,
    color: theme.colors.gray,
  },
  weatherLabelActive: {
    color: "white",
  },

  // Location
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.white,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    color: theme.colors.navy,
    flex: 1,
  },
  addLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    gap: 8,
  },
  addLocationText: {
    fontSize: 14,
    color: theme.colors.forest,
    fontWeight: "500",
  },

  // Link buttons
  linkedItemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.white,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.forest,
    marginBottom: 8,
  },
  linkedItemInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  linkedItemText: {
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "500",
    flex: 1,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    marginBottom: 8,
    gap: 8,
  },
  linkButtonText: {
    fontSize: 14,
    color: theme.colors.navy,
    flex: 1,
  },
  pickerList: {
    backgroundColor: theme.colors.white,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    overflow: "hidden",
  },
  pickerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  pickerItemText: {
    fontSize: 14,
    color: theme.colors.navy,
  },
  pickerEmpty: {
    padding: 12,
    fontSize: 14,
    color: theme.colors.gray,
    fontStyle: "italic",
  },

  // Footer
  footer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.offWhite,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.gray,
  },
  saveButton: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.forest,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});