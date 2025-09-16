import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { categories, CategoryType } from "../constants/categories";
import { theme } from "../constants/theme";
import { useLocation as useLocationContext } from "../contexts/LocationContext";
import { useAutoAddToTrip } from "../hooks/useAutoAddToTrip";

export default function QuickPhotoScreen() {
  const router = useRouter();
  const { saveCurrentLocation, getLocation, location } = useLocationContext();
  const { checkAndAddToTrip } = useAutoAddToTrip(); // NEW: Add the hook
  const [photos, setPhotos] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryType>("other");
  const [saving, setSaving] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    // Get current location when screen opens
    getLocation();
    // Add a delay for production builds
    const timer = setTimeout(() => {
      takePhoto();
    }, 500); // Give the screen time to mount

    return () => clearTimeout(timer);
  }, []);

  const takePhoto = async () => {
    try {
      // Add this check
      const { status: existingStatus } =
        await ImagePicker.getCameraPermissionsAsync();
      if (existingStatus !== "granted") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "Camera permission is required");
          router.back();
          return;
        }
      }

      // Add a small delay for production builds
      await new Promise((resolve) => setTimeout(resolve, 300));

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Use the enum, not array
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotos((prev) => [...prev, result.assets[0].uri]);

        // Try to save to gallery - wrapped in try/catch so it doesn't break if permission denied
        try {
          const { status: mediaStatus } =
            await MediaLibrary.requestPermissionsAsync();

          if (mediaStatus === "granted") {
            const asset = await MediaLibrary.createAssetAsync(
              result.assets[0].uri
            );

            const album = await MediaLibrary.getAlbumAsync("explorAble");
            if (album == null) {
              await MediaLibrary.createAlbumAsync("explorAble", asset, false);
            } else {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }
          }
        } catch (galleryError) {
          console.log("Could not save to gallery:", galleryError);
          // Photo is still saved in app, just not in gallery
        }
      } else if (photos.length === 0) {
        router.back();
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
      if (photos.length === 0) {
        router.back();
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const saveQuickLog = async () => {
    if (photos.length === 0) {
      Alert.alert("Error", "Please take at least one photo");
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
      // Save using current location from context
      const spotName =
        title || caption || `Quick log ${new Date().toLocaleDateString()}`;

      await saveCurrentLocation(
        spotName,
        caption,
        photos,
        selectedCategory,
        new Date()
      );

      // Create a spot object for the trip check
      const savedSpot = {
        id: Date.now().toString(),
        name: spotName,
        description: caption,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        category: selectedCategory,
        photos: photos,
        timestamp: new Date().toISOString(),
        locationDate: new Date().toISOString(),
      };

      // Try to add to trip - wrapped in try/catch to handle any errors
      try {
        const trip: any = await checkAndAddToTrip(
          savedSpot,
          "spot",
          savedSpot.name,
          {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          true // prompt user
        );

        // Show success message based on whether it was added to a trip
        if (trip && trip.name && trip.id) {
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
                  takePhoto();
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
        } else {
          // No trip selected, just show normal success
          Alert.alert(
            "Saved!",
            "Your moment has been logged. You can add more details later.",
            [
              {
                text: "Take Another",
                onPress: () => {
                  setPhotos([]);
                  setCaption("");
                  setTitle("");
                  setSelectedCategory("other");
                  takePhoto();
                },
              },
              {
                text: "Done",
                onPress: () => router.back(),
              },
            ]
          );
        }
      } catch (tripError) {
        // If there's any error with the trip functionality, just show success for the save
        console.log("Trip add failed, but spot saved:", tripError);
        Alert.alert("Saved!", "Your moment has been logged.", [
          {
            text: "Done",
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error) {
      console.error("Error saving quick log:", error);
      Alert.alert("Error", "Failed to save. Please try again.");
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
          {photos.length > 0 ? (
            <>
              {/* Photo Gallery */}
              <View style={styles.photoSection}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photoScroll}
                >
                  {photos.map((photo, index) => (
                    <View key={index} style={styles.photoWrapper}>
                      <Image source={{ uri: photo }} style={styles.photo} />
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
                    onPress={takePhoto}
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

              {/* Title Input */}
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

              {/* Caption Input */}
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

              {/* Category Selector */}
              <CategorySelector />

              {/* Location Indicator */}
              {location && (
                <View style={styles.locationInfo}>
                  <Ionicons
                    name="location"
                    size={16}
                    color={theme.colors.forest}
                  />
                  <Text style={styles.locationText}>Location captured</Text>
                </View>
              )}

              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Quick capture mode - add more details later from your saved
                  spots!
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.forest} />
              <Text style={styles.loadingText}>Opening camera...</Text>
            </View>
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
});
// for later
