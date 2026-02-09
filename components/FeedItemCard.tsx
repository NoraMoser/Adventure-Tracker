import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import {
  generateMiniMapHTML,
  generateLocationMiniMapHTML,
} from "../utils/mapHelpers";

interface LikeInfo {
  userId: string;
  userName: string;
  avatar?: string;
  profile_picture?: string;
}

interface FeedItemCardProps {
  item: any;
  onLike: (itemId: string, shouldLike: boolean) => void;
  onComment: (
    itemId: string,
    text: string,
    replyToId?: string,
    replyToUserName?: string
  ) => void;
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
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    userName: string;
  } | null>(null);
  const [showLikesModal, setShowLikesModal] = useState(false);

  // Handle both old format (string[]) and new format (LikeInfo[])
  const likes: LikeInfo[] = item.data.likes.map((like: string | LikeInfo) => {
    if (typeof like === "string") {
      return { userId: like, userName: "User" };
    }
    return like;
  });

  const isLiked = likes.some((like) => like.userId === currentUserId);
  const likesCount = likes.length;
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

  const getLikedByText = () => {
    if (likesCount === 0) return null;

    // Filter out current user for display
    const otherLikes = likes.filter((like) => like.userId !== currentUserId);
    const currentUserLiked = isLiked;

    if (likesCount === 1) {
      if (currentUserLiked) {
        return "You liked this";
      }
      return `${likes[0].userName} liked this`;
    }

    if (likesCount === 2) {
      if (currentUserLiked && otherLikes.length === 1) {
        return `You and ${otherLikes[0].userName} liked this`;
      }
      return `${likes[0].userName} and ${likes[1].userName} liked this`;
    }

    // 3 or more likes
    if (currentUserLiked) {
      if (otherLikes.length === 1) {
        return `You and ${otherLikes[0].userName} liked this`;
      }
      return `You, ${otherLikes[0].userName} and ${otherLikes.length - 1} others liked this`;
    }

    return `${likes[0].userName}, ${likes[1].userName} and ${likesCount - 2} others liked this`;
  };

  const renderActivityContent = (activity: any) => (
    <View style={styles.activityContent}>
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
              })}
              {" - "}
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
          {trip.tripItems.map((tripItem: any, index: number) => (
            <Text key={index} style={styles.tripItemText}>
              • {tripItem.name}
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

  const handleSubmitComment = () => {
    if (commentText.trim()) {
      onComment(item.id, commentText, replyingTo?.id, replyingTo?.userName);
      setCommentText("");
      setReplyingTo(null);
    }
  };

  // Get top-level comments and their replies
  const topLevelComments = item.data.comments.filter((c: any) => !c.replyTo);
  const getReplies = (commentId: string) =>
    item.data.comments.filter((c: any) => c.replyTo === commentId);

  const likedByText = getLikedByText();

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
              name={getActivityIcon(item.data.type) as any}
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

      {/* Liked By Section */}
      {likedByText && (
        <TouchableOpacity
          style={styles.likedBySection}
          onPress={() => setShowLikesModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.likedByAvatars}>
            {likes.slice(0, 3).map((like, index) => (
              <View
                key={like.userId}
                style={[
                  styles.likedByAvatar,
                  { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index },
                ]}
              >
                {like.avatar || like.profile_picture ? (
                  <Image
                    source={{ uri: like.avatar || like.profile_picture }}
                    style={styles.likedByAvatarImage}
                  />
                ) : (
                  <View style={styles.likedByAvatarPlaceholder}>
                    <Text style={styles.likedByAvatarText}>
                      {like.userName?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
          <Text style={styles.likedByText}>{likedByText}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onLike(item.id, !isLiked);
          }}
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
            name={showComments ? "chatbubble" : "chatbubble-outline"}
            size={20}
            color={showComments ? theme.colors.forest : theme.colors.gray}
          />
          <Text
            style={[
              styles.actionText,
              showComments && { color: theme.colors.forest },
            ]}
          >
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
          {/* Comments Header */}
          {commentsCount > 0 && (
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsHeaderText}>
                {commentsCount} {commentsCount === 1 ? "Comment" : "Comments"}
              </Text>
            </View>
          )}

          {/* Scrollable Comments List */}
          <ScrollView
            style={styles.commentsList}
            contentContainerStyle={styles.commentsListContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {topLevelComments.length === 0 ? (
              <View style={styles.noCommentsContainer}>
                <Ionicons
                  name="chatbubble-outline"
                  size={32}
                  color={theme.colors.lightGray}
                />
                <Text style={styles.noCommentsText}>No comments yet</Text>
                <Text style={styles.noCommentsSubtext}>
                  Be the first to comment!
                </Text>
              </View>
            ) : (
              topLevelComments.map((comment: any) => (
                <View key={comment.id} style={styles.commentThread}>
                  {/* Main Comment */}
                  <View style={styles.commentCard}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>
                        {comment.userName?.charAt(0)?.toUpperCase() || "?"}
                      </Text>
                    </View>
                    <View style={styles.commentBody}>
                      <View style={styles.commentBubble}>
                        <View style={styles.commentMeta}>
                          <Text style={styles.commentUserName}>
                            {comment.userName}
                          </Text>
                          <Text style={styles.commentTimestamp}>
                            {getTimeAgo(comment.timestamp)}
                          </Text>
                        </View>
                        <Text style={styles.commentContent}>
                          {comment.text}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setReplyingTo({
                            id: comment.id,
                            userName: comment.userName,
                          });
                        }}
                        style={styles.replyTrigger}
                      >
                        <Ionicons
                          name="arrow-undo-outline"
                          size={14}
                          color={theme.colors.forest}
                        />
                        <Text style={styles.replyTriggerText}>Reply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Replies */}
                  {getReplies(comment.id).map((reply: any) => (
                    <View key={reply.id} style={styles.replyContainer}>
                      <View style={styles.replyLine} />
                      <View style={styles.replyCard}>
                        <View style={styles.replyAvatar}>
                          <Text style={styles.replyAvatarText}>
                            {reply.userName?.charAt(0)?.toUpperCase() || "?"}
                          </Text>
                        </View>
                        <View style={styles.replyBody}>
                          <View style={styles.replyBubble}>
                            <View style={styles.commentMeta}>
                              <Text style={styles.commentUserName}>
                                {reply.userName}
                              </Text>
                              <Text style={styles.commentTimestamp}>
                                {getTimeAgo(reply.timestamp)}
                              </Text>
                            </View>
                            <Text style={styles.commentContent}>
                              <Text style={styles.mentionText}>
                                @{reply.replyToUser || comment.userName}{" "}
                              </Text>
                              {reply.text}
                            </Text>
                          </View>
                          {/* Reply button for replies */}
                          <TouchableOpacity
                            onPress={() => {
                              setReplyingTo({
                                id: comment.id,
                                userName: reply.userName,
                              });
                            }}
                            style={styles.replyTrigger}
                          >
                            <Ionicons
                              name="arrow-undo-outline"
                              size={14}
                              color={theme.colors.forest}
                            />
                            <Text style={styles.replyTriggerText}>Reply</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>

          {/* Comment Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={100}
          >
            <View style={styles.commentInputSection}>
              {replyingTo && (
                <View style={styles.replyingBanner}>
                  <View style={styles.replyingInfo}>
                    <Ionicons
                      name="arrow-undo"
                      size={14}
                      color={theme.colors.forest}
                    />
                    <Text style={styles.replyingText}>
                      Replying to{" "}
                      <Text style={styles.replyingName}>
                        {replyingTo.userName}
                      </Text>
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setReplyingTo(null)}
                    style={styles.cancelReplyButton}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={theme.colors.gray}
                    />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.inputRow}>
                <View style={styles.inputAvatar}>
                  <Ionicons name="person" size={16} color={theme.colors.gray} />
                </View>
                <TextInput
                  style={styles.commentTextInput}
                  placeholder={
                    replyingTo
                      ? `Reply to ${replyingTo.userName}...`
                      : "Write a comment..."
                  }
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholderTextColor={theme.colors.lightGray}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[
                    styles.sendCommentButton,
                    !commentText.trim() && styles.sendCommentButtonDisabled,
                  ]}
                  onPress={handleSubmitComment}
                  disabled={!commentText.trim()}
                >
                  <Ionicons
                    name="send"
                    size={18}
                    color={
                      commentText.trim() ? "white" : theme.colors.lightGray
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Likes Modal */}
      <Modal
        visible={showLikesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLikesModal(false)}
      >
        <View style={styles.likesModal}>
          <View style={styles.likesModalHeader}>
            <Text style={styles.likesModalTitle}>Likes</Text>
            <TouchableOpacity
              onPress={() => setShowLikesModal(false)}
              style={styles.likesModalClose}
            >
              <Ionicons name="close" size={24} color={theme.colors.navy} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.likesModalList}>
            {likes.map((like) => (
              <View key={like.userId} style={styles.likesModalItem}>
                <View style={styles.likesModalAvatar}>
                  {like.avatar || like.profile_picture ? (
                    <Image
                      source={{ uri: like.avatar || like.profile_picture }}
                      style={styles.likesModalAvatarImage}
                    />
                  ) : (
                    <View style={styles.likesModalAvatarPlaceholder}>
                      <Text style={styles.likesModalAvatarText}>
                        {like.userName?.charAt(0)?.toUpperCase() || "?"}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.likesModalUserName}>
                  {like.userId === currentUserId ? "You" : like.userName}
                </Text>
                <Ionicons name="heart" size={16} color="#FF4757" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
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
  // Liked By Section
  likedBySection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  likedByAvatars: {
    flexDirection: "row",
    marginRight: 8,
  },
  likedByAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "white",
    overflow: "hidden",
  },
  likedByAvatarImage: {
    width: "100%",
    height: "100%",
  },
  likedByAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.forest,
    justifyContent: "center",
    alignItems: "center",
  },
  likedByAvatarText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  likedByText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.gray,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    backgroundColor: theme.colors.offWhite,
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
    fontWeight: "500",
  },
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    backgroundColor: "white",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: "hidden",
  },
  commentsHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray + "50",
  },
  commentsHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  commentsList: {
    maxHeight: 300,
  },
  commentsListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noCommentsContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  noCommentsText: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.gray,
    marginTop: 8,
  },
  noCommentsSubtext: {
    fontSize: 13,
    color: theme.colors.lightGray,
    marginTop: 4,
  },
  commentThread: {
    marginBottom: 16,
  },
  commentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.forest,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  commentAvatarText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  commentBody: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  commentMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  commentUserName: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  commentTimestamp: {
    fontSize: 11,
    color: theme.colors.lightGray,
  },
  commentContent: {
    fontSize: 14,
    color: theme.colors.gray,
    lineHeight: 20,
  },
  replyTrigger: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  replyTriggerText: {
    fontSize: 12,
    color: theme.colors.forest,
    fontWeight: "500",
    marginLeft: 4,
  },
  replyContainer: {
    flexDirection: "row",
    marginTop: 8,
    marginLeft: 18,
  },
  replyLine: {
    width: 2,
    backgroundColor: theme.colors.forest + "30",
    marginRight: 10,
    borderRadius: 1,
  },
  replyCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.navy,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  replyAvatarText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  replyBody: {
    flex: 1,
  },
  replyBubble: {
    backgroundColor: theme.colors.forest + "08",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.forest + "15",
  },
  mentionText: {
    color: theme.colors.forest,
    fontWeight: "600",
  },

  // Comment Input Section
  commentInputSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    backgroundColor: theme.colors.offWhite,
  },
  replyingBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.forest + "10",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.forest + "20",
  },
  replyingInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  replyingText: {
    fontSize: 13,
    color: theme.colors.forest,
    marginLeft: 6,
  },
  replyingName: {
    fontWeight: "600",
  },
  cancelReplyButton: {
    padding: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.borderGray,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: theme.colors.navy,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    maxHeight: 100,
    marginRight: 8,
  },
  sendCommentButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.forest,
    justifyContent: "center",
    alignItems: "center",
  },
  sendCommentButtonDisabled: {
    backgroundColor: theme.colors.borderGray,
  },

  // Likes Modal
  likesModal: {
    flex: 1,
    backgroundColor: "white",
  },
  likesModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  likesModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  likesModalClose: {
    padding: 4,
  },
  likesModalList: {
    flex: 1,
  },
  likesModalItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  likesModalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    overflow: "hidden",
  },
  likesModalAvatarImage: {
    width: "100%",
    height: "100%",
  },
  likesModalAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.forest,
    justifyContent: "center",
    alignItems: "center",
  },
  likesModalAvatarText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  likesModalUserName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
  },
});