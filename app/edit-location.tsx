import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { categoryList, CategoryType } from "../constants/categories";
import { useAuth } from "../contexts/AuthContext";
import { useLocation } from "../contexts/LocationContext";
import { PhotoService } from "../services/photoService";

// Theme colors
const theme = {
  colors: {
    navy: "#1e3a5f",
    forest: "#2d5a3d",
    offWhite: "#faf8f5",
    burntOrange: "#cc5500",
    white: "#ffffff",
    gray: "#666666",
    lightGray: "#999999",
    borderGray: "#e0e0e0",
  },
};

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
  
  // NEW: Date states
  const [locationDate, setLocationDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    // Load the spot data
    const currentSpot = savedSpots.find((s) => s.id === spotId);
    if (currentSpot) {
      setSpot(currentSpot);
      setName(currentSpot.name);
      setDescription(currentSpot.description || "");
      setPhotos(currentSpot.photos || []);
      setCategory(currentSpot.category || "other");
      // NEW: Set the location date
      setLocationDate(
        currentSpot.locationDate 
          ? new Date(currentSpot.locationDate) 
          : currentSpot.timestamp 
          ? new Date(currentSpot.timestamp)
          : new Date()
      );
    } else {
      Alert.alert("Error", "Location not found", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
    setLoading(false);
  }, [spotId, savedSpots]);

  useEffect(() => {
    // Check if any changes were made (including date)
    if (spot) {
      const originalDate = spot.locationDate 
        ? new Date(spot.locationDate) 
        : spot.timestamp 
        ? new Date(spot.timestamp)
        : null;
      
      const dateChanged = originalDate 
        ? locationDate.toDateString() !== originalDate.toDateString()
        : false;
      
      const changed =
        name !== spot.name ||
        description !== (spot.description || "") ||
        category !== (spot.category || "other") ||
        photos.length !== (spot.photos || []).length ||
        photos.some((photo, index) => photo !== (spot.photos || [])[index]) ||
        dateChanged;
      
      setHasChanges(changed);
    }
  }, [name, description, category, photos, locationDate, spot]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Camera permission is required to take photos"
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhotos = result.assets.map((asset) => asset.uri);
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Media library permission is required");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhotos = result.assets.map((asset) => asset.uri);
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    Alert.alert("Remove Photo", "Are you sure you want to remove this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          const newPhotos = photos.filter((_, i) => i !== index);
          setPhotos(newPhotos);
        },
      },
    ]);
  };

  const handleSave = async () => {
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
      // Process photos - separate new local photos from existing URLs
      const existingUrls: string[] = [];
      const newLocalPhotos: string[] = [];

      for (const photo of photos) {
        if (photo.startsWith("http")) {
          // This is an existing URL from storage
          existingUrls.push(photo);
        } else if (photo.startsWith("file://") || photo.startsWith("data:")) {
          // This is a new local photo that needs to be uploaded
          newLocalPhotos.push(photo);
        }
      }

      // Upload new photos if any
      let newUploadedUrls: string[] = [];
      if (newLocalPhotos.length > 0) {
        console.log("Uploading new photos...");
        newUploadedUrls = await PhotoService.uploadPhotos(
          newLocalPhotos,
          "location-photos",
          user.id
        );
        console.log("New photos uploaded:", newUploadedUrls);
      }

      // Combine existing URLs with newly uploaded URLs
      const finalPhotoUrls = [...existingUrls, ...newUploadedUrls];

      const updatedSpot = {
        ...spot,
        name: name.trim(),
        description: description.trim(),
        photos: finalPhotoUrls,
        category,
        locationDate, // NEW: Include the updated date
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
      .catch((err) => {
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
          Added to collection on {new Date(spot?.timestamp).toLocaleDateString()}
        </Text>

        {/* Get Directions Button */}
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          {categoryList.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                category === cat.id && { backgroundColor: cat.color },
              ]}
              onPress={() => setCategory(cat.id)}
            >
              <Ionicons
                name={cat.icon}
                size={16}
                color={category === cat.id ? "white" : cat.color}
              />
              <Text
                style={[
                  styles.categoryChipText,
                  category === cat.id && { color: "white" },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Location Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter location name"
          placeholderTextColor={theme.colors.lightGray}
        />

        {/* NEW: Date Visited Section */}
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
          <Text style={styles.dateButtonText}>{formatDate(locationDate)}</Text>
          <Ionicons
            name="chevron-down"
            size={20}
            color={theme.colors.gray}
          />
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
            maximumDate={new Date()} // Can't select future dates
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

        {/* Photos Section */}
        <Text style={styles.label}>Photos ({photos.length})</Text>

        <View style={styles.photoActions}>
          <TouchableOpacity
            style={styles.photoButton}
            onPress={handleTakePhoto}
          >
            <Ionicons name="camera" size={20} color={theme.colors.forest} />
            <Text style={styles.photoButtonText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.photoButton}
            onPress={handlePickImage}
          >
            <Ionicons name="images" size={20} color={theme.colors.forest} />
            <Text style={styles.photoButtonText}>Add from Gallery</Text>
          </TouchableOpacity>
        </View>

        {photos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photoList}
          >
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image source={{ uri: photo }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => handleRemovePhoto(index)}
                >
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={theme.colors.burntOrange}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Action Buttons */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!hasChanges || isSaving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <>
              <ActivityIndicator size="small" color={theme.colors.white} />
              <Text style={styles.saveButtonText}>Saving...</Text>
            </>
          ) : (
            <>
              <Ionicons name="save" size={20} color={theme.colors.white} />
              <Text style={styles.saveButtonText}>
                {hasChanges ? "Save Changes" : "No Changes"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        {/* Delete Button */}
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
  photoActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 15,
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.forest,
  },
  photoButtonText: {
    color: theme.colors.forest,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  photoList: {
    marginBottom: 20,
  },
  photoContainer: {
    marginRight: 10,
    position: "relative",
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
  },
  saveButton: {
    backgroundColor: theme.colors.forest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.lightGray,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: theme.colors.white,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  cancelButtonText: {
    color: theme.colors.gray,
    fontSize: 16,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    marginTop: 20,
  },
  deleteButtonText: {
    color: theme.colors.burntOrange,
    fontSize: 16,
    marginLeft: 8,
  },
  categoryScroll: {
    marginBottom: 15,
    maxHeight: 40,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  categoryChipText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: "500",
    color: theme.colors.gray,
  },
});