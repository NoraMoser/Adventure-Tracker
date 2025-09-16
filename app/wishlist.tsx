import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  categories,
  categoryList,
  CategoryType,
} from "../constants/categories";
import { theme } from "../constants/theme";
import { useLocation } from "../contexts/LocationContext";
import { useWishlist } from "../contexts/WishlistContext";

const { width } = Dimensions.get("window");
const PRIORITY_LEVELS = [
  { value: 1, label: "Must See", color: "#FF6B6B", icon: "flame" },
  { value: 2, label: "Want to See", color: "#4ECDC4", icon: "star" },
  { value: 3, label: "Maybe Someday", color: "#95A5A6", icon: "time" },
];

export const AddWishlistModal = ({
  visible,
  onClose,
  onAdd,
  currentLocation,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: any) => void;
  currentLocation: any;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryType>("other");
  const [priority, setPriority] = useState(2);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(false);

  useEffect(() => {
    if (currentLocation && useCurrentLocation) {
      setLatitude(currentLocation.latitude.toFixed(6));
      setLongitude(currentLocation.longitude.toFixed(6));
      setLocationSearch("Current Location");
      setSelectedLocation({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
    }
  }, [currentLocation, useCurrentLocation]);

  const handleLocationSearch = async () => {
    if (!locationSearch.trim()) {
      Alert.alert("Error", "Please enter a location to search");
      return;
    }

    setIsSearching(true);
    try {
      // Use Expo's geocoding to search for the location
      const results = await Location.geocodeAsync(locationSearch);

      if (results && results.length > 0) {
        const location = results[0];
        setLatitude(location.latitude.toFixed(6));
        setLongitude(location.longitude.toFixed(6));
        setSelectedLocation({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        Alert.alert("Location Found", `Location set to: ${locationSearch}`);
      } else {
        // If geocoding fails, try a more flexible search
        Alert.alert(
          "Location Not Found",
          'Could not find that location. Try:\n• Being more specific (e.g., "Paris, France")\n• Using major landmarks\n• Entering coordinates manually',
          [
            { text: "OK" },
            {
              text: "Enter Coordinates",
              onPress: () => setShowCoordinates(true),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Search error:", error);
      Alert.alert(
        "Search Error",
        "Could not search for location. Please try entering coordinates manually.",
        [
          { text: "OK" },
          {
            text: "Enter Coordinates",
            onPress: () => setShowCoordinates(true),
          },
        ]
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSetCoordinates = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert(
        "Invalid Coordinates",
        "Please enter valid numbers for latitude and longitude"
      );
      return;
    }

    if (lat < -90 || lat > 90) {
      Alert.alert("Invalid Latitude", "Latitude must be between -90 and 90");
      return;
    }

    if (lng < -180 || lng > 180) {
      Alert.alert(
        "Invalid Longitude",
        "Longitude must be between -180 and 180"
      );
      return;
    }

    setSelectedLocation({ latitude: lat, longitude: lng });
    setLocationSearch(
      `📍 Custom location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    );
    setShowCoordinates(false);
    Alert.alert("Success", "Location coordinates set successfully");
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a name for this place");
      return;
    }

    let finalLat, finalLng;

    if (useCurrentLocation && currentLocation) {
      finalLat = currentLocation.latitude;
      finalLng = currentLocation.longitude;
    } else if (selectedLocation) {
      finalLat = selectedLocation.latitude;
      finalLng = selectedLocation.longitude;
    } else if (latitude && longitude) {
      finalLat = parseFloat(latitude);
      finalLng = parseFloat(longitude);
      if (isNaN(finalLat) || isNaN(finalLng)) {
        Alert.alert("Error", "Please provide valid location coordinates");
        return;
      }
    } else {
      Alert.alert(
        "Location Required",
        "Please either:\n• Search for a location\n• Use current location\n• Enter coordinates manually"
      );
      return;
    }

    onAdd({
      name: name.trim(),
      description: description.trim(),
      category,
      priority,
      latitude: finalLat,
      longitude: finalLng,
    });

    // Reset form
    setName("");
    setDescription("");
    setCategory("other");
    setPriority(2);
    setLatitude("");
    setLongitude("");
    setLocationSearch("");
    setSelectedLocation(null);
    setUseCurrentLocation(false);
    setShowCoordinates(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add to Wishlist</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Place Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Machu Picchu, Eiffel Tower"
              placeholderTextColor={theme.colors.lightGray}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Why do you want to visit?"
              placeholderTextColor={theme.colors.lightGray}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.inputLabel}>Category</Text>
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

            <Text style={styles.inputLabel}>Priority</Text>
            <View style={styles.priorityContainer}>
              {PRIORITY_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.priorityOption,
                    priority === level.value && {
                      backgroundColor: level.color + "20",
                      borderColor: level.color,
                    },
                  ]}
                  onPress={() => setPriority(level.value)}
                >
                  <Ionicons
                    name={level.icon as any}
                    size={20}
                    color={
                      priority === level.value ? level.color : theme.colors.gray
                    }
                  />
                  <Text
                    style={[
                      styles.priorityText,
                      priority === level.value && { color: level.color },
                    ]}
                  >
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Location</Text>

            {currentLocation && (
              <TouchableOpacity
                style={styles.currentLocationButton}
                onPress={() => {
                  setUseCurrentLocation(!useCurrentLocation);
                  if (!useCurrentLocation) {
                    setLocationSearch("📍 Current Location");
                    setSelectedLocation(currentLocation);
                    setShowCoordinates(false);
                  } else {
                    setLocationSearch("");
                    setSelectedLocation(null);
                  }
                }}
              >
                <Ionicons
                  name={useCurrentLocation ? "checkbox" : "square-outline"}
                  size={20}
                  color={theme.colors.forest}
                />
                <Text style={styles.currentLocationText}>
                  Use current location
                </Text>
              </TouchableOpacity>
            )}

            {!useCurrentLocation && (
              <>
                <View style={styles.searchContainer}>
                  <TextInput
                    style={[styles.input, styles.searchInput]}
                    value={locationSearch}
                    onChangeText={setLocationSearch}
                    placeholder="Search for a place (e.g., Paris, France)"
                    placeholderTextColor={theme.colors.lightGray}
                    onSubmitEditing={handleLocationSearch}
                    returnKeyType="search"
                  />
                  <TouchableOpacity
                    style={styles.searchButton}
                    onPress={handleLocationSearch}
                    disabled={isSearching}
                  >
                    {isSearching ? (
                      <Text style={styles.searchButtonText}>...</Text>
                    ) : (
                      <Ionicons
                        name="search"
                        size={20}
                        color={theme.colors.white}
                      />
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={styles.orText}>OR</Text>

                <TouchableOpacity
                  style={styles.manualCoordsButton}
                  onPress={() => setShowCoordinates(!showCoordinates)}
                >
                  <Ionicons
                    name={showCoordinates ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={theme.colors.navy}
                  />
                  <Text style={styles.manualCoordsText}>
                    {showCoordinates ? "Hide" : "Enter"} coordinates manually
                  </Text>
                </TouchableOpacity>

                {showCoordinates && (
                  <View style={styles.coordinatesContainer}>
                    <View style={styles.coordInputRow}>
                      <TextInput
                        style={[styles.input, styles.coordInput]}
                        value={latitude}
                        onChangeText={setLatitude}
                        placeholder="Latitude"
                        placeholderTextColor={theme.colors.lightGray}
                        keyboardType="numbers-and-punctuation"
                      />
                      <TextInput
                        style={[styles.input, styles.coordInput]}
                        value={longitude}
                        onChangeText={setLongitude}
                        placeholder="Longitude"
                        placeholderTextColor={theme.colors.lightGray}
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.setCoordinatesButton}
                      onPress={handleSetCoordinates}
                    >
                      <Text style={styles.setCoordinatesButtonText}>
                        Set Coordinates
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.coordHelpText}>
                      Example: Eiffel Tower is 48.8584, 2.2945
                    </Text>
                  </View>
                )}

                {selectedLocation && (
                  <View style={styles.selectedLocationBox}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={theme.colors.forest}
                    />
                    <Text style={styles.selectedLocationText}>
                      Location set: {selectedLocation.latitude.toFixed(4)},{" "}
                      {selectedLocation.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}

                <View style={styles.helpBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={theme.colors.lightGray}
                  />
                  <Text style={styles.helpText}>
                    Tips: Try &quot;City, Country&quot; format or famous
                    landmarks. You can also find coordinates on Google Maps.
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
            >
              <Ionicons name="heart" size={20} color={theme.colors.white} />
              <Text style={styles.submitButtonText}>Add to Wishlist</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default function WishlistScreen() {
  const router = useRouter();
  const {
    wishlistItems,
    addWishlistItem,
    removeWishlistItem,
    convertToVisited,
  } = useWishlist();
  const { location, getLocation, saveManualLocation } = useLocation();
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedPriority, setSelectedPriority] = useState<number | "all">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMapLegend, setShowMapLegend] = useState(true);
  const webViewRef = React.useRef<WebView>(null);

  useEffect(() => {
    if (!location) {
      getLocation();
    }
  }, []);

  // Filter wishlist items
  const filteredItems = useMemo(() => {
    let items = wishlistItems;

    // Filter by priority
    if (selectedPriority !== "all") {
      items = items.filter((item) => item.priority === selectedPriority);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          (item.description &&
            item.description.toLowerCase().includes(query)) ||
          item.category.toLowerCase().includes(query)
      );
    }

    // Sort by priority (highest first)
    return items.sort((a, b) => a.priority - b.priority);
  }, [wishlistItems, selectedPriority, searchQuery]);

  const handleAddWishlistItem = async (item: any) => {
    await addWishlistItem({
      name: item.name,
      description: item.description,
      location: {
        latitude: item.latitude,
        longitude: item.longitude,
      },
      category: item.category,
      priority: item.priority,
    });
  };

  const handleConvertToVisited = async (item: any) => {
    Alert.alert(
      "Mark as Visited",
      `Convert "${item.name}" to a saved location?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Convert",
          style: "default",
          onPress: async () => {
            // Save as actual location
            await saveManualLocation(
              item.name,
              item.location,
              item.description,
              [],
              item.category
            );

            // Remove from wishlist
            await removeWishlistItem(item.id);

            Alert.alert(
              "Success",
              "Location has been saved to your visited spots!"
            );
          },
        },
      ]
    );
  };

  const handleDeleteItem = (item: any) => {
    Alert.alert(
      "Remove from Wishlist",
      `Are you sure you want to remove "${item.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeWishlistItem(item.id),
        },
      ]
    );
  };

  const renderListItem = ({ item }: any) => {
    const category =
      categories[item.category as CategoryType] || categories.other;
    const priorityLevel =
      PRIORITY_LEVELS.find((p) => p.value === item.priority) ||
      PRIORITY_LEVELS[1];

    return (
      <View style={styles.listItem}>
        <View style={styles.listItemContent}>
          <View style={styles.listItemHeader}>
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: category.color + "20" },
              ]}
            >
              <Ionicons name={category.icon} size={20} color={category.color} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.listItemTitle}>{item.name}</Text>
              <View style={styles.metaRow}>
                <View
                  style={[
                    styles.priorityBadge,
                    { backgroundColor: priorityLevel.color + "20" },
                  ]}
                >
                  <Ionicons
                    name={priorityLevel.icon as any}
                    size={12}
                    color={priorityLevel.color}
                  />
                  <Text
                    style={[
                      styles.priorityBadgeText,
                      { color: priorityLevel.color },
                    ]}
                  >
                    {priorityLevel.label}
                  </Text>
                </View>
                <Text style={[styles.categoryText, { color: category.color }]}>
                  • {category.label}
                </Text>
              </View>
            </View>
          </View>

          {item.description && (
            <Text style={styles.listItemDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.listItemFooter}>
            <Text style={styles.coordsText}>
              📍 {item.location.latitude.toFixed(4)},{" "}
              {item.location.longitude.toFixed(4)}
            </Text>
            <Text style={styles.dateText}>
              Added {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.visitedButton]}
            onPress={() => handleConvertToVisited(item)}
          >
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={theme.colors.forest}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteItem(item)}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={theme.colors.burntOrange}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Generate map HTML with ghost pins
  const generateMapHTML = () => {
    const hasItems = filteredItems.length > 0;

    if (!hasItems) {
      const centerLat = location?.latitude || 47.6062;
      const centerLng = location?.longitude || -122.3321;

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
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            var map = L.map('map').setView([${centerLat}, ${centerLng}], 10);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors',
              maxZoom: 19
            }).addTo(map);
          </script>
        </body>
        </html>
      `;
    }

    const lats = filteredItems.map((item) => item.location.latitude);
    const lngs = filteredItems.map((item) => item.location.longitude);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    const markers = filteredItems
      .map((item) => {
        const category =
          categories[item.category as CategoryType] || categories.other;
        const priority =
          PRIORITY_LEVELS.find((p) => p.value === item.priority) ||
          PRIORITY_LEVELS[1];

        // Ghost effect with semi-transparent markers
        return `
        L.circleMarker([${item.location.latitude}, ${
          item.location.longitude
        }], {
          radius: 10,
          fillColor: '${category.mapColor}',
          color: '#fff',
          weight: 2,
          opacity: 0.6,  // Ghost effect
          fillOpacity: 0.3,  // Ghost effect
          dashArray: '5, 5'  // Dashed border for wishlist items
        })
        .addTo(map)
        .bindPopup(\`
          <div style="text-align: center;">
            <b style="color: ${category.color}">${item.name}</b><br>
            <span style="color: ${priority.color}; font-size: 12px;">
              <strong>${priority.label}</strong>
            </span><br>
            <small>${category.label}</small><br>
            ${
              item.description
                ? "<small>" + item.description + "</small><br>"
                : ""
            }
            <small style="color: #666;">Wishlist Item</small>
          </div>
        \`);
      `;
      })
      .join("\n");

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
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([${centerLat}, ${centerLng}], 10);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          ${markers}

          // Fit bounds to show all markers
          var group = new L.featureGroup([
            ${filteredItems
              .map(
                (item) =>
                  `L.circleMarker([${item.location.latitude}, ${item.location.longitude}])`
              )
              .join(",\n")}
          ]);
          if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds().pad(0.2));
          }
        </script>
      </body>
      </html>
    `;
  };

  if (wishlistItems.length === 0 && !showAddModal) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen
          options={{
            title: "Wishlist",
            headerStyle: {
              backgroundColor: theme.colors.forest,
            },
            headerTintColor: "#fff",
            headerTitleStyle: {
              fontWeight: "bold",
            },
          }}
        />
        <Ionicons name="heart-outline" size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
        <Text style={styles.emptySubtitle}>
          Add places you dream of visiting!
        </Text>
        <TouchableOpacity
          style={styles.addFirstButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.addFirstButtonText}>Add Your First Place</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Wishlist",
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />

      {/* Priority Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.priorityFilter}
        contentContainerStyle={styles.priorityFilterContent}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedPriority === "all" && styles.filterChipActive,
          ]}
          onPress={() => setSelectedPriority("all")}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedPriority === "all" && styles.filterChipTextActive,
            ]}
          >
            All ({wishlistItems.length})
          </Text>
        </TouchableOpacity>
        {PRIORITY_LEVELS.map((level) => {
          const count = wishlistItems.filter(
            (item) => item.priority === level.value
          ).length;
          return (
            <TouchableOpacity
              key={level.value}
              style={[
                styles.filterChip,
                selectedPriority === level.value && {
                  backgroundColor: level.color,
                  borderColor: level.color,
                },
              ]}
              onPress={() => setSelectedPriority(level.value)}
            >
              <Ionicons
                name={level.icon as any}
                size={16}
                color={selectedPriority === level.value ? "white" : level.color}
              />
              <Text
                style={[
                  styles.filterChipText,
                  selectedPriority === level.value && { color: "white" },
                ]}
              >
                {level.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* View Mode Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === "list" && styles.toggleButtonActive,
          ]}
          onPress={() => setViewMode("list")}
        >
          <Ionicons
            name="list"
            size={20}
            color={viewMode === "list" ? "white" : theme.colors.forest}
          />
          <Text
            style={[
              styles.toggleText,
              viewMode === "list" && styles.toggleTextActive,
            ]}
          >
            List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === "map" && styles.toggleButtonActive,
          ]}
          onPress={() => setViewMode("map")}
        >
          <Ionicons
            name="map"
            size={20}
            color={viewMode === "map" ? "white" : theme.colors.forest}
          />
          <Text
            style={[
              styles.toggleText,
              viewMode === "map" && styles.toggleTextActive,
            ]}
          >
            Map
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setSearchQuery(searchQuery ? "" : " ")}
        >
          <Ionicons name="search" size={20} color={theme.colors.forest} />
          <Text style={styles.toggleText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {searchQuery !== "" && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={theme.colors.gray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search wishlist..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.colors.lightGray}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={theme.colors.gray}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Content */}
      {viewMode === "list" ? (
        <FlatList
          data={filteredItems}
          renderItem={renderListItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No matching places found</Text>
            </View>
          }
        />
      ) : (
        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            style={styles.map}
            source={{ html: generateMapHTML() }}
            scrollEnabled={true}
            javaScriptEnabled={true}
            domStorageEnabled={true} // Fixed from 'domnageEnabled'
          />
          {showMapLegend && (
            <View style={styles.mapLegend}>
              <TouchableOpacity
                style={styles.legendClose}
                onPress={() => setShowMapLegend(false)}
              >
                <Ionicons name="close" size={16} color={theme.colors.gray} />
              </TouchableOpacity>
              <Text style={styles.legendTitle}>Wishlist Items</Text>
              <Text style={styles.legendText}>
                Ghost pins = Places to visit
              </Text>
              <Text style={styles.legendText}>Tap pins for details</Text>
            </View>
          )}
        </View>
      )}

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.floatingAddButton}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      {/* Add Modal */}
      <AddWishlistModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddWishlistItem}
        currentLocation={location}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 8,
    marginBottom: 30,
  },
  addFirstButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  priorityFilter: {
    backgroundColor: "white",
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  priorityFilterContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  filterChipActive: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  filterChipText: {
    fontSize: 13,
    color: theme.colors.gray,
    marginLeft: 4,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "white",
  },
  viewToggle: {
    flexDirection: "row",
    padding: 10,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: theme.colors.offWhite,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.forest,
  },
  toggleText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.forest,
  },
  toggleTextActive: {
    color: "white",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  listContainer: {
    padding: 10,
    paddingBottom: 80,
  },
  listItem: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 10,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.burntOrange + "40",
  },
  listItemContent: {
    flex: 1,
  },
  listItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  categoryText: {
    fontSize: 12,
    marginLeft: 8,
  },
  listItemDescription: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: 8,
    fontStyle: "italic",
  },
  listItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coordsText: {
    fontSize: 11,
    color: theme.colors.lightGray,
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.lightGray,
  },
  actionButtons: {
    flexDirection: "column",
    justifyContent: "center",
  },
  actionButton: {
    padding: 8,
    marginVertical: 4,
  },
  visitedButton: {
    backgroundColor: theme.colors.forest + "10",
    borderRadius: 20,
  },
  deleteButton: {},
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  mapLegend: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 8,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendClose: {
    position: "absolute",
    top: 5,
    right: 5,
    padding: 5,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 4,
  },
  legendText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  floatingAddButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.burntOrange,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  noResults: {
    padding: 40,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 16,
    color: theme.colors.gray,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
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
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  categoryScroll: {
    marginBottom: 15,
    maxHeight: 40,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
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
  priorityContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  priorityOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
    color: theme.colors.gray,
  },
  currentLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    marginBottom: 10,
  },
  currentLocationText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.forest,
  },
  searchContainer: {
    flexDirection: "row",
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  searchButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  searchButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  orText: {
    textAlign: "center",
    color: theme.colors.gray,
    marginVertical: 10,
    fontSize: 12,
  },
  manualCoordsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderStyle: "dashed",
  },
  manualCoordsText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.navy,
  },
  coordinatesContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
  },
  coordInputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  coordInput: {
    flex: 1,
    marginHorizontal: 5,
  },
  setCoordinatesButton: {
    backgroundColor: theme.colors.navy,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  setCoordinatesButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  coordHelpText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  selectedLocationBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest + "10",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  selectedLocationText: {
    marginLeft: 8,
    fontSize: 13,
    color: theme.colors.forest,
  },
  helpBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.offWhite,
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  helpText: {
    marginLeft: 8,
    fontSize: 12,
    color: theme.colors.gray,
    flex: 1,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.burntOrange,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 10,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
