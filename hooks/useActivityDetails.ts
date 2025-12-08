// hooks/useActivityDetails.ts

import { useEffect, useRef, useState } from "react";
import { Alert, TextInput } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { Activity, Comment } from "../types/activity";

interface UseActivityDetailsReturn {
  // Data
  activity: Activity | null;
  comments: Comment[];
  liked: boolean;
  likeCount: number;

  // State
  loading: boolean;
  refreshing: boolean;
  submitting: boolean;
  newComment: string;
  replyingTo: string | null;

  // Refs
  commentInputRef: React.RefObject<TextInput>;

  // Actions
  setNewComment: (text: string) => void;
  setReplyingTo: (id: string | null) => void;
  onRefresh: () => void;
  handleLike: () => Promise<void>;
  handleReply: (comment: Comment) => void;
  handleAddComment: () => Promise<void>;
  handleDeleteComment: (commentId: string) => void;
  cancelReply: () => void;
}

export function useActivityDetails(activityId: string): UseActivityDetailsReturn {
  const { user } = useAuth();

  // Data state
  const [activity, setActivity] = useState<Activity | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Refs
  const commentInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (activityId) {
      loadActivityDetails();
      checkIfLiked();
    }
  }, [activityId]);

  const loadActivityDetails = async () => {
    try {
      // Load activity
      const { data: activityData, error: activityError } = await supabase
        .from("activities")
        .select("*")
        .eq("id", activityId)
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
        .eq("activity_id", activityId)
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
        .eq("activity_id", activityId);

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
      .eq("activity_id", activityId)
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
        await supabase
          .from("likes")
          .delete()
          .eq("activity_id", activityId)
          .eq("user_id", user.id);

        setLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      } else {
        await supabase.from("likes").insert({
          activity_id: activityId,
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
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 100);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setNewComment("");
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
        activity_id: activityId,
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

  const handleDeleteComment = (commentId: string) => {
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

  return {
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
    setReplyingTo,
    onRefresh,
    handleLike,
    handleReply,
    handleAddComment,
    handleDeleteComment,
    cancelReply,
  };
}