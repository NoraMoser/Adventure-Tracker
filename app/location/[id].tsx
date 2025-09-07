// app/location/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { categories } from "../../constants/categories";
import { theme } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

interface Comment {
  id: string;
  text: string;
  created_at: string;
  reply_to_id?: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar?: string;
  };
}

interface Location {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  category: string;
  rating?: number;
  photos?: string[];
  created_at: string;
  user_id: string;
  user?: {
    username: string;
    display_name: string;
    avatar?: string;
  };
}

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [location, setLocation] = useState<Location | null>(null);
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
      loadLocationDetails();
      checkIfLiked();
    }
  }, [id]);

  const loadLocationDetails = async () => {
    try {
      // Load location with owner info
      const { data: locationData, error: locationError } = await supabase
        .from("locations")
        .select("*")
        .eq("id", id)
        .single();

      if (locationError) throw locationError;

      // Load owner profile separately
      if (locationData.user_id) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar")
          .eq("id", locationData.user_id)
          .single();

        locationData.user = ownerProfile;
      }

      setLocation(locationData);

      // Load comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .eq("location_id", id)
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
        .eq("location_id", id);

      setLikeCount(count || 0);
    } catch (error) {
      console.error("Error loading location details:", error);
      Alert.alert("Error", "Failed to load location details");
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
      .eq("location_id", id)
      .eq("user_id", user.id)
      .single();

    setLiked(!!data);
  };

  const handleLike = async () => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to like locations");
      return;
    }

    try {
      if (liked) {
        // Unlike
        await supabase
          .from("likes")
          .delete()
          .eq("location_id", id)
          .eq("user_id", user.id);

        setLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      } else {
        // Like
        await supabase.from("likes").insert({
          location_id: id,
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
    const replyPrefix = `@${comment.user.display_name || comment.user.username} `;
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
      const commentData: any = {
        location_id: id,
        user_id: user.id,
        text: newComment.trim(),
      };

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
    loadLocationDetails();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.forest} />
      </SafeAreaView>
    );
  }

  if (!location) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Location not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const category =
    categories[location.category as keyof typeof categories] ||
    categories.other;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: location.name,
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
          {/* Location Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: category.color },
                ]}
              >
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text style={styles.categoryText}>{category.label}</Text>
              </View>
              {location.rating && (
                <View style={styles.rating}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingText}>
                    {location.rating.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.locationName}>{location.name}</Text>

            {location.description && (
              <Text style={styles.description}>{location.description}</Text>
            )}

            {/* Owner Info */}
            {location.user && (
              <TouchableOpacity
                style={styles.ownerInfo}
                onPress={() =>
                  router.push(`/friend-profile/${location.user_id}` as any)
                }
              >
                <Text style={styles.ownerAvatar}>
                  {location.user.avatar || "👤"}
                </Text>
                <Text style={styles.ownerName}>
                  Saved by{" "}
                  {location.user.display_name || location.user.username}
                </Text>
                <Text style={styles.savedDate}>
                  {new Date(location.created_at).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            )}

            {/* Photos */}
            {location.photos && location.photos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photosContainer}
              >
                {location.photos.map((photo, index) => (
                  <Image
                    key={index}
                    source={{ uri: photo }}
                    style={styles.photo}
                  />
                ))}
              </ScrollView>
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
                  // Open in maps
                  const url =
                    Platform.OS === "ios"
                      ? `maps:0,0?q=${location.name}@${location.latitude},${location.longitude}`
                      : `geo:0,0?q=${location.latitude},${location.longitude}(${location.name})`;
                  // Linking.openURL(url);
                }}
              >
                <Ionicons
                  name="navigate"
                  size={24}
                  color={theme.colors.forest}
                />
                <Text style={styles.actionText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>
              Comments ({comments.length})
            </Text>

            {comments
              .filter((comment) => !comment.reply_to_id)
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

                    <TouchableOpacity
                      style={styles.replyButton}
                      onPress={() => handleReply(comment)}
                    >
                      <Text style={styles.replyButtonText}>Reply</Text>
                    </TouchableOpacity>

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

                  {/* Nested Replies */}
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
                                  router.push(`/friend-profile/${reply.user.id}` as any)
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
                                style={[styles.deleteButton, { top: 8, right: -8 }]}
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
        </ScrollView>

        {/* Comment Input */}
        <View style={[styles.commentInputContainer, {
          paddingBottom: Platform.OS === "ios" ? 20 : 10,
        }]}>
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
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  locationName: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: 12,
    lineHeight: 20,
  },
  ownerInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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
  savedDate: {
    fontSize: 12,
    color: theme.colors.lightGray,
  },
  photosContainer: {
    marginVertical: 12,
  },
  photo: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginRight: 10,
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
  replyButton: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
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
  commentInputRow: {
    flexDirection: "row",
    padding: 12,
  },
  replyingToContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: theme.colors.forest + "10",
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
  },
  replyingToText: {
    fontSize: 12,
    color: theme.colors.forest,
    fontStyle: "italic",
  },
});