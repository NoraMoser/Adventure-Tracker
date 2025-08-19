// saved-spots.tsx - Clean version with pull-to-refresh and animations
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Linking,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch, // Added Switch import
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
import { useFriends } from "../contexts/FriendsContext";
import { useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext";
import { ShareService } from "../services/shareService";

const { width } = Dimensions.get("window");

// Rating Component
const RatingStars = ({
  rating,
  onRate,
  size = 20,
  editable = false,
  showCount = false,
  reviewCount = 0,
}: {
  rating: number;
  onRate?: (rating: number) => void;
  size?: number;
  editable?: boolean;
  showCount?: boolean;
  reviewCount?: number;
}) => {
  const [tempRating, setTempRating] = useState(0);

  return (
    <View style={styles.ratingContainer}>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            disabled={!editable}
            onPress={() => onRate?.(star)}
            onPressIn={() => editable && setTempRating(star)}
            onPressOut={() => editable && setTempRating(0)}
          >
            <Ionicons
              name={star <= (tempRating || rating) ? "star" : "star-outline"}
              size={size}
              color={
                star <= (tempRating || rating)
                  ? "#FFD700"
                  : theme.colors.lightGray
              }
            />
          </TouchableOpacity>
        ))}
      </View>
      {showCount && reviewCount > 0 && (
        <Text style={styles.reviewCount}>({reviewCount})</Text>
      )}
    </View>
  );
};

