// app/friends-feed.tsx

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FeedItemCard } from "../components/FeedItemCard";
import { UserAvatar } from "../components/UserAvatar";
import { theme } from "../constants/theme";
import { useFriends, FeedPost } from "../contexts/FriendsContext";
import { useSettings } from "../contexts/SettingsContext";
import { useWishlist } from "../contexts/WishlistContext";
import { supabase } from "../lib/supabase";

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
    currentUserId,
    loading,
  } = useFriends();
  const { formatDistance, formatSpeed } = useSettings();
  const { wishlistItems, addWishlistItem, removeWishlistItem } = useWishlist();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "activities" | "locations" | "trips"
  >("all");
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedFriendFeed, setSelectedFriendFeed] = useState<FeedPost[]>([]);
  const [loadingFriendFeed, setLoadingFriendFeed] = useState(false);

  const acceptedFriends = friends.filter((f) => f.status === "accepted");

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

    // If viewing a specific friend's feed, also update local state
    if (selectedFriendId && currentUserId) {
      setSelectedFriendFeed((prev) =>
        prev.map((post) => {
          if (post.id === itemId) {
            if (shouldLike) {
              return {
                ...post,
                data: {
                  ...post.data,
                  likes: [...post.data.likes, currentUserId],
                },
              };
            } else {
              return {
                ...post,
                data: {
                  ...post.data,
                  likes: post.data.likes.filter(
                    (id: string) => id !== currentUserId
                  ),
                },
              };
            }
          }
          return post;
        })
      );
    }
  };

  const handleComment = (
    itemId: string,
    text: string,
    replyToId?: string,
    replyToUserName?: string
  ) => {
    addComment(itemId, text, replyToId, replyToUserName);

    // If viewing a specific friend's feed, also update local state
    if (selectedFriendId && currentUserId) {
      const newComment = {
        id: `temp-${Date.now()}`, // Temp ID until refresh
        userId: currentUserId,
        userName: "You", // Will show correctly after refresh
        text: text,
        timestamp: new Date(),
        replyTo: replyToId,
        replyToUser: replyToUserName,
      };

      setSelectedFriendFeed((prev) =>
        prev.map((post) => {
          if (post.id === itemId) {
            return {
              ...post,
              data: {
                ...post.data,
                comments: [...post.data.comments, newComment],
              },
            };
          }
          return post;
        })
      );
    }
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

  const handleFriendClick = async (friendId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedFriendId === friendId) {
      setSelectedFriendId(null);
      setSelectedFriendFeed([]);
    } else {
      setSelectedFriendId(friendId);
      await loadFriendSpecificFeed(friendId);
    }
  };

  const loadFriendSpecificFeed = async (friendId: string) => {
    setLoadingFriendFeed(true);
    try {
      const { data: activities } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", friendId)
        .order("start_time", { ascending: false })
        .limit(100);

      const { data: locations } = await supabase
        .from("locations")
        .select("*")
        .eq("user_id", friendId)
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: trips } = await supabase
        .from("trips")
        .select(`*, trip_items(*)`)
        .eq("created_by", friendId)
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", friendId)
        .single();

      if (!profile) {
        setSelectedFriendFeed([]);
        setLoadingFriendFeed(false);
        return;
      }

      const activityIds = activities?.map((a) => a.id) || [];
      const locationIds = locations?.map((l) => l.id) || [];

      const { data: activityLikes } = await supabase
        .from("likes")
        .select("activity_id, user_id")
        .in("activity_id", activityIds);

      const { data: locationLikes } = await supabase
        .from("likes")
        .select("location_id, user_id")
        .in("location_id", locationIds);

      const { data: activityComments } = await supabase
        .from("comments")
        .select(
          "*, user:profiles!comments_user_id_fkey(id, username, display_name, avatar)"
        )
        .in("activity_id", activityIds)
        .order("created_at", { ascending: false });

      const { data: locationComments } = await supabase
        .from("comments")
        .select(
          "*, user:profiles!comments_user_id_fkey(id, username, display_name, avatar)"
        )
        .in("location_id", locationIds)
        .order("created_at", { ascending: false });

      const activityLikesMap: Record<string, string[]> = {};
      activityLikes?.forEach((like) => {
        if (!activityLikesMap[like.activity_id])
          activityLikesMap[like.activity_id] = [];
        activityLikesMap[like.activity_id].push(like.user_id);
      });

      const locationLikesMap: Record<string, string[]> = {};
      locationLikes?.forEach((like) => {
        if (!locationLikesMap[like.location_id])
          locationLikesMap[like.location_id] = [];
        locationLikesMap[like.location_id].push(like.user_id);
      });

      const activityCommentsMap: Record<string, any[]> = {};
      activityComments?.forEach((comment) => {
        if (!activityCommentsMap[comment.activity_id])
          activityCommentsMap[comment.activity_id] = [];
        activityCommentsMap[comment.activity_id].push({
          id: comment.id,
          userId: comment.user_id,
          userName:
            comment.user?.display_name || comment.user?.username || "Unknown",
          text: comment.text,
          timestamp: new Date(comment.created_at),
          replyTo: comment.reply_to_id,
        });
      });

      const locationCommentsMap: Record<string, any[]> = {};
      locationComments?.forEach((comment) => {
        if (!locationCommentsMap[comment.location_id])
          locationCommentsMap[comment.location_id] = [];
        locationCommentsMap[comment.location_id].push({
          id: comment.id,
          userId: comment.user_id,
          userName:
            comment.user?.display_name || comment.user?.username || "Unknown",
          text: comment.text,
          timestamp: new Date(comment.created_at),
          replyTo: comment.reply_to_id,
        });
      });

      const friendData = {
        id: friendId,
        username: profile.username || "",
        displayName: profile.display_name || profile.username || "Unknown",
        avatar: profile.avatar,
        profile_picture: profile.profile_picture,
        friendsSince: new Date(),
        status: "accepted" as const,
      };

      const activityPosts: FeedPost[] = (activities || []).map((activity) => ({
        id: `activity-${activity.id}`,
        type: "activity" as const,
        timestamp: new Date(activity.start_time),
        data: {
          id: activity.id,
          name: activity.name,
          type: activity.type,
          distance: activity.distance || 0,
          duration: activity.duration || 0,
          averageSpeed: activity.average_speed || 0,
          maxSpeed: activity.max_speed || 0,
          elevationGain: activity.elevation_gain || 0,
          startTime: new Date(activity.start_time),
          activityDate: activity.activity_date
            ? new Date(activity.activity_date)
            : undefined,
          notes: activity.notes,
          route: activity.route || [],
          sharedBy: friendData,
          sharedAt: new Date(activity.created_at || activity.start_time),
          likes: activityLikesMap[activity.id] || [],
          comments: activityCommentsMap[activity.id] || [],
        },
      }));

      const locationPosts: FeedPost[] = (locations || []).map((location) => ({
        id: `location-${location.id}`,
        type: "location" as const,
        timestamp: new Date(location.created_at),
        data: {
          id: location.id,
          name: location.name,
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          locationDate: location.location_date
            ? new Date(location.location_date)
            : undefined,
          description: location.description,
          photos: location.photos || [],
          category: location.category,
          sharedBy: friendData,
          sharedAt: new Date(location.created_at),
          likes: locationLikesMap[location.id] || [],
          comments: locationCommentsMap[location.id] || [],
        },
      }));

      const tripPosts: FeedPost[] = (trips || []).map((trip) => ({
        id: `trip-${trip.id}`,
        type: "trip" as const,
        timestamp: new Date(trip.created_at),
        data: {
          id: trip.id,
          name: trip.name,
          start_date: new Date(trip.start_date),
          end_date: new Date(trip.end_date),
          cover_photo: trip.cover_photo,
          itemCount: trip.trip_items?.length || 0,
          tripItems: trip.trip_items?.slice(0, 3).map((item: any) => ({
            type: item.type,
            name: item.data?.name || "Item",
            date: new Date(
              item.data?.start_time || item.data?.created_at || trip.start_date
            ),
          })),
          sharedBy: friendData,
          sharedAt: new Date(trip.created_at),
          likes: [],
          comments: [],
        },
      }));

      const allPosts = [...activityPosts, ...locationPosts, ...tripPosts].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      setSelectedFriendFeed(allPosts);
    } catch (error) {
      console.error("Error loading friend feed:", error);
      setSelectedFriendFeed([]);
    } finally {
      setLoadingFriendFeed(false);
    }
  };

  const selectedFriendName = selectedFriendId
    ? friends.find((f) => f.id === selectedFriendId)?.displayName ||
      friends.find((f) => f.id === selectedFriendId)?.username
    : null;

  const feedToFilter = selectedFriendId ? selectedFriendFeed : feed;

  const filteredFeed = feedToFilter.filter((item) => {
    if (filter === "activities" && item.type !== "activity") return false;
    if (filter === "locations" && item.type !== "location") return false;
    if (filter === "trips" && item.type !== "trip") return false;
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
        {selectedFriendId
          ? `No posts from ${selectedFriendName}`
          : "The adventures of your friends will appear here"}
      </Text>
      {selectedFriendId && (
        <TouchableOpacity
          style={styles.clearFilterButton}
          onPress={() => setSelectedFriendId(null)}
        >
          <Text style={styles.clearFilterText}>Show All Posts</Text>
        </TouchableOpacity>
      )}
      {!selectedFriendId && (
        <TouchableOpacity
          style={styles.findFriendsButton}
          onPress={() => router.push("/friends")}
        >
          <Text style={styles.findFriendsText}>Find Friends</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Friends Feed",
          headerStyle: { backgroundColor: theme.colors.forest },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "bold" },
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

      {/* Online Friends Bar */}
      {friends.length > 0 && (
        <View style={styles.onlineBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {acceptedFriends.map((friend) => {
              const isOnline =
                friend.lastActive &&
                new Date().getTime() - new Date(friend.lastActive).getTime() <
                  300000;
              const isSelected = selectedFriendId === friend.id;

              return (
                <TouchableOpacity
                  key={friend.id}
                  style={[
                    styles.onlineFriend,
                    isSelected && styles.selectedFriend,
                  ]}
                  onPress={() => handleFriendClick(friend.id)}
                >
                  <View
                    style={[
                      styles.onlineAvatar,
                      isSelected && styles.selectedAvatar,
                    ]}
                  >
                    <UserAvatar user={friend} size={46} />
                    {isOnline && <View style={styles.onlineIndicator} />}
                    {isSelected && (
                      <View style={styles.selectedCheckmark}>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={theme.colors.forest}
                        />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.onlineName,
                      isSelected && styles.selectedName,
                    ]}
                  >
                    {(friend.displayName || friend.username).split(" ")[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Active Filter Indicator */}
      {selectedFriendId && (
        <View style={styles.activeFilterBar}>
          <View style={styles.activeFilterContent}>
            <Ionicons name="filter" size={16} color={theme.colors.forest} />
            <Text style={styles.activeFilterText}>
              Showing posts from {selectedFriendName}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedFriendId(null)}>
            <Ionicons
              name="close-circle"
              size={20}
              color={theme.colors.burntOrange}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {(["all", "activities", "locations", "trips"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === tab && styles.filterTabTextActive,
              ]}
            >
              {tab === "all"
                ? "All"
                : tab === "activities"
                ? "Activities"
                : tab === "locations"
                ? "Places"
                : "Trips"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.forest} />
        </View>
      ) : loadingFriendFeed ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.forest} />
          <Text style={styles.loadingText}>
            Loading {selectedFriendName}'s posts...
          </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
  selectedFriend: {
    backgroundColor: theme.colors.forest + "15",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  onlineAvatar: {
    position: "relative",
  },
  selectedAvatar: {
    borderWidth: 3,
    borderColor: theme.colors.forest,
    borderRadius: 25,
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
  selectedCheckmark: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "white",
    borderRadius: 10,
  },
  onlineName: {
    fontSize: 12,
    color: theme.colors.navy,
    marginTop: 5,
    fontWeight: "500",
  },
  selectedName: {
    color: theme.colors.forest,
    fontWeight: "700",
  },
  activeFilterBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.forest + "10",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.forest + "20",
  },
  activeFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  activeFilterText: {
    fontSize: 14,
    color: theme.colors.forest,
    marginLeft: 8,
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: theme.colors.gray,
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
  clearFilterButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  clearFilterText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});
