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
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { theme } from "../../constants/theme";
import { useJournal } from "../../contexts/JournalContext";
import { useTrips } from "../../contexts/TripContext";
import { useActivity } from "../../contexts/ActivityContext";
import { useLocation } from "../../contexts/LocationContext";
import { useAuth } from "../../contexts/AuthContext";
import { PhotoService } from "../../services/photoService";

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

export default function EditJournalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { getEntryById, updateEntry, refreshEntries } = useJournal();
  const { trips } = useTrips();
  const { activities } = useActivity();
  const { savedSpots } = useLocation();

  // Loading state
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [weather, setWeather] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<{
    latitude: number;
    longitude: number;
    name?: string;
  } | null>(null);
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Location picker state
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [customLocationName, setCustomLocationName] = useState("");

  // Linking options visibility
  const [showTripPicker, setShowTripPicker] = useState(false);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [showSpotPicker, setShowSpotPicker] = useState(false);

  useEffect(() => {
    loadEntry();
  }, [id]);

  const loadEntry = async () => {
    setLoading(true);
    await refreshEntries();
    const entry = getEntryById(id as string);
    
    if (entry) {
      setTitle(entry.title || "");
      setContent(entry.content);
      setMood(entry.mood || null);
      setWeather(entry.weather || null);
      setPhotos(entry.photos || []);
      setSelectedTripId(entry.trip_id || null);
      setSelectedActivityId(entry.activity_id || null);
      setSelectedSpotId(entry.spot_id || null);
      setLocationData(entry.location || null);
      setEntryDate(new Date(entry.created_at));
    }
    
    setLoading(false);
  };

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
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Camera permission is required");
        return;
      }

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

  const handleGetCurrentLocation = async () => {
    try {
      setUpdatingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required");
        setUpdatingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      
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
      setUpdatingLocation(false);
      setShowLocationPicker(false);
    } catch (error) {
      console.error("Error getting location:", error);
      setUpdatingLocation(false);
      Alert.alert("Error", "Failed to get location");
    }
  };

  const handleSelectSavedSpot = (spot: any) => {
    if (spot.location) {
      setLocationData({
        latitude: spot.location.latitude,
        longitude: spot.location.longitude,
        name: spot.name,
      });
    }
    setShowLocationPicker(false);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      const newDate = new Date(entryDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setEntryDate(newDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (selectedTime) {
      const newDate = new Date(entryDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setEntryDate(newDate);
    }
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTimeDisplay = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert("Required", "Please write something in your entry");
      return;
    }

    setSaving(true);

    // Use null explicitly for unlinking (undefined means "don't update")
    const success = await updateEntry(id as string, {
      title: title.trim() || null,
      content: content.trim(),
      mood: mood,
      weather: weather,
      photos: photos.length > 0 ? photos : null,
      location: locationData,
      trip_id: selectedTripId,
      activity_id: selectedActivityId,
      spot_id: selectedSpotId,
      created_at: entryDate.toISOString(),
    });

    if (success) {
      await refreshEntries();
      setSaving(false);
      router.back();
    } else {
      setSaving(false);
      Alert.alert("Error", "Failed to save changes");
    }
  };

  // Get display names for linked items
  const selectedTrip = trips.find((t) => t.id === selectedTripId);
  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedSpot = savedSpots.find((s) => s.id === selectedSpotId);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.forest} />
        </View>
      </SafeAreaView>
    );
  }

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
          {/* Date & Time Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.forest} />
                <Text style={styles.dateTimeText}>{formatDateDisplay(entryDate)}</Text>
                <Ionicons name="chevron-down" size={16} color={theme.colors.gray} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={theme.colors.forest} />
                <Text style={styles.dateTimeText}>{formatTimeDisplay(entryDate)}</Text>
                <Ionicons name="chevron-down" size={16} color={theme.colors.gray} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Picker */}
          {showDatePicker && (
            Platform.OS === "ios" ? (
              <Modal transparent animationType="slide">
                <View style={styles.pickerModalOverlay}>
                  <View style={styles.pickerModalContent}>
                    <View style={styles.pickerModalHeader}>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                        <Text style={styles.pickerModalCancel}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={styles.pickerModalTitle}>Select Date</Text>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                        <Text style={styles.pickerModalDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={entryDate}
                      mode="date"
                      display="spinner"
                      onChange={handleDateChange}
                      maximumDate={new Date()}
                    />
                  </View>
                </View>
              </Modal>
            ) : (
              <DateTimePicker
                value={entryDate}
                mode="date"
                display="default"
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )
          )}

          {/* Time Picker */}
          {showTimePicker && (
            Platform.OS === "ios" ? (
              <Modal transparent animationType="slide">
                <View style={styles.pickerModalOverlay}>
                  <View style={styles.pickerModalContent}>
                    <View style={styles.pickerModalHeader}>
                      <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                        <Text style={styles.pickerModalCancel}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={styles.pickerModalTitle}>Select Time</Text>
                      <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                        <Text style={styles.pickerModalDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={entryDate}
                      mode="time"
                      display="spinner"
                      onChange={handleTimeChange}
                    />
                  </View>
                </View>
              </Modal>
            ) : (
              <DateTimePicker
                value={entryDate}
                mode="time"
                display="default"
                onChange={handleTimeChange}
              />
            )
          )}

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
                      <ActivityIndicator size="small" color={theme.colors.forest} />
                    ) : (
                      <>
                        <Ionicons name="images" size={24} color={theme.colors.forest} />
                        <Text style={styles.addPhotoText}>Gallery</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={handleTakePhoto}
                    disabled={uploadingPhoto}
                  >
                    <Ionicons name="camera" size={24} color={theme.colors.forest} />
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
                  onPress={() => setWeather(weather === w.label ? null : w.label)}
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
                <TouchableOpacity 
                  style={styles.locationInfo}
                  onPress={() => setShowLocationPicker(true)}
                >
                  <Ionicons name="location" size={20} color={theme.colors.forest} />
                  <Text style={styles.locationText}>
                    {locationData.name || `${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)}`}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={theme.colors.gray} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setLocationData(null)}>
                  <Ionicons name="close-circle" size={24} color={theme.colors.gray} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addLocationButton}
                onPress={() => setShowLocationPicker(true)}
              >
                <Ionicons name="location-outline" size={20} color={theme.colors.forest} />
                <Text style={styles.addLocationText}>Add Location</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Link to Trip/Activity/Spot */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Link To</Text>
            
            {/* Trip */}
            {selectedTripId ? (
              <View style={styles.linkedItemCard}>
                <View style={styles.linkedItemInfo}>
                  <Ionicons name="airplane" size={20} color={theme.colors.navy} />
                  <Text style={styles.linkedItemText}>
                    {selectedTrip?.name || "Unknown Trip"}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedTripId(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={24} color={theme.colors.gray} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setShowTripPicker(!showTripPicker)}
              >
                <Ionicons name="airplane-outline" size={20} color={theme.colors.navy} />
                <Text style={styles.linkButtonText}>Link to Trip</Text>
                <Ionicons
                  name={showTripPicker ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.colors.gray}
                />
              </TouchableOpacity>
            )}
            {showTripPicker && !selectedTripId && (
              <View style={styles.pickerList}>
                {trips.length === 0 ? (
                  <Text style={styles.pickerEmpty}>No trips available</Text>
                ) : (
                  trips.slice(0, 10).map((trip) => (
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
            {selectedActivityId ? (
              <View style={styles.linkedItemCard}>
                <View style={styles.linkedItemInfo}>
                  <Ionicons name="fitness" size={20} color={theme.colors.burntOrange} />
                  <Text style={styles.linkedItemText}>
                    {selectedActivity?.name || "Unknown Activity"}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedActivityId(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={24} color={theme.colors.gray} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setShowActivityPicker(!showActivityPicker)}
              >
                <Ionicons name="fitness-outline" size={20} color={theme.colors.burntOrange} />
                <Text style={styles.linkButtonText}>Link to Activity</Text>
                <Ionicons
                  name={showActivityPicker ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.colors.gray}
                />
              </TouchableOpacity>
            )}
            {showActivityPicker && !selectedActivityId && (
              <View style={styles.pickerList}>
                {activities.length === 0 ? (
                  <Text style={styles.pickerEmpty}>No activities available</Text>
                ) : (
                  activities.slice(0, 10).map((activity) => (
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
            {selectedSpotId ? (
              <View style={styles.linkedItemCard}>
                <View style={styles.linkedItemInfo}>
                  <Ionicons name="location" size={20} color={theme.colors.forest} />
                  <Text style={styles.linkedItemText}>
                    {selectedSpot?.name || "Unknown Spot"}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedSpotId(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={24} color={theme.colors.gray} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setShowSpotPicker(!showSpotPicker)}
              >
                <Ionicons name="location-outline" size={20} color={theme.colors.forest} />
                <Text style={styles.linkButtonText}>Link to Spot</Text>
                <Ionicons
                  name={showSpotPicker ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.colors.gray}
                />
              </TouchableOpacity>
            )}
            {showSpotPicker && !selectedSpotId && (
              <View style={styles.pickerList}>
                {savedSpots.length === 0 ? (
                  <Text style={styles.pickerEmpty}>No spots available</Text>
                ) : (
                  savedSpots.slice(0, 10).map((spot) => (
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
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setShowLocationPicker(false)}
          />
          <View style={styles.locationPickerModal}>
            <View style={styles.locationPickerHeader}>
              <Text style={styles.locationPickerTitle}>Select Location</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                <Ionicons name="close" size={24} color={theme.colors.gray} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.locationPickerScroll}>
              {/* Custom Location Input */}
              <View style={styles.customLocationSection}>
                <Text style={styles.locationPickerSectionTitle}>Custom Location</Text>
                <View style={styles.customLocationRow}>
                  <TextInput
                    style={styles.customLocationInput}
                    placeholder="Type a location name..."
                    placeholderTextColor={theme.colors.lightGray}
                    value={customLocationName}
                    onChangeText={setCustomLocationName}
                  />
                  <TouchableOpacity
                    style={[
                      styles.customLocationButton,
                      !customLocationName.trim() && styles.customLocationButtonDisabled,
                    ]}
                    onPress={() => {
                      if (customLocationName.trim()) {
                        setLocationData({
                          latitude: 0,
                          longitude: 0,
                          name: customLocationName.trim(),
                        });
                        setCustomLocationName("");
                        setShowLocationPicker(false);
                      }
                    }}
                    disabled={!customLocationName.trim()}
                  >
                    <Ionicons name="checkmark" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Current Location Option */}
              <TouchableOpacity
                style={styles.locationOption}
                onPress={handleGetCurrentLocation}
                disabled={updatingLocation}
              >
                <View style={[styles.locationOptionIcon, { backgroundColor: theme.colors.forest + "15" }]}>
                  {updatingLocation ? (
                    <ActivityIndicator size="small" color={theme.colors.forest} />
                  ) : (
                    <Ionicons name="navigate" size={20} color={theme.colors.forest} />
                  )}
                </View>
                <View style={styles.locationOptionInfo}>
                  <Text style={styles.locationOptionTitle}>Current Location</Text>
                  <Text style={styles.locationOptionSubtitle}>Use your current GPS position</Text>
                </View>
              </TouchableOpacity>

              {/* Activities with routes */}
              {activities.filter(a => a.route && a.route.length > 0).length > 0 && (
                <>
                  <Text style={styles.locationPickerSectionTitle}>From Activities</Text>
                  {activities.filter(a => a.route && a.route.length > 0).slice(0, 10).map((activity) => (
                    <TouchableOpacity
                      key={activity.id}
                      style={styles.locationOption}
                      onPress={() => {
                        setLocationData({
                          latitude: activity.route[0].latitude,
                          longitude: activity.route[0].longitude,
                          name: activity.name,
                        });
                        setShowLocationPicker(false);
                      }}
                    >
                      <View style={[styles.locationOptionIcon, { backgroundColor: theme.colors.burntOrange + "15" }]}>
                        <Ionicons name="fitness" size={20} color={theme.colors.burntOrange} />
                      </View>
                      <View style={styles.locationOptionInfo}>
                        <Text style={styles.locationOptionTitle}>{activity.name}</Text>
                        <Text style={styles.locationOptionSubtitle}>{activity.type}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Saved Spots */}
              {savedSpots.filter(s => s.location).length > 0 && (
                <>
                  <Text style={styles.locationPickerSectionTitle}>From Saved Spots</Text>
                  {savedSpots.filter(s => s.location).map((spot) => (
                    <TouchableOpacity
                      key={spot.id}
                      style={styles.locationOption}
                      onPress={() => handleSelectSavedSpot(spot)}
                    >
                      <View style={[styles.locationOptionIcon, { backgroundColor: theme.colors.forest + "15" }]}>
                        <Ionicons name="location" size={20} color={theme.colors.forest} />
                      </View>
                      <View style={styles.locationOptionInfo}>
                        <Text style={styles.locationOptionTitle}>{spot.name}</Text>
                        {spot.category && (
                          <Text style={styles.locationOptionSubtitle}>{spot.category}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // Date & Time
  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    gap: 8,
  },
  dateTimeText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.navy,
  },

  // Date/Time Picker Modal
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerModalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  pickerModalCancel: {
    fontSize: 16,
    color: theme.colors.gray,
  },
  pickerModalDone: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.forest,
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

  // Location Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  locationPickerModal: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 30,
  },
  locationPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  locationPickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  locationPickerScroll: {
    maxHeight: 450,
  },
  customLocationSection: {
    padding: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  customLocationRow: {
    flexDirection: "row",
    gap: 10,
  },
  customLocationInput: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: theme.colors.navy,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  customLocationButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.forest,
    justifyContent: "center",
    alignItems: "center",
  },
  customLocationButtonDisabled: {
    backgroundColor: theme.colors.lightGray,
  },
  locationPickerSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.gray,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: "uppercase",
  },
  locationOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  locationOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  locationOptionInfo: {
    flex: 1,
  },
  locationOptionTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.navy,
  },
  locationOptionSubtitle: {
    fontSize: 13,
    color: theme.colors.gray,
    marginTop: 2,
  },
});