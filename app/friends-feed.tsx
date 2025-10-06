// friends-feed.tsx - Updated with Map View
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { TouchableImage } from "../components/TouchableImage";
import { theme } from "../constants/theme";
import { useFriends } from "../contexts/FriendsContext";
import { useSettings } from "../contexts/SettingsContext";
import { useWishlist } from "../contexts/WishlistContext";

// Keep your existing UserAvatar component exactly as is
const UserAvatar = ({
  user,
  size = 40,
  style = {},
}: {
  user: any;
  size?: number;
  style?: any;
}) => {
  if (user?.profile_picture) {
    return (
      <Image
        source={{ uri: user.profile_picture }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "#f0f0f0",
          },
          style,
        ]}
        onError={(e) => {
          console.log("Error loading profile picture:", e.nativeEvent.error);
        }}
      />
    );
  }

  if (user?.avatar) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "white",
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 1,
            borderColor: theme.colors.borderGray,
          },
          style,
        ]}
      >
        <Text style={{ fontSize: size * 0.6 }}>{user.avatar}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.lightGray + "30",
          justifyContent: "center",
          alignItems: "center",
        },
        style,
      ]}
    >
      <Ionicons name="person" size={size * 0.6} color={theme.colors.gray} />
    </View>
  );
};
// Updated generateMiniMapHTML function with better zoom for activities
const generateMiniMapHTML = (route: any[], name: string) => {
  const coords = route.map((p) => `[${p.latitude}, ${p.longitude}]`).join(",");
  const center = route[Math.floor(route.length / 2)];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 150px; width: 100%; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { 
          zoomControl: false,
          dragging: false,
          attributionControl: false
        });
        
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        
        var route = L.polyline([${coords}], {
          color: '#2d5a3d',
          weight: 3
        }).addTo(map);
        
        // Fit to bounds with tighter padding for better zoom
        map.fitBounds(route.getBounds().pad(0.05));
        
        // Optional: Set a maximum zoom level to prevent over-zooming on very short routes
        if (map.getZoom() > 16) {
          map.setZoom(16);
        }
        
        // Optional: Set a minimum zoom level to ensure some context
        if (map.getZoom() < 14) {
          map.setZoom(14);
        }
      </script>
    </body>
    </html>
  `;
};

const generateLocationMapHTML = (location: any, name: string) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 150px; width: 100%; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { 
          zoomControl: false,
          dragging: false,
          attributionControl: false
        }).setView([${location.latitude}, ${location.longitude}], 14);
        
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        
        L.circleMarker([${location.latitude}, ${location.longitude}], {
          radius: 10,
          fillColor: '#d85430',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(map);
      </script>
    </body>
    </html>
  `;
};

