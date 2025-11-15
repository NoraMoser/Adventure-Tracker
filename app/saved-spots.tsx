// app/saved-spots.tsx - Complete file with date display
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import AddToTripButton from "../components/AddToTripButton";
import { TouchableImage } from "../components/TouchableImage";
import { categories, CategoryType } from "../constants/categories";
import { theme } from "../constants/theme";
import { SavedSpot, useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext";
import { ShareService } from "../services/shareService";
// Filter modal component
const FilterModal = ({
  visible,
  onClose,
  selectedCategories,
  onToggleCategory,
  onClearAll,
  onSelectAll,
}: {
  visible: boolean;
  onClose: () => void;
  selectedCategories: Set<CategoryType>;
  onToggleCategory: (category: CategoryType) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
}) => {
  const categoryList = Object.entries(categories) as [
    CategoryType,
    (typeof categories)[CategoryType]
  ][];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={filterStyles.overlay}>
        <View style={filterStyles.container}>
          <View style={filterStyles.header}>
            <Text style={filterStyles.title}>Filter by Category</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <View style={filterStyles.actions}>
            <TouchableOpacity
              onPress={onSelectAll}
              style={filterStyles.actionButton}
            >
              <Text style={filterStyles.actionText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClearAll}
              style={filterStyles.actionButton}
            >
              <Text style={filterStyles.actionText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={filterStyles.list}>
            {categoryList.map(([key, category]) => (
              <TouchableOpacity
                key={key}
                style={filterStyles.item}
                onPress={() => onToggleCategory(key)}
              >
                <View style={filterStyles.itemLeft}>
                  <View
                    style={[
                      filterStyles.categoryDot,
                      { backgroundColor: category.color },
                    ]}
                  />
                  <Text style={filterStyles.itemText}>{category.label}</Text>
                </View>
                <Ionicons
                  name={
                    selectedCategories.has(key) ? "checkbox" : "square-outline"
                  }
                  size={24}
                  color={
                    selectedCategories.has(key)
                      ? theme.colors.forest
                      : theme.colors.gray
                  }
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={filterStyles.applyButton} onPress={onClose}>
            <Text style={filterStyles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Spot Detail Modal Component
const SpotDetailModal = ({
  visible,
  spot,
  onClose,
  onEdit,
  onDelete,
  onShare,
  onNavigate,
}: {
  visible: boolean;
  spot: SavedSpot | null;
  onClose: () => void;
  onEdit: (spot: SavedSpot) => void;
  onDelete: (spot: SavedSpot) => void;
  onShare: (spot: SavedSpot) => void;
  onNavigate: (spot: SavedSpot) => void;
}) => {
  if (!spot) return null;

  const category = categories[spot.category] || categories.other;

  const formatCoords = (lat: number, lng: number) => {
    const latDir = lat >= 0 ? "N" : "S";
    const lngDir = lng >= 0 ? "E" : "W";
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(
      4
    )}°${lngDir}`;
  };

  const formatDetailDate = () => {
    const dateToFormat = spot.locationDate || spot.timestamp;
    if (!dateToFormat) return "";

    const d = new Date(dateToFormat);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={detailStyles.overlay}>
        <View style={detailStyles.container}>
          <View style={detailStyles.header}>
            <View style={detailStyles.headerLeft}>
              <View
                style={[
                  detailStyles.categoryBadge,
                  { backgroundColor: category.color + "20" },
                ]}
              >
                <View
                  style={[
                    detailStyles.categoryDot,
                    { backgroundColor: category.color },
                  ]}
                />
                <Text
                  style={[detailStyles.categoryText, { color: category.color }]}
                >
                  {category.label}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={detailStyles.name}>{spot.name}</Text>

            {/* Date display in detail modal */}
            <View style={detailStyles.dateContainer}>
              <Ionicons name="calendar" size={16} color={theme.colors.forest} />
              <Text style={detailStyles.dateText}>
                Visited {formatDetailDate()}
              </Text>
            </View>

            {spot.rating && spot.rating > 0 && (
              <View style={detailStyles.rating}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= spot.rating! ? "star" : "star-outline"}
                    size={20}
                    color="#FFB800"
                  />
                ))}
              </View>
            )}

            {spot.description && (
              <Text style={detailStyles.description}>{spot.description}</Text>
            )}

            <View style={detailStyles.infoSection}>
              <Ionicons
                name="location"
                size={20}
                color={theme.colors.burntOrange}
              />
              <Text style={detailStyles.coordinates}>
                {formatCoords(spot.location.latitude, spot.location.longitude)}
              </Text>
            </View>

            {spot.photos && spot.photos.length > 0 && (
              <View style={detailStyles.photosSection}>
                <Text style={detailStyles.sectionTitle}>Photos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {spot.photos.map((photo, index) => (
                    <TouchableImage
                      key={index}
                      source={{ uri: photo }}
                      style={detailStyles.photo}
                      images={spot.photos}
                      imageIndex={index}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={detailStyles.actions}>
              <TouchableOpacity
                style={[
                  detailStyles.actionButton,
                  { backgroundColor: theme.colors.forest },
                ]}
                onPress={() => onNavigate(spot)}
              >
                <Ionicons name="navigate" size={20} color="white" />
                <Text style={detailStyles.actionButtonText}>Navigate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  detailStyles.actionButton,
                  { backgroundColor: theme.colors.navy },
                ]}
                onPress={() => onShare(spot)}
              >
                <Ionicons name="share-social" size={20} color="white" />
                <Text style={detailStyles.actionButtonText}>Share</Text>
              </TouchableOpacity>
            </View>

            <View style={detailStyles.secondaryActions}>
              <TouchableOpacity
                style={detailStyles.secondaryButton}
                onPress={() => onEdit(spot)}
              >
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={theme.colors.navy}
                />
                <Text style={detailStyles.secondaryButtonText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  detailStyles.secondaryButton,
                  { borderColor: "#FF4757" },
                ]}
                onPress={() => onDelete(spot)}
              >
                <Ionicons name="trash-outline" size={20} color="#FF4757" />
                <Text
                  style={[
                    detailStyles.secondaryButtonText,
                    { color: "#FF4757" },
                  ]}
                >
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Update the AnimatedListItem component props
const AnimatedListItem = ({
  item,
  index,
  onPress,
  onRate,
  onDelete,
  onShare, // Add this
}: {
  item: SavedSpot;
  index: number;
  onPress: (item: SavedSpot) => void;
  onRate: (item: SavedSpot, rating: number) => void;
  onDelete: (item: SavedSpot) => void;
  onShare: (item: SavedSpot) => void; // Add this
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const category = categories[item.category] || categories.other;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 300,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const formatLocationDate = () => {
    const dateToFormat = item.locationDate || item.timestamp;
    if (!dateToFormat) return "";

    const d = new Date(dateToFormat);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    // Create date-only versions (midnight local time)
    const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const yesterdayOnly = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate()
    );

    // Compare the date-only versions
    if (dateOnly.getTime() === todayOnly.getTime()) {
      return "Today";
    }
    if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return "Yesterday";
    }

    // For older dates, calculate days ago
    const diffTime = todayOnly.getTime() - dateOnly.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 7 && diffDays > 1) return `${diffDays} days ago`;
    if (diffDays < 30 && diffDays >= 7) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
    }

    // Otherwise show date
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  };
  return (
    <Animated.View
      style={[
        styles.card,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.7}>
        <View style={styles.cardContent}>
          {/* Date row at the top of the card */}
          <View style={styles.dateRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={theme.colors.gray}
            />
            <Text style={styles.dateText}>{formatLocationDate()}</Text>
          </View>

          <View style={styles.cardHeader}>
            <View style={styles.cardLeft}>
              <View
                style={[
                  styles.categoryIndicator,
                  { backgroundColor: category.color },
                ]}
              />
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.categoryBadge}>
                  <Text
                    style={[styles.cardCategory, { color: category.color }]}
                  >
                    {category.label}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {item.description && (
            <Text style={styles.cardDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.cardFooter}>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onRate(item, star);
                  }}
                >
                  <Ionicons
                    name={star <= (item.rating || 0) ? "star" : "star-outline"}
                    size={18}
                    color="#FFB800"
                    style={styles.star}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.cardActions}>
              <AddToTripButton
                item={item}
                type="spot"
                iconSize={28}
                style={{ marginRight: 8 }}
              />
              <TouchableOpacity
                onPress={() => onDelete(item)}
                style={styles.actionIcon}
              >
                <Ionicons name="trash-outline" size={20} color="#FF4757" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionIcon}
                onPress={() => onShare(item)} // Add this
              >
                <Ionicons
                  name="share-social-outline"
                  size={20}
                  color={theme.colors.navy}
                />
              </TouchableOpacity>
            </View>
          </View>

          {item.photos && item.photos.length > 0 && (
            <View style={styles.photoIndicator}>
              <Ionicons name="images" size={16} color="white" />
              <Text style={styles.photoCount}>{item.photos.length}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function SavedSpotsScreen() {
  const router = useRouter();
  const { savedSpots, deleteSpot, updateSpot, location } = useLocation();
  const { getMapTileUrl } = useSettings();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<
    Set<CategoryType>
  >(new Set(Object.keys(categories) as CategoryType[]));
  const [sortBy, setSortBy] = useState<"date" | "visited" | "name" | "rating">(
    "visited"
  );
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<SavedSpot | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filter and sort spots
  const filteredSpots = useMemo(() => {
    let filtered = savedSpots.filter((spot) => {
      const matchesSearch =
        spot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (spot.description &&
          spot.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategories.has(spot.category);
      return matchesSearch && matchesCategory;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "visited":
          // Sort by when the location was visited
          const dateA = new Date(a.locationDate || a.timestamp).getTime();
          const dateB = new Date(b.locationDate || b.timestamp).getTime();
          return dateB - dateA;
        case "date":
        default:
          // Sort by when added to app
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
      }
    });

    return filtered;
  }, [savedSpots, searchQuery, selectedCategories, sortBy]);

  const handleToggleCategory = (category: CategoryType) => {
    const newCategories = new Set(selectedCategories);
    if (newCategories.has(category)) {
      newCategories.delete(category);
    } else {
      newCategories.add(category);
    }
    setSelectedCategories(newCategories);
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories(new Set(Object.keys(categories) as CategoryType[]));
  };

  const handleClearAllCategories = () => {
    setSelectedCategories(new Set());
  };

  const handleDeleteSpot = (spot: SavedSpot) => {
    Alert.alert(
      "Delete Location",
      `Are you sure you want to delete "${spot.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            deleteSpot(spot.id);
            setShowDetailModal(false);
          },
        },
      ]
    );
  };

  const handleUpdateRating = async (spot: SavedSpot, rating: number) => {
    const updatedSpot = { ...spot, rating };
    await updateSpot(spot.id, updatedSpot);
  };

  const handleShareSpot = async (spot: SavedSpot) => {
    try {
      await ShareService.shareLocation(spot);
    } catch (error) {
      Alert.alert("Error", "Failed to share location");
    }
  };

  const handleNavigateToSpot = async (spot: SavedSpot) => {
    try {
      await ShareService.openInMaps(
        spot.location.latitude,
        spot.location.longitude,
        spot.name
      );
    } catch (error) {
      Alert.alert("Error", "Failed to open in maps");
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleSpotPress = (spot: SavedSpot) => {
    setSelectedSpot(spot);
    setShowDetailModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleEditSpot = (spot: SavedSpot) => {
    setShowDetailModal(false);
    router.push({
      pathname: "/edit-location",
      params: { spotId: spot.id },
    });
  };

  const generateMapHTML = () => {
    const tileUrl = getMapTileUrl();

    let centerLat = 47.6062;
    let centerLng = -122.3321;

    if (filteredSpots.length > 0) {
      const lats = filteredSpots.map((s) => s.location.latitude);
      const lngs = filteredSpots.map((s) => s.location.longitude);
      centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    } else if (location) {
      centerLat = location.latitude;
      centerLng = location.longitude;
    }

    const markers = filteredSpots
      .map((spot) => {
        const category = categories[spot.category] || categories.other;
        const safeName = spot.name.replace(/'/g, "\\'");
        return `
        L.circleMarker([${spot.location.latitude}, ${
          spot.location.longitude
        }], {
          radius: 8,
          fillColor: '${category.color}',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(map).bindPopup(\`
          <div style="text-align: center;">
            <b>${safeName}</b><br>
            <small>${category.label}</small><br>
            ${spot.rating ? `${"⭐".repeat(spot.rating)}` : ""}
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
        var map = L.map('map').setView([${centerLat}, ${centerLng}], 13);
        
        L.tileLayer('${tileUrl}', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);
        
        ${markers}
        
        setTimeout(function() {
          if (${filteredSpots.length} > 0) {
            var coordinates = [
              ${filteredSpots
                .map(
                  (spot) =>
                    `[${spot.location.latitude}, ${spot.location.longitude}]`
                )
                .join(",")}
            ];
            
            if (coordinates.length === 1) {
              map.setView(coordinates[0], 15);
            } else {
              var bounds = L.latLngBounds(coordinates);
              map.fitBounds(bounds, {
                padding: [80, 80],
                maxZoom: 14
              });
            }
          }
        }, 100);
      </script>
    </body>
    </html>
  `;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search locations..."
            value={searchQuery}
            onChangeText={setSearchQuery}
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

        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="filter" size={20} color={theme.colors.forest} />
            <Text style={styles.filterText}>Filter</Text>
            {selectedCategories.size < Object.keys(categories).length && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {selectedCategories.size}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => {
              const options = ["visited", "date", "name", "rating"] as const;
              const currentIndex = options.indexOf(sortBy);
              setSortBy(options[(currentIndex + 1) % options.length]);
            }}
          >
            <Ionicons
              name="swap-vertical"
              size={20}
              color={theme.colors.navy}
            />
            <Text style={styles.sortText}>
              {sortBy === "visited" ? "visited" : sortBy}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.viewButton,
              viewMode === "map" && styles.viewButtonActive,
            ]}
            onPress={() => setViewMode(viewMode === "list" ? "map" : "list")}
          >
            <Ionicons
              name={viewMode === "list" ? "map" : "list"}
              size={20}
              color={viewMode === "map" ? "white" : theme.colors.burntOrange}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {filteredSpots.length}{" "}
          {filteredSpots.length === 1 ? "location" : "locations"}
        </Text>
        {searchQuery && (
          <Text style={styles.summarySubtext}>
            matching &quot;{searchQuery}&quot;
          </Text>
        )}
      </View>

      {/* Content */}
      {viewMode === "list" ? (
        <FlatList
          data={filteredSpots}
          renderItem={({ item, index }) => (
            <AnimatedListItem
              item={item}
              index={index}
              onPress={handleSpotPress}
              onRate={handleUpdateRating}
              onDelete={handleDeleteSpot}
              onShare={handleShareSpot} // Add this
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            filteredSpots.length === 0 && styles.emptyContainer,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.forest}
              colors={[theme.colors.forest]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="location-outline"
                size={80}
                color={theme.colors.lightGray}
              />
              <Text style={styles.emptyTitle}>No locations found</Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? "Try adjusting your search or filters"
                  : "Start saving your favorite spots!"}
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push("/add-location")}
              >
                <Ionicons name="add" size={24} color="white" />
                <Text style={styles.addButtonText}>Add Location</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <View style={styles.mapContainer}>
          <WebView
            style={styles.map}
            source={{ html: generateMapHTML() }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        selectedCategories={selectedCategories}
        onToggleCategory={handleToggleCategory}
        onClearAll={handleClearAllCategories}
        onSelectAll={handleSelectAllCategories}
      />

      {/* Detail Modal */}
      <SpotDetailModal
        visible={showDetailModal}
        spot={selectedSpot}
        onClose={() => setShowDetailModal(false)}
        onEdit={handleEditSpot}
        onDelete={handleDeleteSpot}
        onShare={handleShareSpot}
        onNavigate={handleNavigateToSpot}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          Alert.alert("Add Location", "How would you like to add a location?", [
            {
              text: "Current Location",
              onPress: () => router.push("/save-location"),
            },
            {
              text: "Choose on Map",
              onPress: () => router.push("/add-location"),
            },
            {
              text: "Cancel",
              style: "cancel",
            },
          ]);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={theme.colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.forest,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 1000,
  },
  header: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: theme.colors.navy,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.forest + "15",
    borderRadius: 8,
    position: "relative",
    borderWidth: 1,
    borderColor: theme.colors.forest + "30",
  },
  filterText: {
    marginLeft: 6,
    fontSize: 14,
    color: theme.colors.forest,
    fontWeight: "600",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.navy + "10",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.navy + "20",
  },
  sortText: {
    marginLeft: 6,
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  viewButton: {
    padding: 8,
    backgroundColor: theme.colors.burntOrange + "15",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.burntOrange + "30",
  },
  viewButtonActive: {
    backgroundColor: theme.colors.burntOrange,
    borderColor: theme.colors.burntOrange,
  },
  summary: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: theme.colors.forest + "08",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.forest + "15",
  },
  summaryText: {
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "600",
  },
  summarySubtext: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  listContainer: {
    padding: 15,
    paddingBottom: Platform.select({ ios: 100, android: 110 }),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    overflow: "hidden",
  },
  cardContent: {
    padding: 15,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray + "30",
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginLeft: 6,
    fontWeight: "500",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  categoryIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: theme.colors.offWhite,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  cardCategory: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cardDescription: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: 12,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ratingContainer: {
    flexDirection: "row",
  },
  star: {
    marginRight: 2,
  },
  cardActions: {
    flexDirection: "row",
  },
  actionIcon: {
    padding: 8,
  },
  photoIndicator: {
    position: "absolute",
    top: 15,
    right: 15,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.navy + "90",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoCount: {
    marginLeft: 4,
    fontSize: 12,
    color: "white",
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
    marginBottom: 30,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

const filterStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 15,
    backgroundColor: theme.colors.offWhite,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  actionText: {
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  list: {
    maxHeight: 300,
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  itemText: {
    fontSize: 16,
    color: theme.colors.navy,
  },
  applyButton: {
    backgroundColor: theme.colors.forest,
    margin: 20,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  applyButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

const detailStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "white",
    borderRadius: 20,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  headerLeft: {
    flex: 1,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
    marginHorizontal: 20,
    marginTop: 15,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 10,
  },
  dateText: {
    fontSize: 14,
    color: theme.colors.forest,
    marginLeft: 6,
  },
  rating: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 10,
  },
  description: {
    fontSize: 16,
    color: theme.colors.gray,
    marginHorizontal: 20,
    marginTop: 15,
    lineHeight: 24,
  },
  infoSection: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 20,
    padding: 15,
    backgroundColor: theme.colors.burntOrange + "10",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.burntOrange + "20",
  },
  coordinates: {
    marginLeft: 10,
    fontSize: 14,
    color: theme.colors.navy,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  photosSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 10,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 10,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 25,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  secondaryActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
    color: theme.colors.navy,
  },
});
