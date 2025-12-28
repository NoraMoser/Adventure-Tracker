import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
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
import { ActivityStats } from "../../components/ActivityStats";
import { CommentInput } from "../../components/CommentInput";
import { CommentThread } from "../../components/CommentThread";
import { RouteMap } from "../../components/RouteMap";
import { theme } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useActivityDetails } from "../../hooks/useActivityDetails";
import { getActivityIcon, getActivityTypeLabel } from "../../utils/activity";

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const {
    activity,
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
  } = useActivityDetails(id as string);

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
          {/* Activity Header */}
          <View style={styles.header}>
            <View style={styles.activityType}>
              <Ionicons
                name={getActivityIcon(activity.type) as any}
                size={32}
                color={theme.colors.forest}
              />
              <Text style={styles.activityTypeName}>
                {getActivityTypeLabel(activity.type)}
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
            <ActivityStats activity={activity} />

            {/* Notes */}
            {activity.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesTitle}>Notes</Text>
                <Text style={styles.notesText}>{activity.notes}</Text>
              </View>
            )}

            {/* Route Map */}
            <RouteMap route={activity.route || []} />

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