const FeedItemCard = ({
  item,
  onLike,
  onComment,
  onShare,
  onAddToWishlist,
  isInWishlist,
  formatDistance,
  formatSpeed,
  router,
}: any) => {
  const { currentUserId } = useFriends();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    userName: string;
  } | null>(null);

  const isLiked = item.data.likes.includes(currentUserId);
  const likesCount = item.data.likes.length;
  const commentsCount = item.data.comments.length;

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  // Format the activity or location date
  const formatItemDate = () => {
    if (item.type === "activity" && item.data.activityDate) {
      const d = new Date(item.data.activityDate);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } else if (item.type === "location" && item.data.locationDate) {
      const d = new Date(item.data.locationDate);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
    return null;
  };

  const renderActivityContent = (activity: any) => (
    <View style={styles.activityContent}>
      {/* Add date badge if available */}
      {activity.activityDate && (
        <View style={styles.dateBadge}>
          <Ionicons name="calendar" size={14} color={theme.colors.forest} />
          <Text style={styles.dateBadgeText}>
            Activity on{" "}
            {new Date(activity.activityDate).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
      )}

      <View style={styles.activityStats}>
        <View style={styles.statItem}>
          <Ionicons name="navigate" size={16} color={theme.colors.forest} />
          <Text style={styles.statText}>
            {formatDistance(activity.distance)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="time" size={16} color={theme.colors.forest} />
          <Text style={styles.statText}>
            {Math.round(activity.duration / 60)}min
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="speedometer" size={16} color={theme.colors.forest} />
          <Text style={styles.statText}>
            {formatSpeed(activity.averageSpeed)}
          </Text>
        </View>
      </View>
      {activity.notes && <Text style={styles.notes}>{activity.notes}</Text>}
    </View>
  );

  const renderLocationContent = (location: any) => (
    <View style={styles.locationContent}>
      <View style={styles.locationHeader}>
        <View style={styles.locationTitleSection}>
          <Text style={styles.locationName}>{location.name}</Text>
          {/* Add visited date if available */}
          {location.locationDate && (
            <Text style={styles.locationDate}>
              Visited{" "}
              {new Date(location.locationDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year:
                  new Date(location.locationDate).getFullYear() !==
                  new Date().getFullYear()
                    ? "numeric"
                    : undefined,
              })}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAddToWishlist(location);
          }}
          style={styles.wishlistButton}
        >
          <Ionicons
            name={isInWishlist ? "heart" : "heart-outline"}
            size={24}
            color={isInWishlist ? "#FF4757" : theme.colors.gray}
          />
        </TouchableOpacity>
      </View>
      {location.description && (
        <Text style={styles.locationDescription}>{location.description}</Text>
      )}
      {location.photos && location.photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photoScroll}
        >
          {location.photos.slice(0, 3).map((photo: string, index: number) => (
            <TouchableImage
              key={index}
              source={{ uri: photo }}
              style={styles.locationPhoto}
              images={location.photos}
              imageIndex={index}
            />
          ))}
        </ScrollView>
      )}
      <View style={styles.locationCoords}>
        <Ionicons name="location" size={14} color={theme.colors.burntOrange} />
        <Text style={styles.coordsText}>
          {location.location?.latitude?.toFixed(4)},{" "}
          {location.location?.longitude?.toFixed(4)}
        </Text>
      </View>
    </View>
  );

  const renderTripContent = (trip: any) => (
    <View style={styles.tripContent}>
      <View style={styles.tripHeader}>
        <Text style={styles.tripName}>{trip.name}</Text>
        <Text style={styles.tripDates}>
          {trip.start_date && trip.end_date && (
            <>
              {new Date(trip.start_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              -{" "}
              {new Date(trip.end_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year:
                  new Date(trip.end_date).getFullYear() !==
                  new Date().getFullYear()
                    ? "numeric"
                    : undefined,
              })}
            </>
          )}
        </Text>
      </View>

      {trip.cover_photo && (
        <Image
          source={{ uri: trip.cover_photo }}
          style={styles.tripCoverPhoto}
        />
      )}

      <View style={styles.tripStats}>
        <View style={styles.tripStatItem}>
          <Ionicons name="calendar" size={16} color={theme.colors.forest} />
          <Text style={styles.tripStatText}>
            {trip.start_date &&
              trip.end_date &&
              Math.ceil(
                (new Date(trip.end_date).getTime() -
                  new Date(trip.start_date).getTime()) /
                  (1000 * 60 * 60 * 24)
              )}{" "}
            days
          </Text>
        </View>
        <View style={styles.tripStatItem}>
          <Ionicons name="pin" size={16} color={theme.colors.forest} />
          <Text style={styles.tripStatText}>{trip.itemCount || 0} items</Text>
        </View>
      </View>

      {trip.tripItems && trip.tripItems.length > 0 && (
        <View style={styles.tripItemsPreview}>
          <Text style={styles.tripItemsTitle}>Includes:</Text>
          {trip.tripItems.map((item: any, index: number) => (
            <Text key={index} style={styles.tripItemText}>
              • {item.name}
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  const renderAchievementContent = (achievement: any) => (
    <View style={styles.achievementContent}>
      <View style={styles.achievementBadge}>
        <Ionicons
          name={achievement.achievementIcon as any}
          size={40}
          color="#FFD700"
        />
      </View>
      <Text style={styles.achievementName}>{achievement.achievementName}</Text>
      <Text style={styles.achievementText}>Achievement Unlocked!</Text>
    </View>
  );

  const getActivityIcon = (type: string) => {
    const icons: any = {
      bike: "bicycle",
      run: "walk",
      walk: "footsteps",
      hike: "trail-sign",
      paddleboard: "boat",
      climb: "trending-up",
      other: "fitness",
    };
    return icons[type] || "fitness";
  };

  return (
    <View style={styles.feedCard}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <UserAvatar user={item.data.sharedBy} size={40} />
          <View style={styles.userText}>
            <Text style={styles.userName}>
              {item.data.sharedBy.displayName ||
                item.data.sharedBy.display_name}
            </Text>
            <View style={styles.timeRow}>
              <Text style={styles.timeAgo}>
                {getTimeAgo(item.data.sharedAt)}
              </Text>
              {formatItemDate() && (
                <Text style={styles.itemDate}>• {formatItemDate()}</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.cardContent}>
        {item.type === "activity" && (
          <View
            style={[
              styles.activityTypeBadge,
              { backgroundColor: theme.colors.forest + "20" },
            ]}
          >
            <Ionicons
              name={getActivityIcon(item.data.type)}
              size={16}
              color={theme.colors.forest}
            />
            <Text
              style={[styles.activityTypeText, { color: theme.colors.forest }]}
            >
              {item.data.type}
            </Text>
          </View>
        )}
        {item.type === "activity" && renderActivityContent(item.data)}

        {/* ADD THIS - Mini Map for Activities */}
        {item.type === "activity" &&
          item.data.route &&
          item.data.route.length > 0 && (
            <View style={styles.miniMapContainer}>
              <WebView
                source={{
                  html: generateMiniMapHTML(item.data.route, item.data.name),
                }}
                style={styles.miniMap}
                scrollEnabled={false}
                pointerEvents="none"
              />
              <TouchableOpacity
                style={styles.mapOverlay}
                onPress={() => router.push(`/feed-map/activity/${item.id}`)}
              >
                <Ionicons name="expand" size={20} color="white" />
              </TouchableOpacity>
            </View>
          )}

        {item.type === "location" && renderLocationContent(item.data)}

        {/* ADD THIS - Mini Map for Locations */}
        {item.type === "location" && item.data.location && (
          <View style={styles.miniMapContainer}>
            <WebView
              source={{
                html: generateLocationMapHTML(
                  item.data.location,
                  item.data.name
                ),
              }}
              style={styles.miniMap}
              scrollEnabled={false}
              pointerEvents="none"
            />
            <TouchableOpacity
              style={styles.mapOverlay}
              onPress={() => router.push(`/feed-map/location/${item.id}`)}
            >
              <Ionicons name="expand" size={20} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {item.type === "trip" && renderTripContent(item.data)}

        {item.type === "achievement" && renderAchievementContent(item.data)}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onLike(item.id, !isLiked)}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={20}
            color={isLiked ? "#FF4757" : theme.colors.gray}
          />
          <Text style={[styles.actionText, isLiked && { color: "#FF4757" }]}>
            {likesCount > 0 ? likesCount : "Like"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowComments(!showComments)}
        >
          <Ionicons
            name="chatbubble-outline"
            size={20}
            color={theme.colors.gray}
          />
          <Text style={styles.actionText}>
            {commentsCount > 0 ? commentsCount : "Comment"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onShare(item)}
        >
          <Ionicons
            name="share-social-outline"
            size={20}
            color={theme.colors.gray}
          />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>

      {showComments && (
        <View style={styles.commentsSection}>
          {item.data.comments
            .filter((comment: any) => !comment.replyToId) // Only parent comments
            .map((comment: any) => (
              <View key={comment.id}>
                {/* Parent Comment */}
                <View style={styles.comment}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentUser}>{comment.userName}</Text>
                    <Text style={styles.commentTime}>
                      {getTimeAgo(comment.timestamp)}
                    </Text>
                  </View>
                  <Text style={styles.commentText}>{comment.text}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setCommentText(`@${comment.userName} `);
                      setReplyingTo({
                        id: comment.id,
                        userName: comment.userName,
                      });
                    }}
                    style={styles.replyButton}
                  >
                    <Text style={styles.replyButtonText}>Reply</Text>
                  </TouchableOpacity>
                </View>

                {/* Nested Replies */}
                {item.data.comments
                  .filter((reply: any) => reply.replyToId === comment.id)
                  .map((reply: any) => (
                    <View key={reply.id} style={styles.replyComment}>
                      <View style={styles.replyIndent}>
                        <View style={styles.replyLine} />
                        <View style={styles.replyContent}>
                          <View style={styles.commentHeader}>
                            <Text style={styles.commentUser}>
                              {reply.userName}
                            </Text>
                            <Text style={styles.commentTime}>
                              {getTimeAgo(reply.timestamp)}
                            </Text>
                          </View>
                          <Text style={styles.commentText}>
                            <Text style={styles.replyToMention}>
                              @{comment.userName}{" "}
                            </Text>
                            {reply.text}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
              </View>
            ))}

          <View style={styles.addCommentWrapper}>
            {replyingTo && (
              <View style={styles.replyingToIndicator}>
                <Text style={styles.replyingToText}>
                  Replying to {replyingTo.userName}
                </Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <Ionicons name="close" size={16} color={theme.colors.gray} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.addCommentContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={commentText}
                onChangeText={setCommentText}
                placeholderTextColor={theme.colors.lightGray}
              />
              <TouchableOpacity
                style={styles.sendButton}
                onPress={() => {
                  if (commentText.trim()) {
                    onComment(
                      item.id,
                      commentText,
                      replyingTo?.id,
                      replyingTo?.userName
                    );
                    setCommentText("");
                    setReplyingTo(null);
                  }
                }}
              >
                <Ionicons name="send" size={20} color={theme.colors.forest} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

// Map HTML Generator Function
const generateFriendsMapHTML = (feedData: any[], settings: any) => {
  const allMarkers: any[] = [];
  const allRoutes: any[] = [];

  // Process feed items for map display
  feedData.forEach((item) => {
    if (item.type === "location" && item.data.location) {
      allMarkers.push({
        lat: item.data.location.latitude,
        lng: item.data.location.longitude,
        type: "location",
        name: item.data.name,
        user:
          item.data.sharedBy?.displayName ||
          item.data.sharedBy?.display_name ||
          "Friend",
        category: item.data.category,
      });
    } else if (
      item.type === "activity" &&
      item.data.route &&
      item.data.route.length > 0
    ) {
      allRoutes.push({
        route: item.data.route,
        user:
          item.data.sharedBy?.displayName ||
          item.data.sharedBy?.display_name ||
          "Friend",
        activityType: item.data.type,
        name: item.data.name || "Activity",
      });

      // Add start marker for activity
      allMarkers.push({
        lat: item.data.route[0].latitude,
        lng: item.data.route[0].longitude,
        type: "activity-start",
        name: item.data.name || "Activity",
        user:
          item.data.sharedBy?.displayName ||
          item.data.sharedBy?.display_name ||
          "Friend",
        activityType: item.data.type,
      });
    }
  });

  // Default center (Seattle) - you could calculate center from markers
  const centerLat =
    allMarkers.length > 0
      ? allMarkers.reduce((sum, m) => sum + m.lat, 0) / allMarkers.length
      : 47.6062;
  const centerLng =
    allMarkers.length > 0
      ? allMarkers.reduce((sum, m) => sum + m.lng, 0) / allMarkers.length
      : -122.3321;

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
        .custom-popup { text-align: center; }
        .custom-popup b { color: #2d5a3d; }
        .custom-popup .user { color: #666; font-size: 12px; margin-top: 4px; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${centerLat}, ${centerLng}], 10);
        
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 18
        }).addTo(map);
        
        var markers = [];
        
        // Add location markers
        ${allMarkers
          .filter((m) => m.type === "location")
          .map(
            (marker) => `
          var locationMarker = L.circleMarker([${marker.lat}, ${marker.lng}], {
            radius: 10,
            fillColor: '#d85430',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          })
          .addTo(map)
          .bindPopup('<div class="custom-popup"><b>📍 ${marker.name}</b><div class="user">by ${marker.user}</div></div>');
          markers.push(locationMarker);
        `
          )
          .join("")}
        
        // Add activity start markers
        ${allMarkers
          .filter((m) => m.type === "activity-start")
          .map(
            (marker) => `
          var activityMarker = L.circleMarker([${marker.lat}, ${marker.lng}], {
            radius: 8,
            fillColor: '#2d5a3d',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          })
          .addTo(map)
          .bindPopup('<div class="custom-popup"><b>🏃 ${marker.name}</b><div class="user">by ${marker.user}</div></div>');
          markers.push(activityMarker);
        `
          )
          .join("")}
        
        // Add activity routes
        ${allRoutes
          .map(
            (activity, index) => `
          var route${index} = L.polyline([
            ${activity.route
              .map((p: any) => `[${p.latitude}, ${p.longitude}]`)
              .join(",")}
          ], {
            color: '#2d5a3d',
            weight: 3,
            opacity: 0.6
          }).addTo(map)
          .bindPopup('<div class="custom-popup"><b>${
            activity.name
          }</b><div class="user">by ${activity.user}</div></div>');
          markers.push(route${index});
        `
          )
          .join("")}
        
        // Fit map to show all markers
        if (markers.length > 0) {
          var group = new L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.1));
        }
      </script>
    </body>
    </html>
  `;
};

// Main Component
export default function FriendsFeedScreen() {
  const router = useRouter();
  const {
    feed,
    friends,
    friendRequests,
    refreshFeed,
    likeItem,
    unlikeItem,
    addComment,
    loading,
  } = useFriends();
  const { formatDistance, formatSpeed, settings } = useSettings();
  const { wishlistItems, addWishlistItem, removeWishlistItem } = useWishlist();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "activities" | "locations" | "trips"
  >("all");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    refreshFeed();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshFeed();
    setRefreshing(false);
  };

  const handleLike = (itemId: string, shouldLike: boolean) => {
    if (shouldLike) {
      likeItem(itemId);
    } else {
      unlikeItem(itemId);
    }
  };

  const handleComment = (
    itemId: string,
    text: string,
    replyToId?: string,
    replyToUserName?: string
  ) => {
    addComment(itemId, text, replyToId, replyToUserName);
  };

  const handleShare = (item: any) => {
    Alert.alert("Share", "Sharing functionality coming soon!");
  };

  const handleAddToWishlist = (location: any) => {
    const wishlistItem = wishlistItems.find(
      (item) =>
        item.location &&
        Math.abs(item.location.latitude - location.location.latitude) <
          0.0001 &&
        Math.abs(item.location.longitude - location.location.longitude) < 0.0001
    );

    if (wishlistItem) {
      removeWishlistItem(wishlistItem.id);
    } else {
      addWishlistItem({
        name: location.name,
        description: location.description || `Visit ${location.name}`,
        location: location.location,
        category: location.category || "other",
        priority: 2,
        notes: `Shared by ${location.sharedBy?.displayName || "a friend"}`,
      });
    }
  };

  const isLocationInWishlist = (location: any) => {
    return wishlistItems.some(
      (item) =>
        item.location &&
        Math.abs(item.location.latitude - location.location.latitude) <
          0.0001 &&
        Math.abs(item.location.longitude - location.location.longitude) < 0.0001
    );
  };

  const filteredFeed = feed.filter((item) => {
    if (filter === "all") return true;
    if (filter === "activities") return item.type === "activity";
    if (filter === "locations") return item.type === "location";
    if (filter === "trips") return item.type === "trip";
    return true;
  });

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="people-outline"
        size={80}
        color={theme.colors.lightGray}
      />
      <Text style={styles.emptyTitle}>No Activity Yet</Text>
      <Text style={styles.emptyText}>
        The adventures of your friends will appear here
      </Text>
      <TouchableOpacity
        style={styles.findFriendsButton}
        onPress={() => router.push("/friends")}
      >
        <Text style={styles.findFriendsText}>Find Friends</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Friends Feed",
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          headerRight: () => (
            <View style={styles.headerRight}>
              {friendRequests.length > 0 && (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => router.push("/friend-requests")}
                >
                  <Ionicons name="person-add" size={24} color="white" />
                  <View style={styles.requestBadge}>
                    <Text style={styles.requestBadgeText}>
                      {friendRequests.length}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => router.push("/friends")}
              >
                <Ionicons name="people" size={24} color="white" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* View Mode Toggle - This is at the TOP level of the screen */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === "list" && styles.toggleActive,
          ]}
          onPress={() => setViewMode("list")}
        >
          <Ionicons
            name="list"
            size={20}
            color={viewMode === "list" ? "white" : theme.colors.gray}
          />
          <Text
            style={[
              styles.toggleText,
              viewMode === "list" && styles.toggleTextActive,
            ]}
          >
            Feed
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === "map" && styles.toggleActive,
          ]}
          onPress={() => setViewMode("map")}
        >
          <Ionicons
            name="map"
            size={20}
            color={viewMode === "map" ? "white" : theme.colors.gray}
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
      </View>

      {/* Conditionally show either list or map view */}
      {viewMode === "list" ? (
        <>
          {/* Online Friends Bar */}
          {friends.length > 0 && (
            <View style={styles.onlineBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {friends
                  .filter((f) => f.status === "accepted")
                  .map((friend) => {
                    const isOnline =
                      friend.lastActive &&
                      new Date().getTime() -
                        new Date(friend.lastActive).getTime() <
                        300000;

                    return (
                      <TouchableOpacity
                        key={friend.id}
                        style={styles.onlineFriend}
                        onPress={() =>
                          router.push(`/friend-profile/${friend.id}`)
                        }
                      >
                        <View style={styles.onlineAvatar}>
                          <UserAvatar user={friend} size={46} />
                          {isOnline && <View style={styles.onlineIndicator} />}
                        </View>
                        <Text style={styles.onlineName}>
                          {
                            (friend.displayName || friend.username).split(
                              " "
                            )[0]
                          }
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </View>
          )}

          {/* Filter Tabs */}
          <View style={styles.filterTabs}>
            <TouchableOpacity
              style={[
                styles.filterTab,
                filter === "all" && styles.filterTabActive,
              ]}
              onPress={() => setFilter("all")}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === "all" && styles.filterTabTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterTab,
                filter === "activities" && styles.filterTabActive,
              ]}
              onPress={() => setFilter("activities")}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === "activities" && styles.filterTabTextActive,
                ]}
              >
                Activities
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterTab,
                filter === "locations" && styles.filterTabActive,
              ]}
              onPress={() => setFilter("locations")}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === "locations" && styles.filterTabTextActive,
                ]}
              >
                Places
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterTab,
                filter === "trips" && styles.filterTabActive,
              ]}
              onPress={() => setFilter("trips")}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === "trips" && styles.filterTabTextActive,
                ]}
              >
                Trips
              </Text>
            </TouchableOpacity>
          </View>

          {/* List View */}
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.forest} />
            </View>
          ) : (
            <FlatList
              data={filteredFeed}
              renderItem={({ item }) => (
                <FeedItemCard
                  item={item}
                  onLike={handleLike}
                  onComment={handleComment}
                  onShare={handleShare}
                  onAddToWishlist={handleAddToWishlist}
                  isInWishlist={
                    item.type === "location" && isLocationInWishlist(item.data)
                  }
                  formatDistance={formatDistance}
                  formatSpeed={formatSpeed}
                  router={router}
                />
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={
                filteredFeed.length === 0
                  ? styles.emptyContainer
                  : styles.feedContainer
              }
              ListEmptyComponent={renderEmptyState}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={theme.colors.forest}
                  colors={[theme.colors.forest]}
                />
              }
            />
          )}
        </>
      ) : (
        // Map View
        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: generateFriendsMapHTML(filteredFeed, settings) }}
            style={styles.mapView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={false}
          />
          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#d85430" }]}
              />
              <Text style={styles.legendText}>Places</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#2d5a3d" }]}
              />
              <Text style={styles.legendText}>Activities</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// Add these new styles to your existing styles
const styles = StyleSheet.create({
  // Your existing styles plus these new ones:
  viewToggle: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    marginHorizontal: 5,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
  },
  toggleActive: {
    backgroundColor: theme.colors.forest,
  },
  toggleText: {
    fontSize: 14,
    color: theme.colors.gray,
    fontWeight: "500",
    marginLeft: 6,
  },
  toggleTextActive: {
    color: "white",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  mapView: {
    flex: 1,
  },
  mapLegend: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: theme.colors.gray,
    fontWeight: "500",
  },

  // All your other existing styles
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  headerButton: {
    marginLeft: 15,
    position: "relative",
  },
  requestBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  requestBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  onlineBar: {
    backgroundColor: theme.colors.forest + "15",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.forest + "20",
  },
  onlineFriend: {
    alignItems: "center",
    marginHorizontal: 10,
  },
  onlineAvatar: {
    position: "relative",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "white",
  },
  onlineName: {
    fontSize: 12,
    color: theme.colors.navy,
    marginTop: 5,
    fontWeight: "500",
  },
  filterTabs: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 20,
    marginHorizontal: 5,
    backgroundColor: theme.colors.offWhite,
  },
  filterTabActive: {
    backgroundColor: theme.colors.forest,
  },
  filterTabText: {
    fontSize: 14,
    color: theme.colors.gray,
    fontWeight: "500",
  },
  filterTabTextActive: {
    color: "white",
  },
  feedContainer: {
    padding: 10,
  },
  feedCard: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: theme.colors.offWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  userText: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  timeAgo: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  activityTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  activityTypeText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 5,
  },
  cardContent: {
    padding: 15,
  },
  activityContent: {},
  activityStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: theme.colors.forest + "08",
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.forest + "15",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statText: {
    marginLeft: 5,
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  notes: {
    fontSize: 14,
    color: theme.colors.gray,
    fontStyle: "italic",
    marginTop: 10,
    paddingHorizontal: 10,
  },
  locationContent: {},
  locationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  locationName: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    flex: 1,
  },
  wishlistButton: {
    padding: 4,
  },
  locationDescription: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: 10,
    lineHeight: 20,
  },
  photoScroll: {
    marginVertical: 10,
  },
  locationPhoto: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 10,
  },
  locationCoords: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: theme.colors.burntOrange + "10",
    padding: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  coordsText: {
    fontSize: 12,
    color: theme.colors.navy,
    marginLeft: 5,
    fontFamily: "monospace",
  },
  achievementContent: {
    alignItems: "center",
    padding: 20,
  },
  achievementBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.forest + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  achievementName: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 5,
  },
  achievementText: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    backgroundColor: theme.colors.offWhite,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 5,
  },
  actionText: {
    marginLeft: 5,
    fontSize: 14,
    color: theme.colors.gray,
  },
  commentsSection: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    backgroundColor: theme.colors.offWhite,
  },
  comment: {
    marginBottom: 10,
    backgroundColor: "white",
    padding: 10,
    borderRadius: 8,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  commentText: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
  },
  commentTime: {
    fontSize: 11,
    color: theme.colors.lightGray,
    marginTop: 2,
  },
  addCommentContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 14,
    color: theme.colors.navy,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  sendButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
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
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 10,
    marginBottom: 30,
    textAlign: "center",
  },
  findFriendsButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  findFriendsText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  replyIndicator: {
    fontSize: 12,
    color: theme.colors.lightGray,
    fontStyle: "italic",
    marginBottom: 2,
  },
  replyButton: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  replyButtonText: {
    fontSize: 12,
    color: theme.colors.forest,
    fontWeight: "500",
  },
  replyingToIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.forest + "10",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    width: "100%",
  },
  replyingToText: {
    fontSize: 12,
    color: theme.colors.forest,
    fontWeight: "500",
  },
  addCommentWrapper: {
    width: "100%",
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  // Add these at the end of your styles object:
  miniMapContainer: {
    height: 150,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 10,
    position: "relative",
  },
  miniMap: {
    flex: 1,
  },
  mapOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  replyComment: {
    paddingLeft: 30,
    marginTop: 8,
  },
  replyIndent: {
    flexDirection: "row",
  },
  replyLine: {
    width: 2,
    backgroundColor: theme.colors.lightGray + "30",
    marginRight: 12,
    marginLeft: 5,
  },
  replyContent: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
    padding: 8,
    borderRadius: 8,
  },
  replyToMention: {
    color: theme.colors.forest,
    fontWeight: "600",
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest + "10",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  dateBadgeText: {
    fontSize: 12,
    color: theme.colors.forest,
    marginLeft: 5,
    fontWeight: "500",
  },
  locationTitleSection: {
    flex: 1,
  },
  locationDate: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  itemDate: {
    fontSize: 12,
    color: theme.colors.navy,
    marginLeft: 4,
    fontWeight: "500",
  },
  tripContent: {
    padding: 5,
  },
  tripHeader: {
    marginBottom: 10,
  },
  tripName: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 4,
  },
  tripDates: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  tripCoverPhoto: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },
  tripStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: theme.colors.forest + "08",
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.forest + "15",
  },
  tripStatItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  tripStatText: {
    marginLeft: 6,
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  tripItemsPreview: {
    backgroundColor: theme.colors.offWhite,
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  tripItemsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 6,
  },
  tripItemText: {
    fontSize: 13,
    color: theme.colors.gray,
    marginVertical: 2,
  },
});
