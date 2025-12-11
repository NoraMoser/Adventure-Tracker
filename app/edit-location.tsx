// app/edit-location.tsx

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraCapture } from "../components/CameraCapture";
import { CategorySelector } from "../components/CategorySelector";
import { LocationPickerModal } from "../components/LocationPickerModal";
import { PhotoPicker } from "../components/PhotoPicker";
import { theme } from "../constants/theme";
import { CategoryType } from "../constants/categories";
import { useAuth } from "../contexts/AuthContext";
import { useLocation } from "../contexts/LocationContext";
import { PhotoService } from "../services/photoService";

export default function EditLocationScreen() {
  const { spotId } = useLocalSearchParams();
  const { savedSpots, updateSpot, deleteSpot } = useLocation();
  const { user } = useAuth();
  const router = useRouter();

  const [spot, setSpot] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [category, setCategory] = useState<CategoryType>("other");
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [locationDate, setLocationDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [editedLocation, setEditedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    const currentSpot = savedSpots.find((s) => s.id === spotId);
    if (currentSpot) {
      setSpot(currentSpot);
      setName(currentSpot.name);
      setDescription(currentSpot.description || "");
      setPhotos(currentSpot.photos || []);
      setCategory(currentSpot.category || "other");
      setLocationDate(
        currentSpot.locationDate
          ? new Date(currentSpot.locationDate)
          : currentSpot.timestamp
          ? new Date(currentSpot.timestamp)
          : new Date()
      );
      setEditedLocation(currentSpot.location);
    } else {
      Alert.alert("Error", "Location not found", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
    setLoading(false);
  }, [spotId, savedSpots]);

  useEffect(() => {
    if (spot) {
      const originalDate = spot.locationDate
        ? new Date(spot.locationDate)
        : spot.timestamp
        ? new Date(spot.timestamp)
        : null;

      const dateChanged = originalDate
        ? locationDate.toDateString() !== originalDate.toDateString()
        : false;

      const locationChanged =
        editedLocation &&
        spot.location &&
        (editedLocation.latitude !== spot.location.latitude ||
          editedLocation.longitude !== spot.location.longitude);

      const changed =
        name !== spot.name ||
        description !== (spot.description || "") ||
        category !== (spot.category || "other") ||
        photos.length !== (spot.photos || []).length ||
        photos.some((photo, index) => photo !== (spot.photos || [])[index]) ||
        dateChanged ||
        locationChanged;

      setHasChanges(changed);
    }
  }, [name, description, category, photos, locationDate, spot, editedLocation]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleLocationUpdate = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setEditedLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      Alert.alert("Success", "Location updated to current position");
    } catch (error) {
      Alert.alert("Error", "Failed to get current location");
    }
  };

  const handleCameraCapture = (uri: string) => {
    setPhotos((prev) => [...prev, uri]);
  };

  const handleSave = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      const { status: newStatus } =
        await Location.requestForegroundPermissionsAsync();
      if (newStatus !== "granted") {
        Alert.alert(
          "Location Required",
          "Location permission is needed to save this spot.",
          [{ text: "OK" }]
        );
        return;
      }
    }

    if (!name.trim()) {
      Alert.alert("Error", "Location name is required");
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to edit locations");
      return;
    }

    setIsSaving(true);

    try {
      const existingUrls: string[] = [];
      const newLocalPhotos: string[] = [];

      for (const photo of photos) {
        if (photo.startsWith("http")) {
          existingUrls.push(photo);
        } else if (photo.startsWith("file://") || photo.startsWith("data:")) {
          newLocalPhotos.push(photo);
        }
      }

      let newUploadedUrls: string[] = [];
      if (newLocalPhotos.length > 0) {
        newUploadedUrls = await PhotoService.uploadPhotos(
          newLocalPhotos,
          "location-photos",
          user.id
        );
      }

      const finalPhotoUrls = [...existingUrls, ...newUploadedUrls];

      const updatedSpot = {
        ...spot,
        name: name.trim(),
        description: description.trim(),
        photos: finalPhotoUrls,
        category,
        locationDate,
        location: editedLocation,
      };

      await updateSpot(spotId as string, updatedSpot);

      Alert.alert("Success", "Location updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to update location");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Location",
      `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSpot(spotId as string);
              router.back();
            } catch (error) {
              Alert.alert("Error", "Failed to delete location");
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Are you sure you want to leave?",
        [
          { text: "Stay", style: "cancel" },
          { text: "Leave", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleGetDirections = () => {
    if (!spot) return;

    const { latitude, longitude } = spot.location;
    const label = encodeURIComponent(spot.name);

    const appleMapsUrl = `maps:0,0?q=${label}@${latitude},${longitude}`;
    const googleMapsUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    let url = webUrl;
    if (Platform.OS === "ios") {
      url = appleMapsUrl;
    } else if (Platform.OS === "android") {
      url = googleMapsUrl;
    }

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Alert.alert("Error", "Unable to open maps");
      });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.forest} />
      </View>
    );
  }

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={handleCameraCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with coordinates */}
        <View style={styles.header}>
          <View style={styles.coordinatesBox}>
            <Ionicons name="pin" size={20} color={theme.colors.burntOrange} />
            <Text style={styles.coordinates}>
              {spot?.location.latitude.toFixed(6)},{" "}
              {spot?.location.longitude.toFixed(6)}
            </Text>
          </View>
          <Text style={styles.savedDate}>
            Added to collection on{" "}
            {new Date(spot?.timestamp).toLocaleDateString()}
          </Text>

          <TouchableOpacity
            style={styles.directionsButton}
            onPress={handleGetDirections}
          >
            <Ionicons name="navigate" size={18} color={theme.colors.white} />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Category</Text>
          <CategorySelector selected={category} onSelect={setCategory} />

          <Text style={styles.label}>Location Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter location name"
            placeholderTextColor={theme.colors.lightGray}
          />

          <View style={styles.locationSection}>
            <Text style={styles.label}>Location</Text>

            {editedLocation && (
              <View style={styles.locationDisplay}>
                <Text style={styles.coordinateText}>
                  Lat: {editedLocation.latitude.toFixed(4)}
                </Text>
                <Text style={styles.coordinateText}>
                  Lng: {editedLocation.longitude.toFixed(4)}
                </Text>
              </View>
            )}

            <View style={styles.locationButtons}>
              <TouchableOpacity
                style={styles.locationButton}
                onPress={handleLocationUpdate}
              >
                <Ionicons
                  name="location"
                  size={20}
                  color={theme.colors.forest}
                />
                <Text style={styles.locationButtonText}>
                  Use Current Location
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => setShowMapPicker(true)}
              >
                <Ionicons
                  name="map"
                  size={20}
                  color={theme.colors.burntOrange}
                />
                <Text style={styles.locationButtonText}>Pick on Map</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.label}>Date Visited</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
            disabled={isSaving}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={theme.colors.navy}
            />
            <Text style={styles.dateButtonText}>
              {formatDate(locationDate)}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.colors.gray} />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={locationDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setLocationDate(selectedDate);
                }
              }}
              maximumDate={new Date()}
            />
          )}

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add notes about this location..."
            placeholderTextColor={theme.colors.lightGray}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Photos ({photos.length})</Text>
          <PhotoPicker
            photos={photos}
            onPhotosChange={setPhotos}
            onOpenCamera={() => setShowCamera(true)}
          />

          {/* Delete Button - stays in scroll */}
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons
              name="trash-outline"
              size={20}
              color={theme.colors.burntOrange}
            />
            <Text style={styles.deleteButtonText}>Delete Location</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!hasChanges || isSaving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={theme.colors.white} />
              <Text style={styles.saveButtonText}>
                {hasChanges ? "Save" : "No Changes"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <LocationPickerModal
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onLocationSelect={(lat, lng) => {
          setEditedLocation({ latitude: lat, longitude: lng });
        }}
        initialLatitude={editedLocation?.latitude}
        initialLongitude={editedLocation?.longitude}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
  },
  header: {
    backgroundColor: theme.colors.white,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  coordinatesBox: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  coordinates: {
    marginLeft: 10,
    fontSize: 14,
    color: theme.colors.gray,
    fontFamily: "monospace",
  },
  savedDate: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginBottom: 10,
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.navy,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  directionsButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 6,
  },
  form: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.navy,
    marginBottom: 20,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.navy,
    marginLeft: 10,
  },
  locationSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
  },
  locationDisplay: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    marginVertical: 10,
  },
  coordinateText: {
    fontSize: 14,
    color: theme.colors.navy,
    fontFamily: "monospace",
  },
  locationButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    flex: 0.48,
  },
  locationButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: theme.colors.navy,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    marginTop: 30,
  },
  deleteButtonText: {
    color: theme.colors.burntOrange,
    fontSize: 16,
    marginLeft: 8,
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.white,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  cancelButtonText: {
    color: theme.colors.gray,
    fontSize: 16,
    fontWeight: "500",
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.colors.forest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 6,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.lightGray,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
