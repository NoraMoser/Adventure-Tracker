// components/FeedItemCard.tsx

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { TouchableImage } from "./TouchableImage";
import { UserAvatar } from "./UserAvatar";
import { theme } from "../constants/theme";
import { useFriends } from "../contexts/FriendsContext";
import { generateMiniMapHTML, generateLocationMiniMapHTML } from "../utils/mapHelpers";

interface FeedItemCardProps {
  item: any;
  onLike: (itemId: string, shouldLike: boolean) => void;
  onComment: (itemId: string, text: string, replyToId?: string, replyToUserName?: string) => void;
  onShare: (item: any) => void;
  onAddToWishlist: (location: any) => void;
  isInWishlist: boolean;
  formatDistance: (meters: number) => string;
  formatSpeed: (speed: number) => string;
  router: any;
}

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

const getActivityIcon = (type: string) => {
  const icons: Record<string, string> = {
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

export function FeedItemCard({
  item,
  onLike,
  onComment,
  onShare,
  onAddToWishlist,
  isInWishlist,
  formatDistance,
  formatSpeed,
  router,
}: FeedItemCardProps) {
  const { currentUserId } = useFriends();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);

  const isLiked = item.data.likes.includes(currentUserId);
  const likesCount = item.data.likes.length;
  const commentsCount = item.data.comments.length;

  const formatItemDate = () => {
    if (item.type === "activity" && item.data.activityDate) {
      const d = new Date(item.data.activityDate);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else if (item.type === "location" && item.data.locationDate) {
      const d = new Date(item.data.locationDate);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return null;
  };

  const renderActivityContent = (activity: any) => (
    <View style={styles.activityContent}>
      {activity.activityDate && (
        <View style={styles.dateBadge}>
          <Ionicons name="calendar" size={14} color={theme.colors.forest} />
          <Text style={styles.dateBadgeText}>
            Activity on {new Date(activity.activityDate).toLocaleDateString("en-US", {
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
          <Text style={styles.statText}>{formatDistance(activity.distance)}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="time" size={16} color={theme.colors.forest} />
          <Text style={styles.statText}>{Math.round(activity.duration / 60)}min</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="speedometer" size={16} color={theme.colors.forest} />
          <Text style={styles.statText}>{formatSpeed(activity.averageSpeed)}</Text>
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
          {location.locationDate && (
            <Text style={styles.locationDate}>
              Visited {new Date(location.locationDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: new Date(location.locationDate).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
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
          <View style={styles.wishlistIconContainer}>
            <Ionicons
              name={isInWishlist ? "heart-circle" : "heart-circle-outline"}
              size={28}
              color={isInWishlist ? "#9C27B0" : theme.colors.gray}
            />
            {!isInWishlist && (
              <View style={styles.wishlistPlusSign}>
                <Ionicons name="add" size={12} color="white" />
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
      {location.description && (
        <Text style={styles.locationDescription}>{location.description}</Text>
      )}
      {location.photos && location.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
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
          {location.location?.latitude?.toFixed(4)}, {location.location?.longitude?.toFixed(4)}
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
              {new Date(trip.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {" - "}
              {new Date(trip.end_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: new Date(trip.end_date).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
              })}
            </>
          )}
        </Text>
      </View>

      {trip.cover_photo && (
        <Image source={{ uri: trip.cover_photo }} style={styles.tripCoverPhoto} />
      )}

      <View style={styles.tripStats}>
        <View style={styles.tripStatItem}>
          <Ionicons name="calendar" size={16} color={theme.colors.forest} />
          <Text style={styles.tripStatText}>
            {trip.start_date && trip.end_date &&
              Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24))}{" "}
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
          {trip.tripItems.map((tripItem: any, index: number) => (
            <Text key={index} style={styles.tripItemText}>• {tripItem.name}</Text>
          ))}
        </View>
      )}
    </View>
  );

  const renderAchievementContent = (achievement: any) => (
    <View style={styles.achievementContent}>
      <View style={styles.achievementBadge}>
        <Ionicons name={achievement.achievementIcon as any} size={40} color="#FFD700" />
      </View>
      <Text style={styles.achievementName}>{achievement.achievementName}</Text>
      <Text style={styles.achievementText}>Achievement Unlocked!</Text>
    </View>
  );

  const handleSubmitComment = () => {
    if (commentText.trim()) {
      onComment(item.id, commentText, replyingTo?.id, replyingTo?.userName);
      setCommentText("");
      setReplyingTo(null);
    }
  };

  return (
    <View style={styles.feedCard}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <UserAvatar user={item.data.sharedBy} size={40} />
          <View style={styles.userText}>
            <Text style={styles.userName}>
              {item.data.sharedBy.displayName || item.data.sharedBy.display_name}
            </Text>
            <View style={styles.timeRow}>
              <Text style={styles.timeAgo}>{getTimeAgo(item.data.sharedAt)}</Text>
              {formatItemDate() && <Text style={styles.itemDate}>• {formatItemDate()}</Text>}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.cardContent}>
        {item.type === "activity" && (
          <View style={[styles.activityTypeBadge, { backgroundColor: theme.colors.forest + "20" }]}>
            <Ionicons name={getActivityIcon(item.data.type) as any} size={16} color={theme.colors.forest} />
            <Text style={[styles.activityTypeText, { color: theme.colors.forest }]}>{item.data.type}</Text>
          </View>
        )}
        
        {item.type === "activity" && renderActivityContent(item.data)}
        {item.type === "activity" && item.data.route && item.data.route.length > 0 && (
          <View style={styles.miniMapContainer}>
            <WebView
              source={{ html: generateMiniMapHTML(item.data.route, item.data.name) }}
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
        {item.type === "location" && item.data.location && (
          <View style={styles.miniMapContainer}>
            <WebView
              source={{
                html: generateLocationMiniMapHTML(
                  item.data.location.latitude,
                  item.data.location.longitude,
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
        <TouchableOpacity style={styles.actionButton} onPress={() => onLike(item.id, !isLiked)}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={20}
            color={isLiked ? "#FF4757" : theme.colors.gray}
          />
          <Text style={[styles.actionText, isLiked && { color: "#FF4757" }]}>
            {likesCount > 0 ? likesCount : "Like"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => setShowComments(!showComments)}>
          <Ionicons name="chatbubble-outline" size={20} color={theme.colors.gray} />
          <Text style={styles.actionText}>{commentsCount > 0 ? commentsCount : "Comment"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onShare(item)}>
          <Ionicons name="share-social-outline" size={20} color={theme.colors.gray} />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>

      {showComments && (
        <View style={styles.commentsSection}>
          {item.data.comments
            .filter((comment: any) => !comment.replyToId)
            .map((comment: any) => (
              <View key={comment.id}>
                <View style={styles.comment}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentUser}>{comment.userName}</Text>
                    <Text style={styles.commentTime}>{getTimeAgo(comment.timestamp)}</Text>
                  </View>
                  <Text style={styles.commentText}>{comment.text}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setCommentText(`@${comment.userName} `);
                      setReplyingTo({ id: comment.id, userName: comment.userName });
                    }}
                    style={styles.replyButton}
                  >
                    <Text style={styles.replyButtonText}>Reply</Text>
                  </TouchableOpacity>
                </View>

                {item.data.comments
                  .filter((reply: any) => reply.replyToId === comment.id)
                  .map((reply: any) => (
                    <View key={reply.id} style={styles.replyComment}>
                      <View style={styles.replyIndent}>
                        <View style={styles.replyLine} />
                        <View style={styles.replyContent}>
                          <View style={styles.commentHeader}>
                            <Text style={styles.commentUser}>{reply.userName}</Text>
                            <Text style={styles.commentTime}>{getTimeAgo(reply.timestamp)}</Text>
                          </View>
                          <Text style={styles.commentText}>
                            <Text style={styles.replyToMention}>@{comment.userName} </Text>
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
                <Text style={styles.replyingToText}>Replying to {replyingTo.userName}</Text>
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
              <TouchableOpacity style={styles.sendButton} onPress={handleSubmitComment}>
                <Ionicons name="send" size={20} color={theme.colors.forest} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  timeAgo: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  itemDate: {
    fontSize: 12,
    color: theme.colors.navy,
    marginLeft: 4,
    fontWeight: "500",
  },
  cardContent: {
    padding: 15,
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
  locationTitleSection: {
    flex: 1,
  },
  locationName: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    flex: 1,
  },
  locationDate: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  wishlistButton: {
    padding: 4,
  },
  wishlistIconContainer: {
    position: "relative",
  },
  wishlistPlusSign: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#9C27B0",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
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
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  commentTime: {
    fontSize: 11,
    color: theme.colors.lightGray,
  },
  commentText: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
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
  addCommentWrapper: {
    width: "100%",
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
});