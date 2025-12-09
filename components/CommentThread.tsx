// components/CommentThread.tsx

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../constants/theme";
import { Comment } from "../types/comment";

interface CommentThreadProps {
  comments: Comment[];
  currentUserId?: string;
  onReply: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
}

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onReply: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
  isReply?: boolean;
}

function CommentItem({
  comment,
  currentUserId,
  onReply,
  onDelete,
  isReply = false,
}: CommentItemProps) {
  const router = useRouter();

  const content = (
    <View style={[styles.comment, isReply && styles.replyContent]}>
      <View style={styles.commentHeader}>
        <TouchableOpacity
          style={styles.commentUser}
          onPress={() => router.push(`/friend-profile/${comment.user.id}` as any)}
        >
          <Text style={styles.commentAvatar}>{comment.user.avatar || "👤"}</Text>
          <Text style={styles.commentUsername}>
            {comment.user.display_name || comment.user.username}
          </Text>
        </TouchableOpacity>
        <Text style={styles.commentTime}>
          {new Date(comment.created_at).toLocaleDateString()}
        </Text>
      </View>
      
      <Text style={styles.commentText}>{comment.text}</Text>

      {!isReply && (
        <View style={styles.replyButtonContainer}>
          <TouchableOpacity
            style={styles.replyButton}
            onPress={() => onReply(comment)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.replyButtonText}>Reply</Text>
          </TouchableOpacity>
        </View>
      )}

      {currentUserId && comment.user.id === currentUserId && (
        <TouchableOpacity
          style={[styles.deleteButton, isReply && { top: 0, right: -8 }]}
          onPress={() => onDelete(comment.id)}
        >
          <Ionicons
            name="trash-outline"
            size={16}
            color={theme.colors.lightGray}
          />
        </TouchableOpacity>
      )}
    </View>
  );

  if (isReply) {
    return (
      <View style={styles.replyComment}>
        <View style={styles.replyIndent}>
          <View style={styles.replyLine} />
          {content}
        </View>
      </View>
    );
  }

  return content;
}

export function CommentThread({
  comments,
  currentUserId,
  onReply,
  onDelete,
}: CommentThreadProps) {
  // Get top-level comments (no reply_to_id)
  const topLevelComments = comments.filter((c) => !c.reply_to_id);

  // Get replies for a given comment
  const getReplies = (commentId: string) =>
    comments.filter((c) => c.reply_to_id === commentId);

  if (comments.length === 0) {
    return (
      <Text style={styles.noComments}>No comments yet. Be the first!</Text>
    );
  }

  return (
    <View>
      {topLevelComments.map((comment) => (
        <View key={comment.id}>
          <CommentItem
            comment={comment}
            currentUserId={currentUserId}
            onReply={onReply}
            onDelete={onDelete}
          />
          
          {/* Nested replies */}
          {getReplies(comment.id).map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onDelete={onDelete}
              isReply
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: 0,
    borderBottomWidth: 0,
  },
  noComments: {
    textAlign: "center",
    color: theme.colors.lightGray,
    fontSize: 14,
    paddingVertical: 20,
  },
});