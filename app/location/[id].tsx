// app/location/[id].tsx

import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommentInput } from "../../components/CommentInput";
import { CommentThread } from "../../components/CommentThread";
import { categories } from "../../constants/categories";
import { theme } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useLocationDetails } from "../../hooks/useLocationDetails";

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const {
    location,
    comments,
    liked,
    likeCount,
    loading,
    refreshing,
    submitting,
    newComment,
    replyingTo,
    commentInputRef,
    setNewComment,
    onRefresh,
    handleLike,
    handleReply,
    handleAddComment,
    handleDeleteComment,
    cancelReply,
  } = useLocationDetails(id as string);

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
          headerStyle: { backgroundColor: theme.colors.forest },
          headerTintColor: "#fff",
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
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
                style={[styles.categoryBadge, { backgroundColor: category.color }]}
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
                  Saved by {location.user.display_name || location.user.username}
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
                style={[styles.actionButton, liked && styles.actionButtonActive]}
                onPress={handleLike}
              >
                <Ionicons
                  name={liked ? "heart" : "heart-outline"}
                  size={24}
                  color={liked ? "#FF4757" : theme.colors.gray}
                />
                <Text style={[styles.actionText, liked && styles.actionTextActive]}>
                  {likeCount} {likeCount === 1 ? "Like" : "Likes"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  // Open in maps - could extract to util
                  const url =
                    Platform.OS === "ios"
                      ? `maps:0,0?q=${location.name}@${location.latitude},${location.longitude}`
                      : `geo:0,0?q=${location.latitude},${location.longitude}(${location.name})`;
                  // Linking.openURL(url);
                }}
              >
                <Ionicons name="navigate" size={24} color={theme.colors.forest} />
                <Text style={styles.actionText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>
              Comments ({comments.length})
            </Text>
            <CommentThread
              comments={comments}
              currentUserId={user?.id}
              onReply={handleReply}
              onDelete={handleDeleteComment}
            />
          </View>
        </ScrollView>

        {/* Comment Input */}
        <CommentInput
          value={newComment}
          onChangeText={setNewComment}
          onSubmit={handleAddComment}
          submitting={submitting}
          replyingTo={replyingTo}
          onCancelReply={cancelReply}
          inputRef={commentInputRef}
        />
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
});