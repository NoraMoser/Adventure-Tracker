import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
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
  PanResponder,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, CameraType, CameraView } from "expo-camera";
import { categories, CategoryType } from "../constants/categories";
import { theme } from "../constants/theme";
import { useLocation as useLocationContext } from "../contexts/LocationContext";
import { useAutoAddToTrip } from "../hooks/useAutoAddToTrip";
import { LocationService, PlaceSuggestion } from "../services/locationService";
import Slider from "@react-native-community/slider";
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  GestureEvent,
  HandlerStateChangeEvent,
  State,
} from "react-native-gesture-handler";
import Animated, { useSharedValue, runOnJS } from "react-native-reanimated";

export default function QuickPhotoScreen() {
  const router = useRouter();
  const { saveCurrentLocation, saveManualLocation, getLocation, location } =
    useLocationContext();
  const { checkAndAddToTrip } = useAutoAddToTrip();
  const [photos, setPhotos] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryType>("other");
  const [saving, setSaving] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [title, setTitle] = useState("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showCamera, setShowCamera] = useState(true);
  const cameraRef = useRef<CameraView>(null);
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
    console.log("QuickPhotoScreen mounted");

    const attemptLocation = async () => {
      console.log("Attempting to get location...");
      try {
        await getLocation();

        // If still no location, try again after a delay
        setTimeout(async () => {
          if (!location) {
            console.log("First location attempt failed, trying again...");
            await getLocation();
          } else {
            // Fetch suggestions when we have location
            fetchLocationSuggestions();
          }
        }, 2000);

        // Try once more after longer delay
        setTimeout(async () => {
          if (!location) {
            console.log("Second location attempt failed, trying again...");
            await getLocation();
          } else if (!locationSuggestions.length) {
            // Try suggestions again if we didn't get them yet
            fetchLocationSuggestions();
          }
        }, 4000);
      } catch (error) {
        console.log("Location error:", error);
      }
    };

    attemptLocation();

    // Check camera permissions (keep existing code)
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
      console.log("Camera permission:", status);
    })();
  }, []);

  // Add this new function after the useEffect:
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

      if (firstSuggestion && !title) {
        setSelectedSuggestion(firstSuggestion);
        setTitle(firstSuggestion.name);
        if (firstSuggestion.suggestedCategoryType) {
          setSelectedCategory(firstSuggestion.suggestedCategoryType);
        }
      }
    } catch (error) {
      console.error("Error getting suggestions:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: true,
        });

        if (photo) {
          setPhotos((prev) => {
            const newPhotos = [...prev, photo.uri];
            return newPhotos;
          });
          // Add a small delay to ensure state updates
          setTimeout(() => {
            setShowCamera(false);
          }, 100);
        }
      } catch (error) {
        console.error("Camera error:", error);
        Alert.alert("Error", "Failed to take picture");
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePinchGesture = (event: GestureEvent<any>) => {
    "worklet";
    scale.value = baseScale.value * event.nativeEvent.scale;
    const zoomValue = Math.min(Math.max(scale.value - 1, 0), 1);
    runOnJS(setZoom)(zoomValue);
  };

  const handlePinchStateChange = (event: HandlerStateChangeEvent<any>) => {
    "worklet";
    if (event.nativeEvent.oldState === State.ACTIVE) {
      // Pinch ended
      if (scale.value < 1) {
        scale.value = 1;
        runOnJS(setZoom)(0);
      }
      baseScale.value = scale.value;
    } else if (event.nativeEvent.state === State.BEGAN) {
      // Pinch started
      baseScale.value = scale.value;
    }
  };

  const saveQuickLog = async () => {
  console.log("Saving quick log...");

  if (photos.length === 0) {
    Alert.alert("Error", "Please take at least one photo");
    return;
  }

  setSaving(true);
  try {
    const spotName =
      title || caption || `Quick log ${new Date().toLocaleDateString()}`;
    console.log("Saving spot with name:", spotName);

    // Check if we have location
    if (!location) {
      await getLocation();

      // Wait for location to potentially update
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (!location) {
        // Use fallback with saveManualLocation
        await saveManualLocation(
          spotName,
          { latitude: 37.7749, longitude: -122.4194 },
          caption,
          photos,
          selectedCategory,
          new Date()
        );
        Alert.alert("Saved!", "Your moment has been logged.", [
          { text: "Done", onPress: () => router.back() },
        ]);
        return;
      }
    }

    // Save to context and GET THE ACTUAL RETURNED SPOT
    console.log("Have location, saving with real coordinates:", location);
    const savedSpot = await saveCurrentLocation(
      spotName,
      caption,
      photos,
      selectedCategory,
      new Date()
    );

    console.log("Save completed, returned spot:", savedSpot);

    // Only proceed with trip check if we have a valid saved spot
    if (savedSpot) {
      try {
        const trip = await checkAndAddToTrip(
          savedSpot,  // Use the REAL saved spot, not a fake one
          "spot",
          savedSpot.name,
          {
            latitude: savedSpot.location.latitude,
            longitude: savedSpot.location.longitude,
          },
          true
        ) as { name?: string; id?: string } | null;

        if (trip?.name && trip?.id) {
          Alert.alert(
            "Saved to Trip!",
            `Your moment has been logged and added to "${trip.name}".`,
            [
              {
                text: "Take Another",
                onPress: () => {
                  setPhotos([]);
                  setCaption("");
                  setTitle("");
                  setSelectedCategory("other");
                  setShowCamera(true);
                },
              },
              {
                text: "View Trip",
                onPress: () => router.push(`/trip-detail?tripId=${trip.id}`),
              },
              {
                text: "Done",
                onPress: () => router.back(),
              },
            ]
          );
          return;
        }
      } catch (tripError) {
        console.log("Trip add failed:", tripError);
      }
    }

    // Default success message if no trip match or savedSpot was null
    Alert.alert("Saved!", "Your moment has been logged.", [
      {
        text: "Take Another",
        onPress: () => {
          setPhotos([]);
          setCaption("");
          setTitle("");
          setSelectedCategory("other");
          setShowCamera(true);
        },
      },
      {
        text: "Done",
        onPress: () => router.back(),
      },
    ]);
  } catch (error) {
    console.error("Error in saveQuickLog:", error);
    Alert.alert("Error", `Failed to save: ${error.message || error}`);
  } finally {
    setSaving(false);
  }
};

  const CategorySelector = () => {
    const categoryList = Object.entries(categories).filter(
      ([key]) => key !== "all"
    );

    return (
      <View style={styles.categoryContainer}>
        <TouchableOpacity
          style={styles.categoryButton}
          onPress={() => setShowCategories(!showCategories)}
        >
          <View
            style={[
              styles.categoryIcon,
              { backgroundColor: categories[selectedCategory].color + "20" },
            ]}
          >
            <Ionicons
              name={categories[selectedCategory].icon as any}
              size={20}
              color={categories[selectedCategory].color}
            />
          </View>
          <Text style={styles.categoryButtonText}>
            {categories[selectedCategory].label}
          </Text>
          <Ionicons
            name={showCategories ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.colors.gray}
          />
        </TouchableOpacity>

        {showCategories && (
          <View style={styles.categoryGrid}>
            {categoryList.map(([key, category]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.categoryOption,
                  selectedCategory === key && styles.categoryOptionSelected,
                ]}
                onPress={() => {
                  setSelectedCategory(key as CategoryType);
                  setShowCategories(false);
                }}
              >
                <View
                  style={[
                    styles.categoryOptionIcon,
                    { backgroundColor: category.color + "20" },
                  ]}
                >
                  <Ionicons
                    name={category.icon as any}
                    size={16}
                    color={category.color}
                  />
                </View>
                <Text
                  style={[
                    styles.categoryOptionText,
                    selectedCategory === key &&
                      styles.categoryOptionTextSelected,
                  ]}
                >
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
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
              ref={cameraRef}
              style={styles.camera}
              zoom={zoom}
              onCameraReady={() => console.log("Camera ready")}
              facing={cameraFacing} // Changed from hardcoded "back"
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

              {/* Zoom indicator */}
              <View
                style={[styles.zoomIndicator, { opacity: zoom > 0 ? 1 : 0.6 }]}
              >
                <Text style={styles.zoomText}>
                  {zoom === 0 ? "1.0x" : `${(1 + zoom * 4).toFixed(1)}x`}
                </Text>
              </View>

              {/* Zoom slider */}
              <View style={styles.zoomSliderContainer}>
                <TouchableOpacity
                  onPress={() => {
                    const newZoom = Math.max(0, zoom - 0.1);
                    setZoom(newZoom);
                    scale.value = 1 + newZoom;
                  }}
                >
                  <Ionicons name="remove" size={24} color="white" />
                </TouchableOpacity>

                <Slider
                  style={styles.zoomSlider}
                  minimumValue={0}
                  maximumValue={1}
                  value={zoom}
                  onValueChange={(value) => {
                    setZoom(value);
                    scale.value = 1 + value;
                  }}
                  minimumTrackTintColor="#FFFFFF"
                  maximumTrackTintColor="rgba(255,255,255,0.3)"
                  thumbTintColor="#FFFFFF"
                />

                <TouchableOpacity
                  onPress={() => {
                    const newZoom = Math.min(1, zoom + 0.1);
                    setZoom(newZoom);
                    scale.value = 1 + newZoom;
                  }}
                >
                  <Ionicons name="add" size={24} color="white" />
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

  console.log(
    "Main UI should render - showCamera:",
    showCamera,
    "photos:",
    photos.length
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={theme.colors.navy} />
          </TouchableOpacity>
          <Text style={styles.title}>Quick Log</Text>
          <TouchableOpacity
            onPress={saveQuickLog}
            disabled={saving || photos.length === 0}
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.forest} />
            ) : (
              <Text
                style={[
                  styles.saveButton,
                  photos.length === 0 && styles.saveButtonDisabled,
                ]}
              >
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {photos.length === 0 ? (
            <View style={styles.loadingContainer}>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => setShowCamera(true)}
                disabled={hasPermission === false}
              >
                <Ionicons name="camera" size={50} color={theme.colors.forest} />
                <Text style={styles.cameraButtonText}>
                  {hasPermission === false
                    ? "Camera permission denied"
                    : "Tap to open camera"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.photoSection}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photoScroll}
                >
                  {photos.map((photo, index) => (
                    <View key={index} style={styles.photoWrapper}>
                      <Image
                        source={{ uri: photo }}
                        style={styles.photo}
                        onError={(e) =>
                          console.log("Image load error:", e.nativeEvent.error)
                        }
                        onLoad={() =>
                          console.log("Image loaded successfully:", photo)
                        }
                      />
                      <TouchableOpacity
                        style={styles.removePhotoButton}
                        onPress={() => removePhoto(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={() => setShowCamera(true)}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={40}
                      color={theme.colors.forest}
                    />
                    <Text style={styles.addPhotoText}>Add Photo</Text>
                  </TouchableOpacity>
                </ScrollView>
                <Text style={styles.photoCount}>
                  {photos.length} photo{photos.length !== 1 ? "s" : ""}
                </Text>
              </View>

              <View style={styles.titleContainer}>
                <Text style={styles.label}>Title (optional)</Text>
                <TextInput
                  style={styles.titleInput}
                  placeholder="Give this moment a name"
                  placeholderTextColor={theme.colors.lightGray}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={50}
                  returnKeyType="done"
                />
              </View>

              {/* Location Suggestions - ADD THIS AFTER titleContainer */}
              {loadingSuggestions ? (
                <View style={styles.suggestionsLoading}>
                  <ActivityIndicator size="small" color={theme.colors.forest} />
                  <Text style={styles.suggestionsLoadingText}>
                    Finding nearby places...
                  </Text>
                </View>
              ) : locationSuggestions.length > 0 ? (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.label}>Nearby Places</Text>
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
                          setTitle(suggestion.name);
                          if (suggestion.suggestedCategoryType) {
                            setSelectedCategory(
                              suggestion.suggestedCategoryType
                            );
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.suggestionText,
                            selectedSuggestion?.id === suggestion.id &&
                              styles.suggestionTextSelected,
                          ]}
                        >
                          {suggestion.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <View style={styles.captionContainer}>
                <Text style={styles.label}>What is happening here?</Text>
                <TextInput
                  style={styles.captionInput}
                  placeholder="Add a quick note (optional)"
                  placeholderTextColor={theme.colors.lightGray}
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={200}
                  returnKeyType="done"
                />
                <Text style={styles.charCount}>{caption.length}/200</Text>
              </View>

              <CategorySelector />

              {location && (
                <View style={styles.locationInfo}>
                  <Ionicons
                    name="location"
                    size={16}
                    color={theme.colors.forest}
                  />
                  <Text style={styles.locationText}>Location captured</Text>
                  <TouchableOpacity
                    style={styles.refreshLocationButton}
                    onPress={async () => {
                      console.log("Refreshing location...");
                      await getLocation();
                      fetchLocationSuggestions();
                    }}
                  >
                    <Ionicons
                      name="refresh"
                      size={18}
                      color={theme.colors.forest}
                    />
                    <Text style={styles.refreshText}>Refresh</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Quick capture mode - add more details later from your saved
                  spots!
                </Text>
              </View>
            </>
          )}
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
  saveButton: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.forest,
  },
  saveButtonDisabled: {
    color: theme.colors.lightGray,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 400,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.gray,
  },
  cameraButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  cameraButtonText: {
    marginTop: 12,
    fontSize: 18,
    color: theme.colors.forest,
    fontWeight: "500",
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  camera: {
    flex: 1,
  },
  cameraButtonContainer: {
    flex: 1,
    backgroundColor: "transparent",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
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
    top: 40,
    right: 20,
  },
  photoSection: {
    marginBottom: 16,
  },
  photoScroll: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  photoWrapper: {
    marginRight: 12,
    position: "relative",
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  removePhotoButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
  },
  addPhotoButton: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.borderGray,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  addPhotoText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.forest,
    fontWeight: "500",
  },
  photoCount: {
    fontSize: 12,
    color: theme.colors.gray,
    textAlign: "center",
    marginTop: 8,
  },
  titleContainer: {
    marginHorizontal: 16,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    paddingVertical: 8,
  },
  captionContainer: {
    marginHorizontal: 16,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
    marginBottom: 8,
  },
  captionInput: {
    fontSize: 16,
    color: theme.colors.navy,
    minHeight: 60,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: theme.colors.lightGray,
    textAlign: "right",
    marginTop: 4,
  },
  categoryContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  categoryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryButtonText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  categoryGrid: {
    backgroundColor: "white",
    marginTop: 8,
    borderRadius: 12,
    padding: 8,
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
  },
  categoryOptionSelected: {
    backgroundColor: theme.colors.offWhite,
  },
  categoryOptionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryOptionText: {
    fontSize: 14,
    color: theme.colors.navy,
  },
  categoryOptionTextSelected: {
    fontWeight: "600",
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: theme.colors.forest + "10",
    borderRadius: 8,
  },
  locationText: {
    fontSize: 14,
    color: theme.colors.forest,
    marginLeft: 6,
  },
  footer: {
    padding: 16,
    marginHorizontal: 16,
    backgroundColor: theme.colors.lightGray + "10",
    borderRadius: 8,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
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
  suggestionsContainer: {
    marginHorizontal: 16,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  suggestionsLoading: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
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
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  suggestionChipSelected: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  suggestionText: {
    fontSize: 14,
    color: theme.colors.navy,
  },
  suggestionTextSelected: {
    color: "white",
  },
  refreshLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    padding: 6,
  },
  refreshText: {
    fontSize: 12,
    color: theme.colors.forest,
    marginLeft: 4,
  },
  zoomIndicator: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 50, // Add margin to avoid overlap with flip button
  },
  zoomText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  zoomSliderContainer: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 10,
    borderRadius: 25,
  },
  zoomSlider: {
    flex: 1,
    marginHorizontal: 10,
    height: 40,
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
