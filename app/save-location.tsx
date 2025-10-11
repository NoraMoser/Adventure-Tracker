// app/save-location.tsx - Updated with expo-camera
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useRef } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { categories, CategoryType } from "../constants/categories";
import { theme } from "../constants/theme";
import { useLocation } from "../contexts/LocationContext";
import { useAutoAddToTrip } from "../hooks/useAutoAddToTrip";
import * as ImagePicker from "expo-image-picker";
import { Camera, CameraView } from "expo-camera";
import * as Location from "expo-location";
import { LocationService, PlaceSuggestion } from "../services/locationService";
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  State,
} from "react-native-gesture-handler";
import Animated, { useSharedValue, runOnJS } from "react-native-reanimated";

export default function SaveLocationScreen() {
  const router = useRouter();
  const { location, saveCurrentLocation, getLocation } = useLocation();
  const { checkAndAddToTrip } = useAutoAddToTrip();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryType>("other");
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);

  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraKey, setCameraKey] = useState(0);

  const [locationSuggestions, setLocationSuggestions] = useState<
    PlaceSuggestion[]
  >([]);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<PlaceSuggestion | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [zoom, setZoom] = useState(0);
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">("back");

  useEffect(() => {
    if (location) {
      fetchLocationSuggestions();
    }
  }, [location]);

  const fetchLocationSuggestions = async () => {
    if (!location) return;

    setLoadingSuggestions(true);
    try {
      const suggestions = await LocationService.getLocationSuggestions(
        location.latitude,
        location.longitude
      );

      setLocationSuggestions(suggestions);

      // Auto-select first business/POI suggestion if available
      const businessSuggestion = suggestions.find(
        (s) => s.type === "business" || s.type === "poi"
      );
      const firstSuggestion = businessSuggestion || suggestions[0];

      if (firstSuggestion) {
        setSelectedSuggestion(firstSuggestion);
        setName(firstSuggestion.name);
        if (firstSuggestion.suggestedCategoryType) {
          setCategory(firstSuggestion.suggestedCategoryType);
        }
      }
    } catch (error) {
      console.error("Error getting suggestions:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handlePinchGesture = (event: any) => {
    "worklet";
    scale.value = baseScale.value * event.nativeEvent.scale;
    const zoomValue = Math.min(Math.max(scale.value - 1, 0), 1);
    runOnJS(setZoom)(zoomValue);
  };

  const handlePinchStateChange = (event: any) => {
    "worklet";
    if (event.nativeEvent.oldState === State.ACTIVE) {
      if (scale.value < 1) {
        scale.value = 1;
        runOnJS(setZoom)(0);
      }
      baseScale.value = scale.value;
    } else if (event.nativeEvent.state === State.BEGAN) {
      baseScale.value = scale.value;
    }
  };

  const handleSave = async () => {
    // Check location permission first
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
      Alert.alert("Error", "Please enter a location name");
      return;
    }

    if (!location) {
      Alert.alert(
        "Error",
        "Location not available. Please enable location services."
      );
      return;
    }

    setSaving(true);
    try {
      // Save the location and GET THE RETURNED VALUE
      const savedSpot = await saveCurrentLocation(
        name.trim(),
        description.trim(),
        photos,
        category,
        new Date()
      );

      // Check if we got a valid saved spot back
      if (savedSpot) {
        // Auto-add to trip if applicable - properly type the return value
        const trip = (await checkAndAddToTrip(
          savedSpot,
          "spot",
          savedSpot.name,
          {
            latitude: savedSpot.location.latitude,
            longitude: savedSpot.location.longitude,
          },
          true
        )) as { name?: string; id?: string } | null; // Add this type assertion

        if (trip?.name && trip?.id) {
          Alert.alert(
            "Success!",
            `Location saved and added to "${trip.name}"!`,
            [
              {
                text: "View Trip",
                onPress: () => router.push(`/trip-detail?tripId=${trip.id}`),
              },
              {
                text: "OK",
                onPress: () => router.back(),
              },
            ]
          );
        } else {
          Alert.alert("Success", "Location saved successfully!", [
            { text: "OK", onPress: () => router.back() },
          ]);
        }
      } else {
        // If saveCurrentLocation returned null, still show success
        // (the location might have been saved but not returned properly)
        Alert.alert("Success", "Location saved successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error("Error saving location:", error);
      Alert.alert("Error", "Failed to save location");
    } finally {
      setSaving(false);
    }
  };

  const handleTakePhoto = async () => {
    setShowCamera(true);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        console.log("Taking picture...");

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: true,
        });

        console.log("Photo result:", photo);

        if (photo && photo.uri) {
          console.log("Adding photo URI:", photo.uri);
          setPhotos((prevPhotos) => [...prevPhotos, photo.uri]);

          // Force camera to unmount and remount
          setCameraKey((prev) => prev + 1);

          // Close camera
          setTimeout(() => {
            setShowCamera(false);
          }, 200);
        }
      } catch (error) {
        console.error("Camera error:", error);
        Alert.alert("Error", "Failed to take picture");
        setShowCamera(false);
      }
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
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhotos = result.assets.map((asset) => asset.uri);
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  if (showCamera) {
    return (
      <GestureHandlerRootView style={styles.cameraContainer}>
        <PinchGestureHandler
          onGestureEvent={handlePinchGesture}
          onHandlerStateChange={handlePinchStateChange}
        >
          <Animated.View style={styles.cameraContainer}>
            <CameraView
              key={cameraKey}
              ref={cameraRef}
              style={styles.camera}
              facing={cameraFacing}
              zoom={zoom}
            />
            <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.flipButton}
                onPress={() => {
                  setCameraFacing((current) =>
                    current === "back" ? "front" : "back"
                  );
                  // Reset zoom when flipping
                  setZoom(0);
                  scale.value = 1;
                  baseScale.value = 1;
                }}
              >
                <Ionicons name="camera-reverse" size={30} color="white" />
              </TouchableOpacity>
              {/* Keep the zoom controls as backup/visual indicator */}
              <View style={styles.zoomControls}>
                <TouchableOpacity
                  style={styles.zoomButton}
                  onPress={() => {
                    const newZoom = Math.max(0, zoom - 0.1);
                    setZoom(newZoom);
                    scale.value = 1 + newZoom;
                  }}
                  disabled={zoom <= 0}
                >
                  <Ionicons
                    name="remove-circle"
                    size={40}
                    color={zoom <= 0 ? "rgba(255,255,255,0.3)" : "white"}
                  />
                </TouchableOpacity>

                <View style={styles.zoomIndicator}>
                  <Text style={styles.zoomText}>
                    {zoom === 0 ? "1.0x" : `${(1 + zoom * 4).toFixed(1)}x`}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.zoomButton}
                  onPress={() => {
                    const newZoom = Math.min(1, zoom + 0.1);
                    setZoom(newZoom);
                    scale.value = 1 + newZoom;
                  }}
                  disabled={zoom >= 1}
                >
                  <Ionicons
                    name="add-circle"
                    size={40}
                    color={zoom >= 1 ? "rgba(255,255,255,0.3)" : "white"}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePicture}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setCameraKey((prev) => prev + 1);
                  setZoom(0);
                  scale.value = 1;
                  baseScale.value = 1;
                  setShowCamera(false);
                }}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </PinchGestureHandler>
      </GestureHandlerRootView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.navy} />
          </TouchableOpacity>
          <Text style={styles.title}>Save Current Location</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {location && (
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={20} color={theme.colors.forest} />
              <View style={styles.locationDetails}>
                <Text style={styles.locationText}>Current Location</Text>
                <Text style={styles.coordinates}>
                  {location.latitude.toFixed(4)},{" "}
                  {location.longitude.toFixed(4)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={async () => {
                  await getLocation();
                  fetchLocationSuggestions();
                }}
              >
                <Ionicons
                  name="refresh"
                  size={20}
                  color={theme.colors.forest}
                />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              {/* Smart Suggestions - ADD THIS SECTION */}
              {loadingSuggestions ? (
                <View style={styles.suggestionsLoading}>
                  <ActivityIndicator size="small" color={theme.colors.forest} />
                  <Text style={styles.suggestionsLoadingText}>
                    Finding nearby places...
                  </Text>
                </View>
              ) : locationSuggestions.length > 0 ? (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.label}>Suggested Names</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.suggestionsScroll}
                  >
                    {locationSuggestions.map((suggestion) => (
                      <TouchableOpacity
                        key={suggestion.id}
                        style={[
                          styles.suggestionChip,
                          selectedSuggestion?.id === suggestion.id &&
                            styles.suggestionChipSelected,
                        ]}
                        onPress={() => {
                          setSelectedSuggestion(suggestion);
                          setName(suggestion.name);
                          if (suggestion.suggestedCategoryType) {
                            setCategory(suggestion.suggestedCategoryType);
                          }
                        }}
                      >
                        <View style={styles.suggestionContent}>
                          {suggestion.type === "business" && (
                            <Ionicons
                              name="business"
                              size={14}
                              color={
                                selectedSuggestion?.id === suggestion.id
                                  ? "white"
                                  : theme.colors.forest
                              }
                            />
                          )}
                          <Text
                            style={[
                              styles.suggestionText,
                              selectedSuggestion?.id === suggestion.id &&
                                styles.suggestionTextSelected,
                            ]}
                          >
                            {suggestion.name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              <Text style={styles.label}>Location Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Favorite Coffee Shop"
                placeholderTextColor={theme.colors.lightGray}
                autoFocus
              />
            </View>

            {/* Photo Section */}
            <Text style={styles.label}>Photos (Optional)</Text>
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={handleTakePhoto}
              >
                <Ionicons name="camera" size={20} color={theme.colors.forest} />
                <Text style={styles.photoButtonText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={handlePickImage}
              >
                <Ionicons name="images" size={20} color={theme.colors.forest} />
                <Text style={styles.photoButtonText}>Gallery</Text>
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="What makes this place special?"
                placeholderTextColor={theme.colors.lightGray}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {Object.entries(categories)
                  .filter(([key]) => key !== "all")
                  .map(([key, cat]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.categoryItem,
                        category === key && styles.categoryItemSelected,
                      ]}
                      onPress={() => setCategory(key as CategoryType)}
                    >
                      <View
                        style={[
                          styles.categoryIcon,
                          { backgroundColor: cat.color + "20" },
                        ]}
                      >
                        <Ionicons
                          name={cat.icon as any}
                          size={20}
                          color={cat.color}
                        />
                      </View>
                      <Text
                        style={[
                          styles.categoryLabel,
                          category === key && styles.categoryLabelSelected,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving || !name.trim()}
            >
              <Ionicons name="save" size={20} color="white" />
              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Save Location"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  content: {
    flex: 1,
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest + "10",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.forest + "20",
  },
  locationDetails: {
    marginLeft: 12,
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.forest,
  },
  coordinates: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.navy,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryItemSelected: {
    borderColor: theme.colors.forest,
    borderWidth: 2,
  },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  categoryLabel: {
    fontSize: 14,
    color: theme.colors.navy,
  },
  categoryLabelSelected: {
    fontWeight: "600",
    color: theme.colors.forest,
  },
  actions: {
    padding: 16,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.forest,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  cancelButton: {
    alignItems: "center",
    padding: 12,
  },
  cancelButtonText: {
    color: theme.colors.burntOrange,
    fontSize: 16,
  },
  photoActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
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
    marginTop: 10,
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
    backgroundColor: "white",
    borderRadius: 12,
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 25,
    zIndex: 1,
  },
  suggestionsContainer: {
    marginBottom: 20,
  },
  suggestionsLoading: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginBottom: 15,
  },
  suggestionsLoadingText: {
    marginLeft: 10,
    color: theme.colors.gray,
  },
  suggestionsScroll: {
    marginTop: 8,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "white",
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  suggestionChipSelected: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  suggestionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  suggestionText: {
    fontSize: 14,
    color: theme.colors.navy,
    marginLeft: 6,
  },
  suggestionTextSelected: {
    color: "white",
  },
  refreshButton: {
    padding: 8,
    marginLeft: "auto",
  },
  zoomControls: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  zoomButton: {
    padding: 10,
  },
  zoomIndicator: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 20,
    minWidth: 70,
    alignItems: "center",
  },
  zoomText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  flipButton: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 25,
    zIndex: 1,
  },
});
