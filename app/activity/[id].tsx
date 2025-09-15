// app/activity/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { theme } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { supabase } from "../../lib/supabase";

interface Comment {
  id: string;
  text: string;
  created_at: string;
  reply_to_id?: string; // ADD THIS LINE
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar?: string;
  };
}

interface Activity {
  id: string;
  name: string;
  type: string;
  start_time: string;
  end_time: string;
  duration: number;
  distance: number;
  average_speed?: number;
  max_speed?: number;
  elevation_gain?: number;
  notes?: string;
  route?: any[];
  user_id: string;
  user?: {
    username: string;
    display_name: string;
    avatar?: string;
  };
}

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { formatDistance, formatSpeed } = useSettings();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const commentInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (id) {
      loadActivityDetails();
      checkIfLiked();
    }
  }, [id]);

  const loadActivityDetails = async () => {
    try {
      // Load activity
      const { data: activityData, error: activityError } = await supabase
        .from("activities")
        .select("*")
        .eq("id", id)
        .single();

      if (activityError) throw activityError;

      // Load owner profile separately
      if (activityData.user_id) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar")
          .eq("id", activityData.user_id)
          .single();

        activityData.user = ownerProfile;
      }

      setActivity(activityData);

      // Load comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .eq("activity_id", id)
        .order("created_at", { ascending: false });

      if (commentsError) throw commentsError;

      // Load comment authors
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map((c) => c.user_id))];

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar")
          .in("id", userIds);

        const profileMap: Record<string, any> = {};
        profiles?.forEach((p) => {
          profileMap[p.id] = p;
        });

        const commentsWithUsers = commentsData.map((comment) => ({
          ...comment,
          user: profileMap[comment.user_id] || {
            id: comment.user_id,
            username: "Unknown",
            display_name: "Unknown User",
          },
        }));

        setComments(commentsWithUsers);
      } else {
        setComments([]);
      }

      // Load like count
      const { count } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("activity_id", id);

      setLikeCount(count || 0);
    } catch (error) {
      console.error("Error loading activity details:", error);
      Alert.alert("Error", "Failed to load activity details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkIfLiked = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("likes")
      .select("id")
      .eq("activity_id", id)
      .eq("user_id", user.id)
      .single();

    setLiked(!!data);
  };

  const handleLike = async () => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to like activities");
      return;
    }

    try {
      if (liked) {
        // Unlike
        await supabase
          .from("likes")
          .delete()
          .eq("activity_id", id)
          .eq("user_id", user.id);

        setLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      } else {
        // Like
        await supabase.from("likes").insert({
          activity_id: id,
          user_id: user.id,
        });

        setLiked(true);
        setLikeCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleReply = (comment: Comment) => {
    const replyPrefix = `@${
      comment.user.display_name || comment.user.username
    } `;
    setNewComment(replyPrefix);
    setReplyingTo(comment.id);
    // Focus the input and scroll to bottom
    setTimeout(() => {
      commentInputRef.current?.focus();
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleAddComment = async () => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to comment");
      return;
    }

    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      // Build the comment object with reply relationship
      const commentData: any = {
        activity_id: id,
        user_id: user.id,
        text: newComment.trim(),
      };

      // Add reply relationship if replying to someone
      if (replyingTo) {
        commentData.reply_to_id = replyingTo;
      }

      const { data, error } = await supabase
        .from("comments")
        .insert(commentData)
        .select(
          `
        *,
        user:profiles!comments_user_id_fkey(
          id,
          username,
          display_name,
          avatar
        )
      `
        )
        .single();

      if (error) throw error;

      // Add the reply_to_id to the returned data if it exists
      if (replyingTo) {
        data.reply_to_id = replyingTo;
      }

      setComments([data, ...comments]);
      setNewComment("");
      setReplyingTo(null);
    } catch (error) {
      console.error("Error adding comment:", error);
      Alert.alert("Error", "Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase.from("comments").delete().eq("id", commentId);

              setComments(comments.filter((c) => c.id !== commentId));
            } catch (error) {
              Alert.alert("Error", "Failed to delete comment");
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadActivityDetails();
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
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

  const generateRouteMapHTML = (route: any[]) => {
    if (!route || route.length === 0) return "";

    const center = route[Math.floor(route.length / 2)];
    const coordinates = route
      .map((p) => `[${p.latitude}, ${p.longitude}]`)
      .join(",");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { height: 200px; width: 100%; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
          }).addTo(map);
          
          var coordinates = [${coordinates}];
          var polyline = L.polyline(coordinates, {
            color: '#2d5a3d',
            weight: 3
          }).addTo(map);
          
          L.marker(coordinates[0]).addTo(map).bindPopup('Start');
          L.marker(coordinates[coordinates.length - 1]).addTo(map).bindPopup('End');
          
          map.fitBounds(polyline.getBounds().pad(0.1));
        </script>
      </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.forest} />
      </SafeAreaView>
    );
  }

  if (!activity) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Activity not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: activity.name,
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: "#fff",
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Activity Header */}
          <View style={styles.header}>
            <View style={styles.activityType}>
              <Ionicons
                name={getActivityIcon(activity.type) as any}
                size={32}
                color={theme.colors.forest}
              />
              <Text style={styles.activityTypeName}>
                {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
              </Text>
            </View>

            <Text style={styles.activityName}>{activity.name}</Text>

            {/* Owner Info */}
            {activity.user && (
              <TouchableOpacity
                style={styles.ownerInfo}
                onPress={() =>
                  router.push(`/friend-profile/${activity.user_id}` as any)
                }
              >
                <Text style={styles.ownerAvatar}>
                  {activity.user.avatar || "👤"}
                </Text>
                <Text style={styles.ownerName}>
                  {activity.user.display_name || activity.user.username}
                </Text>
                <Text style={styles.activityDate}>
                  {new Date(activity.start_time).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            )}

            {/* Stats Grid */}
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Ionicons
                  name="speedometer"
                  size={20}
                  color={theme.colors.navy}
                />
                <Text style={styles.statValue}>
                  {formatDistance(activity.distance)}
                </Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="time" size={20} color={theme.colors.navy} />
                <Text style={styles.statValue}>
                  {formatDuration(activity.duration)}
                </Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              {activity.average_speed ? (
                <View style={styles.statItem}>
                  <Ionicons
                    name="speedometer-outline"
                    size={20}
                    color={theme.colors.navy}
                  />
                  <Text style={styles.statValue}>
                    {formatSpeed(activity.average_speed)}
                  </Text>
                  <Text style={styles.statLabel}>Avg Speed</Text>
                </View>
              ) : null}
              {activity.elevation_gain ? (
                <View style={styles.statItem}>
                  <Ionicons
                    name="trending-up"
                    size={20}
                    color={theme.colors.navy}
                  />
                  <Text style={styles.statValue}>
                    {activity.elevation_gain.toFixed(0)}m
                  </Text>
                  <Text style={styles.statLabel}>Elevation</Text>
                </View>
              ) : null}
            </View>

            {/* Notes */}
            {activity.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesTitle}>Notes</Text>
                <Text style={styles.notesText}>{activity.notes}</Text>
              </View>
            )}

            {/* Route Map */}
            {activity.route && activity.route.length > 0 && (
              <View style={styles.mapContainer}>
                <Text style={styles.mapTitle}>Route</Text>
                <WebView
                  style={styles.map}
                  source={{ html: generateRouteMapHTML(activity.route) }}
                  scrollEnabled={false}
                  scalesPageToFit={false}
                />
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  liked && styles.actionButtonActive,
                ]}
                onPress={handleLike}
              >
                <Ionicons
                  name={liked ? "heart" : "heart-outline"}
                  size={24}
                  color={liked ? "#FF4757" : theme.colors.gray}
                />
                <Text
                  style={[styles.actionText, liked && styles.actionTextActive]}
                >
                  {likeCount} {likeCount === 1 ? "Like" : "Likes"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  // Share functionality
                  Alert.alert("Share", "Sharing functionality coming soon!");
                }}
              >
                <Ionicons
                  name="share-social"
                  size={24}
                  color={theme.colors.forest}
                />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>Comments ({comments.length})</Text>

          {comments
            .filter((comment) => !comment.reply_to_id) // Only show top-level comments
            .map((comment) => (
              <View key={comment.id}>
                {/* Parent Comment */}
                <View style={styles.comment}>
                  <View style={styles.commentHeader}>
                    <TouchableOpacity
                      style={styles.commentUser}
                      onPress={() =>
                        router.push(`/friend-profile/${comment.user.id}` as any)
                      }
                    >
                      <Text style={styles.commentAvatar}>
                        {comment.user.avatar || "👤"}
                      </Text>
                      <Text style={styles.commentUsername}>
                        {comment.user.display_name || comment.user.username}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.commentTime}>
                      {new Date(comment.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.commentText}>{comment.text}</Text>

                  <View style={styles.replyButtonContainer}>
                    <TouchableOpacity
                      style={styles.replyButton}
                      onPress={() => handleReply(comment)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.replyButtonText}>Reply</Text>
                    </TouchableOpacity>
                  </View>

                  {user && comment.user.id === user.id && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteComment(comment.id)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={theme.colors.lightGray}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Nested Replies - Show all replies to this comment */}
                {comments
                  .filter((reply) => reply.reply_to_id === comment.id)
                  .map((reply) => (
                    <View key={reply.id} style={styles.replyComment}>
                      <View style={styles.replyIndent}>
                        <View style={styles.replyLine} />
                        <View style={styles.replyContent}>
                          <View style={styles.commentHeader}>
                            <TouchableOpacity
                              style={styles.commentUser}
                              onPress={() =>
                                router.push(
                                  `/friend-profile/${reply.user.id}` as any
                                )
                              }
                            >
                              <Text style={styles.commentAvatar}>
                                {reply.user.avatar || "👤"}
                              </Text>
                              <Text style={styles.commentUsername}>
                                {reply.user.display_name || reply.user.username}
                              </Text>
                            </TouchableOpacity>
                            <Text style={styles.commentTime}>
                              {new Date(reply.created_at).toLocaleDateString()}
                            </Text>
                          </View>
                          <Text style={styles.commentText}>{reply.text}</Text>

                          {user && reply.user.id === user.id && (
                            <TouchableOpacity
                              style={[
                                styles.deleteButton,
                                { top: 8, right: -8 },
                              ]}
                              onPress={() => handleDeleteComment(reply.id)}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color={theme.colors.lightGray}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
              </View>
            ))}

          {comments.length === 0 && (
            <Text style={styles.noComments}>
              No comments yet. Be the first!
            </Text>
          )}
        </View>

        {/* Comment Input */}
        <View
          style={[
            styles.commentInputContainer,
            {
              paddingBottom: 10,
            },
          ]}
        >
          {replyingTo && (
            <View style={styles.replyingToContainer}>
              <Text style={styles.replyingToText}>Replying...</Text>
              <TouchableOpacity
                onPress={() => {
                  setReplyingTo(null);
                  setNewComment("");
                }}
              >
                <Ionicons name="close" size={20} color={theme.colors.gray} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              ref={commentInputRef}
              style={styles.commentInput}
              placeholder="Add a comment..."
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !newComment.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleAddComment}
              disabled={!newComment.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: theme.colors.gray,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: "white",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  activityType: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  activityTypeName: {
    fontSize: 16,
    color: theme.colors.forest,
    fontWeight: "600",
    marginLeft: 10,
  },
  activityName: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  ownerInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 8,
  },
  ownerAvatar: {
    fontSize: 20,
    marginRight: 8,
  },
  ownerName: {
    fontSize: 14,
    color: theme.colors.gray,
    flex: 1,
  },
  activityDate: {
    fontSize: 12,
    color: theme.colors.lightGray,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
    marginBottom: 16,
  },
  statItem: {
    width: "50%",
    paddingHorizontal: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.navy,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  notesContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 14,
    color: theme.colors.gray,
    lineHeight: 20,
  },
  mapContainer: {
    marginBottom: 16,
  },
  mapTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  map: {
    height: 200,
    borderRadius: 8,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionButtonActive: {
    backgroundColor: "#FF475720",
    borderRadius: 20,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: theme.colors.gray,
  },
  actionTextActive: {
    color: "#FF4757",
    fontWeight: "600",
  },
  commentsSection: {
    backgroundColor: "white",
    marginTop: 10,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 15,
  },
  comment: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
    position: "relative",
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  commentUser: {
    flexDirection: "row",
    alignItems: "center",
  },
  commentAvatar: {
    fontSize: 16,
    marginRight: 6,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  commentTime: {
    fontSize: 12,
    color: theme.colors.lightGray,
  },
  commentText: {
    fontSize: 14,
    color: theme.colors.gray,
    lineHeight: 20,
  },
  deleteButton: {
    position: "absolute",
    top: 12,
    right: 0,
    padding: 4,
  },
  noComments: {
    textAlign: "center",
    color: theme.colors.lightGray,
    fontSize: 14,
    paddingVertical: 20,
  },
  commentInputContainer: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
  },
  replyingToContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  replyingToText: {
    fontSize: 12,
    color: theme.colors.gray,
    fontStyle: "italic",
  },
  commentInputRow: {
    flexDirection: "row",
    padding: 12,
    paddingTop: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.forest,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.lightGray,
  },
  replyButtonContainer: {
    marginTop: 8,
  },
  replyButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    backgroundColor: "transparent",
  },
  replyButtonText: {
    fontSize: 13,
    color: theme.colors.forest,
    fontWeight: "500",
  },
  replyComment: {
    paddingLeft: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  replyIndent: {
    flexDirection: "row",
  },
  replyLine: {
    width: 2,
    backgroundColor: theme.colors.lightGray + "50",
    marginRight: 15,
    marginLeft: 10,
  },
  replyContent: {
    flex: 1,
    position: "relative",
  },
});
