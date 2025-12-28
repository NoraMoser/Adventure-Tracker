import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { CameraCapture } from "../components/CameraCapture";
import { CategorySelector } from "../components/CategorySelector";
import { PhotoPicker } from "../components/PhotoPicker";
import { CategoryType } from "../constants/categories";
import { theme } from "../constants/theme";
import { useLocation } from "../contexts/LocationContext";
import { generateLocationPickerHTML } from "../utils/mapHelpers";

export default function AddLocationScreen() {
  const { saveManualLocation, location: currentLocation } = useLocation();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const locationNameInputRef = useRef<TextInput>(null);
  const descriptionInputRef = useRef<TextInput>(null);

  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locationDescription, setLocationDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryType>("other");
  const [mapReady, setMapReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [locationDate, setLocationDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const defaultCenter = currentLocation || {
    latitude: 47.6062,
    longitude: -122.3321,
  };

  useEffect(() => {
    if (!currentLocation) {
      getCurrentLocation();
    }
  }, []);

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        const js = `
          if (typeof map !== 'undefined') {
            map.setView([${location.coords.latitude}, ${location.coords.longitude}], 13);
            if (window.currentLocationMarker) {
              map.removeLayer(window.currentLocationMarker);
            }
            window.currentLocationMarker = L.circleMarker([${location.coords.latitude}, ${location.coords.longitude}], {
              color: '#007AFF',
              fillColor: '#007AFF',
              fillOpacity: 0.3,
              radius: 8,
              weight: 2
            }).addTo(map);
          }
        `;
        webViewRef.current?.injectJavaScript(js);
      }
    } catch (error) {
      console.log("Error getting location:", error);
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        const js = `
          if (typeof map !== 'undefined') {
            if (window.currentMarker) {
              map.removeLayer(window.currentMarker);
            }
            map.setView([${latitude}, ${longitude}], 15);
            window.currentMarker = L.marker([${latitude}, ${longitude}])
              .addTo(map)
              .bindPopup('${searchQuery.replace(/'/g, "\\'")}')
              .openPopup();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'locationSelected',
              latitude: ${latitude},
              longitude: ${longitude}
            }));
          }
        `;
        webViewRef.current?.injectJavaScript(js);
        setSelectedLocation({ latitude, longitude });
        setShowForm(true);
      } else {
        Alert.alert(
          "Not Found",
          "Could not find that location. Try tapping on the map instead."
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to search for location");
    } finally {
      setIsSearching(false);
    }
  };

  const handleCameraCapture = (uri: string) => {
    setPhotos((prev) => [...prev, uri]);
  };

  const handleSaveLocation = async () => {
    if (isSaving) return;

    Keyboard.dismiss();

    if (!locationName.trim()) {
      Alert.alert("Error", "Please enter a name for this location");
      return;
    }

    if (!selectedLocation) {
      Alert.alert("Error", "Please select a location on the map");
      return;
    }

    setIsSaving(true);

    try {
      await saveManualLocation(
        locationName.trim(),
        selectedLocation,
        locationDescription.trim(),
        photos,
        selectedCategory,
        locationDate
      );

      setLocationName("");
      setLocationDescription("");
      setPhotos([]);
      setSelectedLocation(null);
      setShowForm(false);
      setSelectedCategory("other");
      setLocationDate(new Date());

      const js = `
        if (window.currentMarker) {
          map.removeLayer(window.currentMarker);
          window.currentMarker = null;
        }
      `;
      webViewRef.current?.injectJavaScript(js);

      Alert.alert("Success", "Location saved successfully!", [
        {
          text: "OK",
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push("/saved-spots");
            }
          },
        },
      ]);
    } catch (err) {
      console.error("Error saving location:", err);
      Alert.alert("Error", "Failed to save location. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelForm = () => {
    Keyboard.dismiss();
    setShowForm(false);
    setLocationName("");
    setLocationDescription("");
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "mapReady") {
        setMapReady(true);
        return;
      }

      if (data.type === "locationSelected") {
        setSelectedLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
        setShowForm(true);
      }
    } catch (error) {
      console.log("Error parsing message:", error);
    }
  };

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add a Location</Text>
        <Text style={styles.headerSubtitle}>
          Search for a place or tap anywhere on the map
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.colors.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a place..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            placeholderTextColor={theme.colors.lightGray}
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.colors.gray}
              />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={isSearching}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{
            html: generateLocationPickerHTML({
              centerLat: defaultCenter.latitude,
              centerLng: defaultCenter.longitude,
            }),
          }}
          onMessage={handleWebViewMessage}
          scrollEnabled={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />

        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={getCurrentLocation}
          disabled={gettingLocation}
        >
          {gettingLocation ? (
            <ActivityIndicator size="small" color={theme.colors.navy} />
          ) : (
            <Ionicons name="locate" size={24} color={theme.colors.navy} />
          )}
        </TouchableOpacity>

        {selectedLocation && !showForm && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedIndicatorText}>
              📍 Location selected - Tap to change
            </Text>
          </View>
        )}
      </View>

      {showForm && selectedLocation && (
        <KeyboardAvoidingView
          style={styles.formContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
          enabled={Platform.OS === "ios"}
        >
          <ScrollView
            style={styles.form}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.formContent}
            keyboardDismissMode="on-drag"
            nestedScrollEnabled={true}
          >
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Save This Location</Text>
              <TouchableOpacity
                onPress={handleCancelForm}
                style={styles.formCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.gray} />
              </TouchableOpacity>
            </View>

            <View style={styles.coordinatesDisplay}>
              <Ionicons name="pin" size={20} color={theme.colors.burntOrange} />
              <Text style={styles.coordinates}>
                {selectedLocation.latitude.toFixed(6)},{" "}
                {selectedLocation.longitude.toFixed(6)}
              </Text>
            </View>

            <Text style={styles.label}>Location Name *</Text>
            <TextInput
              ref={locationNameInputRef}
              style={styles.input}
              value={locationName}
              onChangeText={setLocationName}
              placeholder="e.g., Hidden Beach, Mom's House, Best Coffee Shop"
              placeholderTextColor={theme.colors.lightGray}
              editable={!isSaving}
              keyboardType="default"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => descriptionInputRef.current?.focus()}
            />

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
                maximumDate={new Date()}
              />
            )}

            <Text style={styles.label}>Category</Text>
            <CategorySelector
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              disabled={isSaving}
            />

            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              ref={descriptionInputRef}
              style={[styles.input, styles.textArea]}
              value={locationDescription}
              onChangeText={setLocationDescription}
              placeholder="What makes this place special? Any tips for visiting?"
              placeholderTextColor={theme.colors.lightGray}
              editable={!isSaving}
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
              keyboardType="default"
              autoCapitalize="sentences"
              autoCorrect={true}
            />

            <Text style={styles.label}>Photos (Optional)</Text>
            <PhotoPicker
              photos={photos}
              onPhotosChange={setPhotos}
              onOpenCamera={() => setShowCamera(true)}
            />

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancelForm}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.saveButton,
                  isSaving && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveLocation}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Text style={styles.saveButtonText}>Saving...</Text>
                ) : (
                  <>
                    <Ionicons
                      name="save"
                      size={20}
                      color={theme.colors.white}
                    />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  header: {
    backgroundColor: theme.colors.white,
    padding: 15,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.navy,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  searchContainer: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
    color: theme.colors.navy,
  },
  searchButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 8,
  },
  searchButtonText: {
    color: theme.colors.white,
    fontWeight: "600",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  currentLocationButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: theme.colors.white,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  selectedIndicator: {
    position: "absolute",
    top: 10,
    left: 20,
    right: 20,
    backgroundColor: theme.colors.forest,
    padding: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  selectedIndicatorText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  formContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Platform.OS === "android" ? "70%" : "75%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    paddingBottom: Platform.OS === "android" ? 200 : 100,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.navy,
  },
  formCloseButton: {
    padding: 4,
  },
  coordinatesDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  coordinates: {
    marginLeft: 10,
    fontSize: 14,
    color: theme.colors.gray,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    color: theme.colors.navy,
    minHeight: 45,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
    paddingTop: 12,
    minHeight: 100,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.navy,
    marginLeft: 10,
  },
  formButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  cancelButton: {
    backgroundColor: theme.colors.offWhite,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  cancelButtonText: {
    color: theme.colors.gray,
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: theme.colors.forest,
    marginLeft: 10,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.lightGray,
    opacity: 0.7,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});