// Review Modal Component
const ReviewModal = ({
  visible,
  onClose,
  spot,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  spot: any;
  onSubmit: (rating: number, review: string) => void;
}) => {
  const [rating, setRating] = useState(spot?.rating || 0);
  const [review, setReview] = useState("");

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert("Please add a rating", "Tap the stars to rate this location");
      return;
    }
    onSubmit(rating, review);
    setRating(0);
    setReview("");
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
        <View style={styles.reviewModalContent}>
          <View style={styles.reviewModalHeader}>
            <Text style={styles.reviewModalTitle}>Rate & Review</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.spotNameInModal}>{spot?.name}</Text>

          <View style={styles.ratingSection}>
            <Text style={styles.ratingLabel}>Your Rating</Text>
            <RatingStars
              rating={rating}
              onRate={setRating}
              size={32}
              editable={true}
            />
          </View>

          <Text style={styles.reviewLabel}>Your Review (Optional)</Text>
          <TextInput
            style={styles.reviewInput}
            placeholder="What did you think of this place?"
            value={review}
            onChangeText={setReview}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor={theme.colors.lightGray}
          />

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit Review</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Animated List Item Component
const AnimatedListItem = ({
  item,
  index,
  onPress,
  onRate,
  onShare,
  onDirections,
  onEdit,
  onDelete,
  onShareWithFriends,
  formatDistance,
  location,
}: {
  item: any;
  index: number;
  onPress: (item: any) => void;
  onRate: (item: any) => void;
  onShare: (item: any) => void;
  onDirections: (item: any) => void;
  onEdit: (item: any) => void;
  onDelete: (id: string, name: string) => void;
  onShareWithFriends: (item: any) => void;
  formatDistance: (distance: number) => string;
  location: any;
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 400,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, [index]);

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 3,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  // Fix the category typing issue
  const categoryKey = item.category as CategoryType;
  const category = categories[categoryKey] || categories.other;
  
  const distance = location
    ? calculateDistance(
        location.latitude,
        location.longitude,
        item.location.latitude,
        item.location.longitude
      )
    : null;

  return (
    <Animated.View
      style={[
        styles.listItem,
        {
          opacity: animatedValue,
          transform: [
            {
              translateX: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0],
              }),
            },
            { scale: scaleValue },
          ],
        },
      ]}
    >
      <TouchableOpacity
        onPress={() => onPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.listItemTouchable}
      >
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
                <Text style={[styles.categoryBadge, { color: category.color }]}>
                  {category.label}
                </Text>
                {distance && (
                  <Text style={styles.distanceText}>
                    • {formatDistance(distance)}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Rating Display */}
          <View style={styles.ratingRow}>
            <RatingStars
              rating={item.rating || 0}
              size={16}
              showCount={true}
              reviewCount={item.reviews?.length || 0}
            />
            {!item.rating && (
              <TouchableOpacity onPress={() => onRate(item)}>
                <Text style={styles.addRatingText}>Add rating</Text>
              </TouchableOpacity>
            )}
          </View>

          {item.description && (
            <Text style={styles.listItemDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Photo Thumbnails */}
          {item.photos && item.photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photoThumbnails}
            >
              {item.photos
                .slice(0, 5)
                .map((photo: string, photoIndex: number) => (
                  <View key={photoIndex} style={styles.thumbnailContainer}>
                    <Image source={{ uri: photo }} style={styles.thumbnail} />
                    {photoIndex === 4 && item.photos.length > 5 && (
                      <View style={styles.morePhotosOverlay}>
                        <Text style={styles.morePhotosText}>
                          +{item.photos.length - 5}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
            </ScrollView>
          )}

          <View style={styles.listItemFooter}>
            <Text style={styles.listItemDate}>
              {new Date(item.timestamp).toLocaleDateString()}
            </Text>
          </View>

          {/* Photo count badge */}
          {item.photos && item.photos.length > 0 && (
            <View style={styles.photoBadge}>
              <Ionicons name="camera" size={12} color={theme.colors.white} />
              <Text style={styles.photoBadgeText}>{item.photos.length}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rateButton]}
            onPress={() => onRate(item)}
          >
            <Ionicons name="star-outline" size={20} color="#FFD700" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.friendsShareButton]}
            onPress={() => onShareWithFriends(item)}
          >
            <Ionicons
              name="people-outline"
              size={20}
              color={theme.colors.navy}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={() => onShare(item)}
          >
            <Ionicons
              name="share-social-outline"
              size={20}
              color={theme.colors.forest}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.directionsButton]}
            onPress={() => onDirections(item)}
          >
            <Ionicons
              name="navigate-outline"
              size={20}
              color={theme.colors.navy}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => onEdit(item)}
          >
            <Ionicons
              name="create-outline"
              size={20}
              color={theme.colors.gray}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => onDelete(item.id, item.name)}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={theme.colors.burntOrange}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Calculate distance helper
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const ShareLocationModal = ({
  visible,
  onClose,
  location,
  onShare,
}: {
  visible: boolean;
  onClose: () => void;
  location: any;
  onShare: (selectedFriends: string[], message?: string) => void;
}) => {
  const { friends } = useFriends();
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [shareMessage, setShareMessage] = useState("");
  const [shareToAll, setShareToAll] = useState(false);
  const [includePhotos, setIncludePhotos] = useState(true);

  // Debug logging
  React.useEffect(() => {
    if (visible) {
      console.log("ShareLocationModal opened with location:", location);
      console.log("Available friends:", friends);
    }
  }, [visible, location, friends]);

  const toggleFriend = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter((id) => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  const handleShare = () => {
    console.log("handleShare called");
    const friendsToShare = shareToAll
      ? friends.map((f) => f.id)
      : selectedFriends;
    console.log("Friends to share with:", friendsToShare);
    
    if (friendsToShare.length === 0) {
      Alert.alert(
        "Select Friends",
        "Please select at least one friend to share with"
      );
      return;
    }
    onShare(friendsToShare, shareMessage);
    onClose();
    // Reset state
    setSelectedFriends([]);
    setShareMessage("");
    setShareToAll(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={shareModalStyles.overlay}>
        <View style={shareModalStyles.content}>
          <View style={shareModalStyles.header}>
            <Text style={shareModalStyles.title}>Share Location</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <View style={shareModalStyles.locationPreview}>
            <View style={shareModalStyles.previewHeader}>
              <Ionicons
                name={categories[location?.category as CategoryType]?.icon || "location"}
                size={20}
                color={
                  categories[location?.category as CategoryType]?.color || theme.colors.forest
                }
              />
              <Text style={shareModalStyles.previewName}>{location?.name}</Text>
            </View>
            {location?.description && (
              <Text style={shareModalStyles.previewDescription}>
                {location.description}
              </Text>
            )}
            {location?.photos && location.photos.length > 0 && (
              <View style={shareModalStyles.photoToggle}>
                <Text style={shareModalStyles.photoToggleText}>
                  Include {location.photos.length} photo
                  {location.photos.length > 1 ? "s" : ""}
                </Text>
                <Switch
                  value={includePhotos}
                  onValueChange={(value: boolean) => setIncludePhotos(value)}
                  trackColor={{
                    false: theme.colors.borderGray,
                    true: theme.colors.forest,
                  }}
                />
              </View>
            )}
          </View>

          <TextInput
            style={shareModalStyles.messageInput}
            placeholder="Add a message (optional)..."
            value={shareMessage}
            onChangeText={setShareMessage}
            multiline
            numberOfLines={3}
            placeholderTextColor={theme.colors.lightGray}
          />

          <View style={shareModalStyles.shareToAll}>
            <Text style={shareModalStyles.shareToAllText}>
              Share with all friends
            </Text>
            <Switch
              value={shareToAll}
              onValueChange={(value: boolean) => setShareToAll(value)}
              trackColor={{
                false: theme.colors.borderGray,
                true: theme.colors.forest,
              }}
            />
          </View>

          {!shareToAll && (
            <ScrollView style={shareModalStyles.friendsList}>
              <Text style={shareModalStyles.friendsTitle}>Select Friends:</Text>
              {friends
                .filter((f) => f.status === "accepted")
                .map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={shareModalStyles.friendItem}
                    onPress={() => toggleFriend(friend.id)}
                  >
                    <View style={shareModalStyles.friendInfo}>
                      <Text style={shareModalStyles.friendAvatar}>
                        {friend.avatar || "👤"}
                      </Text>
                      <Text style={shareModalStyles.friendName}>
                        {friend.displayName}
                      </Text>
                    </View>
                    <Ionicons
                      name={
                        selectedFriends.includes(friend.id)
                          ? "checkbox"
                          : "square-outline"
                      }
                      size={24}
                      color={
                        selectedFriends.includes(friend.id)
                          ? theme.colors.forest
                          : theme.colors.gray
                      }
                    />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          )}

          <View style={shareModalStyles.actions}>
            <TouchableOpacity
              style={shareModalStyles.cancelBtn}
              onPress={onClose}
            >
              <Text style={shareModalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={shareModalStyles.shareBtn}
              onPress={handleShare}
            >
              <Ionicons name="share-social" size={20} color="white" />
              <Text style={shareModalStyles.shareText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function SavedSpotsScreen() {
  const { savedSpots, deleteSpot, updateSpot, location, getLocation } =
    useLocation();
  const { formatDistance, settings, getMapTileUrl } = useSettings();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedSpot, setSelectedSpot] = useState<any>(null);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<
    CategoryType | "all"
  >("all");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [spotToReview, setSpotToReview] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "distance" | "rating">(
    "date"
  );
  const [showSearchBar, setShowSearchBar] = useState(false);
  const webViewRef = React.useRef<WebView>(null);
  const { shareLocation, friends, privacySettings } = useFriends();
  const [showShareModal, setShowShareModal] = useState(false);
  const [locationToShare, setLocationToShare] = useState<any>(null);
  const [autoShareEnabled, setAutoShareEnabled] = useState(
    privacySettings.shareLocationsWithFriends
  );

  // Pull to refresh handler
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await getLocation();
    } finally {
      setRefreshing(false);
    }
  }, [getLocation]);

  useEffect(() => {
    if (!location) {
      getLocation();
    }
  }, []);

  // Filter and sort spots
  const filteredSpots = useMemo(() => {
    let spots = savedSpots;

    if (selectedCategory !== "all") {
      spots = spots.filter((spot) => spot.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      spots = spots.filter(
        (spot) =>
          spot.name.toLowerCase().includes(query) ||
          (spot.description &&
            spot.description.toLowerCase().includes(query)) ||
          spot.category.toLowerCase().includes(query)
      );
    }

    const sorted = [...spots].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "distance":
          if (location) {
            const distA = calculateDistance(
              location.latitude,
              location.longitude,
              a.location.latitude,
              a.location.longitude
            );
            const distB = calculateDistance(
              location.latitude,
              location.longitude,
              b.location.latitude,
              b.location.longitude
            );
            return distA - distB;
          }
          return 0;
        case "date":
        default:
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
      }
    });

    return sorted;
  }, [savedSpots, selectedCategory, searchQuery, sortBy, location]);

  const handleDeleteSpot = (spotId: string, spotName: string) => {
    Alert.alert(
      "Delete Location",
      `Are you sure you want to delete "${spotName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteSpot(spotId),
        },
      ]
    );
  };

  const handleShareSpot = async (spot: any) => {
    try {
      if (spot.photos && spot.photos.length > 0) {
        await ShareService.shareLocationWithPhotos(spot);
      } else {
        await ShareService.shareLocation(spot);
      }
    } catch (error) {
      console.error("Error sharing:", error);
      Alert.alert("Error", "Failed to share location");
    }
  };

  const handleRateSpot = (spot: any) => {
    setSpotToReview(spot);
    setShowReviewModal(true);
  };

  const handleSubmitReview = async (rating: number, review: string) => {
    if (!spotToReview) return;

    const updatedSpot = {
      ...spotToReview,
      rating,
      reviews: [...(spotToReview.reviews || []), review].filter((r) => r),
    };

    await updateSpot(spotToReview.id, updatedSpot);
    setSpotToReview(null);
  };

  const handleSpotPress = (spot: any) => {
    setSelectedSpot(spot);
    if (spot.photos && spot.photos.length > 0) {
      setSelectedPhotoIndex(0);
      setShowPhotoGallery(true);
    }
  };

  const handleGetDirections = (spot: any) => {
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
        console.error("Error opening maps:", err);
      });
  };

  const handleEditSpot = (spot: any) => {
    router.push({
      pathname: "/edit-location",
      params: { spotId: spot.id },
    });
  };

  const handleShareWithFriends = (spot: any) => {
    console.log("handleShareWithFriends called with spot:", spot.name);
    console.log("Friends:", friends);
    console.log("Accepted friends count:", friends.filter((f) => f.status === "accepted").length);
    
    if (friends.filter((f) => f.status === "accepted").length === 0) {
      Alert.alert(
        "No Friends Yet",
        "Add some friends to share your locations with them!",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Find Friends", onPress: () => router.push("/friends") },
        ]
      );
      return;
    }
    console.log("Setting location to share and showing modal");
    setLocationToShare(spot);
    setShowShareModal(true);
  };

  const handleShareToFriends = async (
    selectedFriends: string[],
    message?: string
  ) => {
    try {
      await shareLocation(locationToShare.id, selectedFriends);
      Alert.alert("Success", "Location shared with friends!");
      setShowShareModal(false);
      setLocationToShare(null);
    } catch (error) {
      Alert.alert("Error", "Failed to share location with friends");
    }
  };

  const renderListItem = ({ item, index }: { item: any; index: number }) => (
    <AnimatedListItem
      item={item}
      index={index}
      onPress={handleSpotPress}
      onRate={handleRateSpot}
      onShare={handleShareSpot}
      onDirections={handleGetDirections}
      onEdit={handleEditSpot}
      onDelete={handleDeleteSpot}
      onShareWithFriends={handleShareWithFriends}
      formatDistance={formatDistance}
      location={location}
    />
  );

  const ListEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="location-outline" size={80} color="#ccc" />
      <Text style={styles.emptyText}>No saved locations yet</Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push("/save-location")}
      >
        <Text style={styles.addButtonText}>Add Your First Location</Text>
      </TouchableOpacity>
    </View>
  );

  if (savedSpots.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Saved Spots",
            headerStyle: {
              backgroundColor: theme.colors.forest,
            },
            headerTintColor: "#fff",
            headerTitleStyle: {
              fontWeight: "bold",
            },
          }}
        />
        <ListEmptyComponent />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Saved Spots",
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />

      {/* Category Filter */}
      {friends.filter((f) => f.status === "accepted").length > 0 && (
        <View style={autoShareStyles.container}>
          <View style={autoShareStyles.content}>
            <Ionicons name="people" size={20} color={theme.colors.forest} />
            <Text style={autoShareStyles.text}>
              Auto-share new spots with friends
            </Text>
          </View>
          <Switch
            value={autoShareEnabled}
            onValueChange={(value: boolean) => {
              setAutoShareEnabled(value);
              // Update privacy settings
            }}
            trackColor={{
              false: theme.colors.borderGray,
              true: theme.colors.forest,
            }}
            thumbColor={
              autoShareEnabled ? theme.colors.white : theme.colors.lightGray
            }
          />
        </View>
      )}
      <View style={styles.categoryFilterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryFilter}
          contentContainerStyle={styles.categoryFilterContent}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedCategory === "all" && styles.filterChipActive,
            ]}
            onPress={() => setSelectedCategory("all")}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedCategory === "all" && styles.filterChipTextActive,
              ]}
            >
              All ({savedSpots.length})
            </Text>
          </TouchableOpacity>
          {categoryList.map((category) => {
            const count = savedSpots.filter(
              (s) => s.category === category.id
            ).length;
            if (count === 0) return null;
            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.filterChip,
                  selectedCategory === category.id && {
                    backgroundColor: category.color,
                  },
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Ionicons
                  name={category.icon}
                  size={16}
                  color={
                    selectedCategory === category.id ? "white" : category.color
                  }
                />
                <Text
                  style={[
                    styles.filterChipText,
                    selectedCategory === category.id && { color: "white" },
                  ]}
                >
                  {category.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <ShareLocationModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          location={locationToShare}
          onShare={handleShareToFriends}
        />
      </View>

      {/* Main List with Pull to Refresh */}
      <FlatList
        data={filteredSpots}
        renderItem={renderListItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          filteredSpots.length === 0
            ? styles.emptyListContainer
            : styles.listContainer
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.forest}
            colors={[theme.colors.forest]}
            title="Pull to refresh"
            titleColor={theme.colors.gray}
          />
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        initialNumToRender={10}
        windowSize={10}
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.floatingAddButton}
        onPress={() => router.push("/save-location")}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      {/* Review Modal */}
      <ReviewModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        spot={spotToReview}
        onSubmit={handleSubmitReview}
      />

      {/* Photo Gallery Modal */}
      <Modal
        visible={showPhotoGallery}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoGallery(false)}
      >
        <View style={styles.galleryContainer}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>{selectedSpot?.name}</Text>
            <TouchableOpacity
              onPress={() => setShowPhotoGallery(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color={theme.colors.white} />
            </TouchableOpacity>
          </View>

          {selectedSpot?.photos && selectedSpot.photos.length > 0 && (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const newIndex = Math.round(
                    e.nativeEvent.contentOffset.x / width
                  );
                  setSelectedPhotoIndex(newIndex);
                }}
              >
                {selectedSpot.photos.map((photo: string, index: number) => (
                  <View key={index} style={styles.photoSlide}>
                    <Image
                      source={{ uri: photo }}
                      style={styles.fullPhoto}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </ScrollView>

              <View style={styles.photoCounter}>
                <Text style={styles.photoCounterText}>
                  {selectedPhotoIndex + 1} / {selectedSpot.photos.length}
                </Text>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  friendsShareButton: {
    backgroundColor: theme.colors.navy + "10",
    borderRadius: 20,
    marginBottom: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    padding: 20,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    color: theme.colors.gray,
    marginTop: 20,
    marginBottom: 30,
  },
  addButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  categoryFilterWrapper: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  categoryFilter: {
    paddingVertical: 10,
    maxHeight: 60,
  },
  categoryFilterContent: {
    paddingHorizontal: 10,
    paddingRight: 20,
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
  listContainer: {
    padding: 10,
    paddingBottom: 80,
  },
  listItem: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listItemTouchable: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
  },
  listItemContent: {
    flex: 1,
    position: "relative",
  },
  listItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
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
    marginTop: 2,
  },
  categoryBadge: {
    fontSize: 12,
    fontWeight: "500",
  },
  distanceText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  starsContainer: {
    flexDirection: "row",
  },
  reviewCount: {
    fontSize: 12,
    color: theme.colors.gray,
    marginLeft: 6,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  addRatingText: {
    fontSize: 12,
    color: theme.colors.forest,
    marginLeft: 8,
    textDecorationLine: "underline",
  },
  listItemDescription: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 5,
    marginBottom: 10,
  },
  photoThumbnails: {
    marginVertical: 10,
    flexDirection: "row",
  },
  thumbnailContainer: {
    marginRight: 8,
    position: "relative",
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  morePhotosOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  morePhotosText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  photoBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: theme.colors.forest,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoBadgeText: {
    color: "white",
    fontSize: 12,
    marginLeft: 4,
    fontWeight: "600",
  },
  listItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listItemDate: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  actionButtons: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  actionButton: {
    padding: 8,
    marginVertical: 2,
  },
  rateButton: {
    backgroundColor: "#FFF8DC",
    borderRadius: 20,
    marginBottom: 5,
  },
  shareButton: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    marginBottom: 5,
  },
  directionsButton: {},
  editButton: {},
  deleteButton: {},
  floatingAddButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.forest,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  reviewModalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  reviewModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  reviewModalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  spotNameInModal: {
    fontSize: 16,
    color: theme.colors.gray,
    marginBottom: 20,
  },
  ratingSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
    marginBottom: 10,
  },
  reviewLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  reviewInput: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 20,
    color: theme.colors.navy,
  },
  submitButton: {
    backgroundColor: theme.colors.forest,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  // Gallery styles
  galleryContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
  },
  galleryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 50,
  },
  galleryTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  photoSlide: {
    width: width,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullPhoto: {
    width: width,
    height: "70%",
  },
  photoCounter: {
    position: "absolute",
    bottom: 120,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  photoCounterText: {
    color: "white",
    fontSize: 14,
  },
});

const shareModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 30,
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
  locationPreview: {
    backgroundColor: theme.colors.offWhite,
    margin: 20,
    padding: 15,
    borderRadius: 12,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  previewName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginLeft: 8,
  },
  previewDescription: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 5,
  },
  photoToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  photoToggleText: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  messageInput: {
    backgroundColor: theme.colors.offWhite,
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    color: theme.colors.navy,
    minHeight: 80,
    textAlignVertical: "top",
  },
  shareToAll: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
  },
  shareToAllText: {
    fontSize: 16,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  friendsList: {
    maxHeight: 200,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  friendsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
    marginBottom: 10,
  },
  friendItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  friendInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendAvatar: {
    fontSize: 20,
    marginRight: 10,
  },
  friendName: {
    fontSize: 14,
    color: theme.colors.navy,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
  },
  cancelText: {
    fontSize: 16,
    color: theme.colors.gray,
    fontWeight: "600",
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: theme.colors.forest,
  },
  shareText: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
});

const autoShareStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.forest + "10",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.forest + "20",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.forest,
    fontWeight: "500",
  },
});