import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
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
import { CategoryType, categoryList } from "../constants/categories";
import { theme } from "../constants/theme";
import { useLocation } from "../contexts/LocationContext";
import { Camera, CameraView } from "expo-camera";

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

  // NEW: Date state for manual location entry
  const [locationDate, setLocationDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [zoom, setZoom] = useState(0);

  // Use current location as default center, or fall back to a default
  const defaultCenter = currentLocation || {
    latitude: 47.6062,
    longitude: -122.3321,
  }; // Seattle default

  useEffect(() => {
    // Get current location if we don't have it
    if (!currentLocation) {
      getCurrentLocation();
    }
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        // Update map center to current location
        const js = `
          if (typeof map !== 'undefined') {
            map.setView([${location.coords.latitude}, ${location.coords.longitude}], 13);
            
            // Add a blue dot for current location
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
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Geocode the search query
      const results = await Location.geocodeAsync(searchQuery);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];

        // Update map and place marker
        const js = `
          if (typeof map !== 'undefined') {
            // Clear existing marker (but not current location marker)
            if (window.currentMarker) {
              map.removeLayer(window.currentMarker);
            }
            
            // Move map to location
            map.setView([${latitude}, ${longitude}], 15);
            
            // Add marker
            window.currentMarker = L.marker([${latitude}, ${longitude}])
              .addTo(map)
              .bindPopup('${searchQuery.replace(/'/g, "\\'")}')
              .openPopup();
              
            // Send location back
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


        if (photo && photo.uri) {
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
      Alert.alert(
        "Permission Denied",
        "Media library permission is required to select photos"
      );
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
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
  };

  const handleSaveLocation = async () => {
    if (isSaving) return; // Prevent double-tap

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
      // Pass photos directly - LocationContext will handle upload
      await saveManualLocation(
        locationName.trim(),
        selectedLocation,
        locationDescription.trim(),
        photos, // Pass local URIs - context will upload them
        selectedCategory,
        locationDate // Pass the selected date
      );

      // Clear form data
      setLocationName("");
      setLocationDescription("");
      setPhotos([]);
      setSelectedLocation(null);
      setShowForm(false);
      setSelectedCategory("other");
      setLocationDate(new Date()); // Reset to today

      // Clear the marker from the map
      const js = `
        if (window.currentMarker) {
          map.removeLayer(window.currentMarker);
          window.currentMarker = null;
        }
      `;
      webViewRef.current?.injectJavaScript(js);

      // Replace the entire alert callback section with:
      Alert.alert("Success", "Location saved successfully!", [
        {
          text: "OK",
          onPress: () => {
            // Check if we can go back
            if (router.canGoBack()) {
              router.back();
            } else {
              // Use push instead of replace for safer navigation
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
    // Keep the marker on the map but hide the form
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const generateMapHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { height: 100vh; width: 100vw; }
          .custom-popup { font-size: 14px; }
          .info-box {
            background: rgba(255,255,255,0.95);
            padding: 12px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            border: 2px solid #2d5a3d;
          }
          .leaflet-container {
            cursor: crosshair !important;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          // Initialize map
          var map = L.map('map', {
            tap: true,
            touchZoom: true,
            doubleClickZoom: false  // Disable double-click zoom to make tapping easier
          }).setView([${defaultCenter.latitude}, ${defaultCenter.longitude}], 13);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          // Store marker references
          window.currentMarker = null;
          window.currentLocationMarker = null;

          // Custom icon for selected locations
          var selectedIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          // Handle map clicks
          map.on('click', function(e) {
            // Remove existing marker
            if (window.currentMarker) {
              map.removeLayer(window.currentMarker);
            }
            
            // Add new marker with custom icon
            window.currentMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: selectedIcon })
              .addTo(map)
              .bindPopup('Tap here to save this location')
              .openPopup();
            
            // Animate marker
            window.currentMarker._icon.style.animation = 'bounce 0.5s';
            
            // Send location back to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'locationSelected',
              latitude: e.latlng.lat,
              longitude: e.latlng.lng
            }));
          });

          // Add instructions overlay with better styling
          var info = L.control({ position: 'topright' });
          info.onAdd = function (map) {
            this._div = L.DomUtil.create('div', 'info-box');
            this._div.innerHTML = '📍 Tap anywhere on the map to select a location';
            return this._div;
          };
          info.addTo(map);

          // Add bounce animation
          var style = document.createElement('style');
          style.innerHTML = '@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }';
          document.head.appendChild(style);

          // Signal that map is ready
          setTimeout(function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'mapReady'
            }));
          }, 500);
        </script>
      </body>
      </html>
    `;
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

  // Update your camera view render with a key
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          key={cameraKey} // Add this key
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          zoom={zoom} // Add zoom prop
        />
        <View style={styles.cameraOverlay}>
          {/* Zoom controls */}
          <View style={styles.zoomControls}>
            <TouchableOpacity
              style={styles.zoomButton}
              onPress={() => setZoom(Math.max(0, zoom - 0.1))}
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
              onPress={() => setZoom(Math.min(1, zoom + 0.1))}
              disabled={zoom >= 1}
            >
              <Ionicons
                name="add-circle"
                size={40}
                color={zoom >= 1 ? "rgba(255,255,255,0.3)" : "white"}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setCameraKey((prev) => prev + 1);
              setShowCamera(false);
              setZoom(0); // Reset zoom when closing
            }}
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with instructions */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add a Location</Text>
        <Text style={styles.headerSubtitle}>
          Search for a place or tap anywhere on the map
        </Text>
      </View>

      {/* Search Bar */}
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

      {/* Map */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: generateMapHTML() }}
          onMessage={handleWebViewMessage}
          scrollEnabled={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />

        {/* Current Location Button */}
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={getCurrentLocation}
        >
          <Ionicons name="locate" size={24} color={theme.colors.navy} />
        </TouchableOpacity>

        {/* Selected Location Indicator */}
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
                style={styles.closeButton}
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

            {/* NEW: Date Picker Section */}
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
                maximumDate={new Date()} // Can't select future dates
              />
            )}

            {/* Category Selection */}
            <Text style={styles.label}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
            >
              {categoryList.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category.id && {
                      backgroundColor: category.color,
                      borderColor: category.color,
                    },
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                  disabled={isSaving}
                >
                  <Ionicons
                    name={category.icon}
                    size={18}
                    color={
                      selectedCategory === category.id
                        ? "white"
                        : category.color
                    }
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === category.id && { color: "white" },
                    ]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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

            {/* Photo Section */}
            <Text style={styles.label}>Photos (Optional)</Text>
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={[styles.photoButton, isSaving && styles.disabledButton]}
                onPress={handleTakePhoto}
                disabled={isSaving}
              >
                <Ionicons name="camera" size={20} color={theme.colors.forest} />
                <Text style={styles.photoButtonText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoButton, isSaving && styles.disabledButton]}
                onPress={handlePickImage}
                disabled={isSaving}
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
                      disabled={isSaving}
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
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.5)", // Add temporary background
    padding: 10,
    borderRadius: 20,
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
  categoryScroll: {
    marginBottom: 15,
    maxHeight: 50,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  categoryChipText: {
    marginLeft: 6,
    fontSize: 14,
    color: theme.colors.gray,
    fontWeight: "500",
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
  photoActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 15,
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.forest,
  },
  disabledButton: {
    opacity: 0.5,
  },
  photoButtonText: {
    color: theme.colors.forest,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  photoList: {
    marginBottom: 15,
    maxHeight: 110,
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
});
