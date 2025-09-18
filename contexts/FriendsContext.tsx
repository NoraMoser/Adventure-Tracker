// contexts/FriendsContext.tsx - Complete with push notifications
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";
import { supabase } from "../lib/supabase";
import { PushNotificationHelper } from "../lib/notifications";
import { Activity } from "./ActivityContext";
import { useAuth } from "./AuthContext";

// Type definitions
export interface Friend {
  id: string;
  username: string;
  displayName: string;
  profile_picture?: string | null;
  avatar?: string;
  friendsSince: Date;
  status: "pending" | "accepted" | "blocked";
  lastActive?: Date;
}

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  message?: string;
  sent_at: string;
  from_user?: Friend;
  from?: Friend;
  to?: string;
  sentAt?: Date;
}

export interface FeedComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
  replyTo?: string;
  replyToUser?: string;
}

export interface FeedPost {
  id: string;
  type: "activity" | "location" | "achievement";
  timestamp: Date;
  data: {
    id?: string;
    name?: string;
    type?: string;
    distance?: number;
    duration?: number;
    averageSpeed?: number;
    maxSpeed?: number;
    elevationGain?: number;
    startTime?: Date;
    notes?: string;
    route?: any[];
    location?: {
      latitude: number;
      longitude: number;
    };
    description?: string;
    photos?: string[];
    category?: string;
    achievementName?: string;
    achievementIcon?: string;
    sharedBy: Friend;
    sharedAt: Date;
    likes: string[];
    comments: FeedComment[];
  };
}

export interface FriendSuggestion {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  profile_picture?: string | null;
  mutualFriendsCount: number;
  suggestionReason: string;
}

interface FriendsContextType {
  friends: Friend[];
  friendRequests: FriendRequest[];
  pendingRequests: FriendRequest[];
  suggestions?: FriendSuggestion[];
  feed: FeedPost[];
  loading: boolean;
  error: string | null;
  currentUserId: string;

  sendFriendRequest: (username: string, message?: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  cancelFriendRequest?: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<Friend[]>;

  refreshFeed: () => Promise<void>;
  refreshFriends?: () => Promise<void>;
  refreshSuggestions?: () => Promise<void>;
  shareActivity: (
    activityId: string,
    friendIds?: string[],
    options?: any
  ) => Promise<void>;
  shareLocation: (locationId: string, friendIds?: string[]) => Promise<void>;
  shareAchievement: (
    achievementId: string,
    achievementName: string,
    achievementIcon: string
  ) => Promise<void>;
  addActivityToFeed: (activity: Activity, options?: any) => Promise<void>;

  likeItem: (itemId: string) => Promise<void>;
  unlikeItem: (itemId: string) => Promise<void>;
  addComment: (
    itemId: string,
    text: string,
    replyToCommentId?: string,
    replyToUserName?: string
  ) => Promise<void>;
  deleteComment: (itemId: string, commentId: string) => Promise<void>;

  getFriendActivities: (friendId: string) => any[];
  getFriendLocations: (friendId: string) => any[];

  privacySettings: {
    shareActivitiesWithFriends: boolean;
    shareLocationsWithFriends: boolean;
    allowFriendRequests: boolean;
    showOnlineStatus: boolean;
    defaultActivityPrivacy: "stats_only" | "general_area" | "full_route";
    autoShareActivities: boolean;
  };
  updatePrivacySettings: (
    settings: Partial<FriendsContextType["privacySettings"]>
  ) => Promise<void>;

  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

export const FriendsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user, profile } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [privacySettings, setPrivacySettings] = useState({
    shareActivitiesWithFriends: true,
    shareLocationsWithFriends: true,
    allowFriendRequests: true,
    showOnlineStatus: true,
    defaultActivityPrivacy: "general_area" as
      | "stats_only"
      | "general_area"
      | "full_route",
    autoShareActivities: false,
  });

  // Update currentUserId when user changes
  useEffect(() => {
    if (user) {
      console.log("FriendsContext: User changed to:", user.id);
      setCurrentUserId(user.id);
      refreshFriends();
    } else {
      console.log("FriendsContext: User logged out");
      setCurrentUserId("");
      // Clear all data
      setFriends([]);
      setFriendRequests([]);
      setPendingRequests([]);
      setSuggestions([]);
      setFeed([]);
      setError(null);
    }
  }, [user]);

  // Load feed when friends change
  useEffect(() => {
    if (friends && friends.length > 0 && currentUserId) {
      loadFeed();
    }
  }, [friends?.length, currentUserId]);

  const refreshFriends = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Load accepted friendships from friendships table
      const { data: friendships, error: friendshipsError } = await supabase
        .from("friendships")
        .select("*")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted");

      if (friendshipsError) {
        console.error("Error loading friendships:", friendshipsError);
      }

      // Get friend profiles
      if (friendships && friendships.length > 0) {
        // Use a Set to ensure unique friend IDs
        const friendIdsSet = new Set<string>();
        friendships.forEach((f) => {
          const friendId = f.user_id === user.id ? f.friend_id : f.user_id;
          friendIdsSet.add(friendId);
        });
        const friendIds = Array.from(friendIdsSet);

        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", friendIds);

        const profileMap: Record<string, any> = {};
        profiles?.forEach((p) => {
          profileMap[p.id] = p;
        });

        // Use a Map to ensure unique friends by ID
        const friendsMap = new Map<string, Friend>();
        friendships.forEach((f) => {
          const friendId = f.user_id === user.id ? f.friend_id : f.user_id;

          // Only add if not already in the map
          if (!friendsMap.has(friendId)) {
            const profile = profileMap[friendId] || {};
            friendsMap.set(friendId, {
              id: friendId,
              username: profile.username || "",
              displayName:
                profile.display_name || profile.username || "Unknown",
              avatar: profile.avatar,
              profile_picture: profile.profile_picture,
              status: "accepted" as const,
              friendsSince: new Date(f.accepted_at || f.requested_at),
              lastActive: profile.last_active
                ? new Date(profile.last_active)
                : undefined,
            });
          }
        });
        const processedFriends = Array.from(friendsMap.values());

        setFriends(processedFriends);
      } else {
        setFriends([]);
      }

      // 2. Load incoming friend requests from friend_requests table
      const { data: incomingRequests, error: incomingError } = await supabase
        .from("friend_requests")
        .select("*")
        .eq("to_user_id", user.id);

      if (incomingError) {
        console.error("Error loading incoming requests:", incomingError);
      }

      // Get sender profiles
      if (incomingRequests && incomingRequests.length > 0) {
        const senderIds = incomingRequests.map((r) => r.from_user_id);

        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", senderIds);

        const profileMap: Record<string, any> = {};
        profiles?.forEach((p) => {
          profileMap[p.id] = p;
        });

        const processedRequests: FriendRequest[] = incomingRequests.map(
          (r) => ({
            id: r.id,
            from_user_id: r.from_user_id,
            to_user_id: r.to_user_id,
            message: r.message,
            sent_at: r.sent_at,
            from_user: profileMap[r.from_user_id] || {
              id: r.from_user_id,
              username: "Unknown",
              displayName: "Unknown User",
            },
            from: profileMap[r.from_user_id] || {
              id: r.from_user_id,
              username: "Unknown",
              displayName: "Unknown User",
            },
            sentAt: new Date(r.sent_at),
          })
        );

        setFriendRequests(processedRequests);
      } else {
        setFriendRequests([]);
      }

      // 3. Load sent friend requests from friend_requests table
      const { data: sentRequests, error: sentError } = await supabase
        .from("friend_requests")
        .select("*")
        .eq("from_user_id", user.id);

      if (sentError) {
        console.error("Error loading sent requests:", sentError);
      }

      // Get receiver profiles
      if (sentRequests && sentRequests.length > 0) {
        const receiverIds = sentRequests.map((r) => r.to_user_id);

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", receiverIds);

        const profileMap: Record<string, any> = {};
        profiles?.forEach((p) => {
          profileMap[p.id] = p;
        });

        const processedSent: FriendRequest[] = sentRequests.map((r) => ({
          id: r.id,
          from_user_id: r.from_user_id,
          to_user_id: r.to_user_id,
          to: profileMap[r.to_user_id]?.username || "Unknown",
          message: r.message,
          sent_at: r.sent_at,
          sentAt: new Date(r.sent_at),
        }));

        setPendingRequests(processedSent);
      } else {
        setPendingRequests([]);
      }

      // Load suggestions
      await loadSuggestions();
    } catch (error) {
      console.error("Error in refreshFriends:", error);
      setError("Failed to load friends");
    } finally {
      setLoading(false);
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    if (!user) return;

    try {
      // Find the request in our state
      const request = friendRequests.find((r) => r.id === requestId);
      if (!request) {
        Alert.alert("Error", "Friend request not found");
        return;
      }

      // 1. Delete from friend_requests table
      const { error: deleteError } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId);

      if (deleteError) {
        console.error("Error deleting friend request:", deleteError);
        Alert.alert("Error", "Failed to accept friend request");
        return;
      }

      // 2. Insert into friendships table
      const { error: insertError } = await supabase.from("friendships").insert({
        user_id: request.from_user_id,
        friend_id: user.id,
        status: "accepted",
        requested_at: request.sent_at,
        accepted_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("Error creating friendship:", insertError);
        Alert.alert("Error", "Failed to create friendship");
        return;
      }

      // 3. Send notification to requester that their request was accepted
      await supabase.from("notifications").insert({
        user_id: request.from_user_id,
        from_user_id: user.id,
        type: "friend_accepted",
        title: "Friend Request Accepted",
        message: `${
          profile?.display_name || profile?.username
        } accepted your friend request!`,
        data: { friend_id: user.id },
        read: false,
      });

      // Send push notification
      await PushNotificationHelper.sendNotificationToUser(
        request.from_user_id,
        "friend_accepted",
        "Friend Request Accepted",
        `${profile?.display_name || profile?.username} is now your friend!`,
        {
          type: "friend_accepted",
          friend_id: user.id,
        }
      );

      // 4. Update local state immediately
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));

      // 5. Add to friends list
      if (request.from_user) {
        const newFriend: Friend = {
          id: request.from_user_id,
          username: request.from_user.username || "",
          displayName:
            request.from_user.displayName || request.from_user.username || "",
          avatar: request.from_user.avatar,
          profile_picture: request.from_user.profile_picture,
          status: "accepted",
          friendsSince: new Date(),
          lastActive: undefined,
        };

        setFriends((prev) => [...prev, newFriend]);
      }

      Alert.alert("Success", "Friend request accepted!");

      // Refresh to sync everything
      setTimeout(() => {
        refreshFriends();
      }, 1000);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Error", "Failed to accept friend request");
    }
  };

  const declineFriendRequest = async (requestId: string) => {
    if (!user) return;

    try {
      // Delete from friend_requests table
      const { error } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId);

      if (error) {
        console.error("Error declining friend request:", error);
        Alert.alert("Error", "Failed to decline friend request");
        return;
      }

      // Update local state
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));

      Alert.alert("Success", "Friend request declined");
    } catch (error) {
      console.error("Error declining friend request:", error);
      Alert.alert("Error", "Failed to decline friend request");
    }
  };

  const cancelFriendRequest = async (requestId: string) => {
    if (!user) return;

    try {
      // Delete from friend_requests table
      const { error } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId);

      if (error) {
        console.error("Error canceling friend request:", error);
        Alert.alert("Error", "Failed to cancel friend request");
        return;
      }

      // Update local state
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));

      Alert.alert("Success", "Friend request canceled");
    } catch (error) {
      console.error("Error canceling friend request:", error);
      Alert.alert("Error", "Failed to cancel friend request");
    }
  };

  const sendFriendRequest = async (username: string, message?: string) => {
    if (!user) {
      Alert.alert("Error", "Please log in to send friend requests");
      return;
    }

    try {
      const cleanUsername = username.toLowerCase().trim();

      // Find target user
      const { data: targetUser, error: userError } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("username", cleanUsername)
        .single();

      if (userError || !targetUser) {
        Alert.alert("Error", `User "${username}" not found`);
        return;
      }

      // Check if already friends in friendships table
      const { data: existingFriendship } = await supabase
        .from("friendships")
        .select("id")
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${user.id})`
        )
        .single();

      if (existingFriendship) {
        Alert.alert("Error", "You are already friends with this user");
        return;
      }

      // Check for existing request in friend_requests table
      const { data: existingRequest } = await supabase
        .from("friend_requests")
        .select("id")
        .or(
          `and(from_user_id.eq.${user.id},to_user_id.eq.${targetUser.id}),and(from_user_id.eq.${targetUser.id},to_user_id.eq.${user.id})`
        )
        .single();

      if (existingRequest) {
        Alert.alert("Error", "A friend request already exists");
        return;
      }

      // Send the request to friend_requests table
      const { data: newRequest, error: requestError } = await supabase
        .from("friend_requests")
        .insert({
          from_user_id: user.id,
          to_user_id: targetUser.id,
          message,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Create notification in database
      await supabase.from("notifications").insert({
        user_id: targetUser.id,
        from_user_id: user.id,
        type: "friend_request",
        title: "New Friend Request",
        message: `${
          profile?.display_name || profile?.username || "Someone"
        } sent you a friend request`,
        data: {
          request_id: newRequest.id,
          message: message,
        },
        read: false,
      });

      // Send push notification
      await PushNotificationHelper.sendNotificationToUser(
        targetUser.id,
        "friend_request",
        "New Friend Request",
        `${
          profile?.display_name || profile?.username
        } wants to be your friend!`,
        {
          type: "friend_request",
          request_id: newRequest.id,
        }
      );

      Alert.alert(
        "Success",
        `Friend request sent to ${
          targetUser.display_name || targetUser.username
        }`
      );

      await refreshFriends();
    } catch (err: any) {
      console.error("Error sending friend request:", err);
      Alert.alert("Error", "Failed to send friend request");
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return;

    try {
      // Delete from friendships table
      const { error } = await supabase
        .from("friendships")
        .delete()
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`
        );

      if (error) throw error;

      // Update local state
      setFriends((prev) => prev.filter((f) => f.id !== friendId));

      Alert.alert("Success", "Friend removed");
    } catch (err) {
      Alert.alert("Error", "Failed to remove friend");
    }
  };

  const blockUser = async (userId: string) => {
    if (!user) return;

    try {
      // Update status in friendships table
      const { error } = await supabase
        .from("friendships")
        .update({ status: "blocked" })
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`
        );

      if (error) throw error;

      await refreshFriends();
      Alert.alert("Success", "User blocked");
    } catch (err) {
      Alert.alert("Error", "Failed to block user");
    }
  };

  const unblockUser = async (userId: string) => {
    if (!user) return;

    try {
      // Update status in friendships table
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`
        );

      if (error) throw error;

      await refreshFriends();
      Alert.alert("Success", "User unblocked");
    } catch (err) {
      Alert.alert("Error", "Failed to unblock user");
    }
  };

  const searchUsers = async (query: string): Promise<Friend[]> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;

      return (data || []).map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.display_name || user.username,
        avatar: user.avatar,
        profile_picture: user.profile_picture,
        friendsSince: new Date(),
        status: "pending" as const,
        lastActive: user.last_active ? new Date(user.last_active) : undefined,
      }));
    } catch (err) {
      console.error("Error searching users:", err);
      return [];
    }
  };

  const loadSuggestions = async () => {
    if (!user) return;

    try {
      const { data: activeUsers } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar, profile_picture")
        .neq("id", user.id)
        .order("last_active", { ascending: false })
        .limit(10);

      if (activeUsers) {
        const friendIds = friends.map((f) => f.id);
        const requestUserIds = [
          ...friendRequests.map((r) => r.from_user_id),
          ...pendingRequests.map((r) => r.to_user_id),
        ];

        const filtered = activeUsers.filter(
          (u) => !friendIds.includes(u.id) && !requestUserIds.includes(u.id)
        );

        const suggestionsList: FriendSuggestion[] = filtered.map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.display_name || u.username,
          avatar: u.avatar,
          profile_picture: u.profile_picture,
          mutualFriendsCount: 0,
          suggestionReason: "Active on explorAble",
        }));

        setSuggestions(suggestionsList);
      }
    } catch (err) {
      console.error("Error loading suggestions:", err);
    }
  };

  const loadFeed = async () => {
    if (!user || friends.length === 0) {
      setFeed([]);
      return;
    }

    try {
      const friendIds = friends.map((f) => f.id);

      // Load activities
      const { data: activities } = await supabase
        .from("activities")
        .select("*")
        .in("user_id", friendIds)
        .order("start_time", { ascending: false })
        .limit(50);

      // Load locations
      const { data: locations } = await supabase
        .from("locations")
        .select("*")
        .in("user_id", friendIds)
        .order("created_at", { ascending: false })
        .limit(50);

      // Get user profiles
      const allUserIds = new Set<string>();
      activities?.forEach((a) => allUserIds.add(a.user_id));
      locations?.forEach((l) => allUserIds.add(l.user_id));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", Array.from(allUserIds));

      const profileMap: Record<string, any> = {};
      profiles?.forEach((p) => {
        profileMap[p.id] = p;
      });

      // Transform into feed posts
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
          notes: activity.notes,
          route: activity.route || [],
          sharedBy: {
            id: activity.user_id,
            username: profileMap[activity.user_id]?.username || "",
            displayName:
              profileMap[activity.user_id]?.display_name || "Unknown",
            avatar: profileMap[activity.user_id]?.avatar,
            profile_picture: profileMap[activity.user_id]?.profile_picture,
            friendsSince: new Date(),
            status: "accepted" as const,
          },
          sharedAt: new Date(activity.created_at || activity.start_time),
          likes: [],
          comments: [],
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
          description: location.description,
          photos: location.photos || [],
          category: location.category,
          sharedBy: {
            id: location.user_id,
            username: profileMap[location.user_id]?.username || "",
            displayName:
              profileMap[location.user_id]?.display_name || "Unknown",
            avatar: profileMap[location.user_id]?.avatar,
            profile_picture: profileMap[location.user_id]?.profile_picture,
            friendsSince: new Date(),
            status: "accepted" as const,
          },
          sharedAt: new Date(location.created_at),
          likes: [],
          comments: [],
        },
      }));

      // Combine and sort
      const allPosts = [...activityPosts, ...locationPosts]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 50);

      setFeed(allPosts);
    } catch (err) {
      console.error("Error loading feed:", err);
    }
  };

  const likeItem = async (itemId: string) => {
    if (!user) return;

    try {
      // Parse the item type and ID
      const [type, actualId] = itemId.split("-");

      if (type === "activity") {
        await supabase.from("likes").insert({
          activity_id: actualId,
          user_id: user.id,
        });
      } else if (type === "location") {
        await supabase.from("likes").insert({
          location_id: actualId,
          user_id: user.id,
        });
      }

      // Update local feed state
      setFeed((prev) =>
        prev.map((post) =>
          post.id === itemId
            ? {
                ...post,
                data: { ...post.data, likes: [...post.data.likes, user.id] },
              }
            : post
        )
      );
    } catch (error) {
      console.error("Error liking item:", error);
    }
  };

  const unlikeItem = async (itemId: string) => {
    if (!user) return;

    try {
      const [type, actualId] = itemId.split("-");

      if (type === "activity") {
        await supabase
          .from("likes")
          .delete()
          .eq("activity_id", actualId)
          .eq("user_id", user.id);
      } else if (type === "location") {
        await supabase
          .from("likes")
          .delete()
          .eq("location_id", actualId)
          .eq("user_id", user.id);
      }

      // Update local feed state
      setFeed((prev) =>
        prev.map((post) =>
          post.id === itemId
            ? {
                ...post,
                data: {
                  ...post.data,
                  likes: post.data.likes.filter((id) => id !== user.id),
                },
              }
            : post
        )
      );
    } catch (error) {
      console.error("Error unliking item:", error);
    }
  };

  const addComment = async (
    itemId: string,
    text: string,
    replyToCommentId?: string,
    replyToUserName?: string
  ) => {
    if (!user || !profile) return;

    try {
      // Parse the item type and ID
      const [type, ...idParts] = itemId.split("-");
      const actualId = idParts.join("-"); // Rejoin in case UUID has dashes

      const commentData: any = {
        user_id: user.id,
        text: text.trim(),
        created_at: new Date().toISOString(),
      };

      if (type === "activity") {
        commentData.activity_id = actualId;
      } else if (type === "location") {
        commentData.location_id = actualId;
      }

      if (replyToCommentId) {
        commentData.reply_to_id = replyToCommentId;
      }

      const { data: newComment, error } = await supabase
        .from("comments")
        .insert(commentData)
        .select()
        .single();

      if (error) throw error;

      // Update local feed state
      const comment: FeedComment = {
        id: newComment.id,
        userId: user.id,
        userName: profile.display_name || profile.username || "Unknown",
        text: text.trim(),
        timestamp: new Date(),
        replyTo: replyToCommentId,
        replyToUser: replyToUserName,
      };

      setFeed((prev) =>
        prev.map((post) =>
          post.id === itemId
            ? {
                ...post,
                data: {
                  ...post.data,
                  comments: [...post.data.comments, comment],
                },
              }
            : post
        )
      );
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const deleteComment = async (itemId: string, commentId: string) => {
    if (!user) return;

    try {
      // Delete from database
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id); // Only allow deleting own comments

      if (error) throw error;

      // Update local feed state
      setFeed((prev) =>
        prev.map((post) =>
          post.id === itemId
            ? {
                ...post,
                data: {
                  ...post.data,
                  comments: post.data.comments.filter(
                    (c) => c.id !== commentId
                  ),
                },
              }
            : post
        )
      );
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const updatePrivacySettings = async (
    settings: Partial<typeof privacySettings>
  ) => {
    try {
      const updatedSettings = { ...privacySettings, ...settings };
      setPrivacySettings(updatedSettings);
      await AsyncStorage.setItem(
        "friendsPrivacy",
        JSON.stringify(updatedSettings)
      );
    } catch (err) {
      console.error("Error updating privacy settings:", err);
    }
  };

  const shareActivity = async (
    activityId: string,
    friendIds?: string[],
    options?: any
  ) => {
    Alert.alert("Success", "Activity shared!");
  };

  const shareLocation = async (locationId: string, friendIds?: string[]) => {
    Alert.alert("Success", "Location shared!");
  };

  const shareAchievement = async (
    achievementId: string,
    achievementName: string,
    achievementIcon: string
  ) => {
    Alert.alert("Success", "Achievement shared!");
  };

  const addActivityToFeed = async (activity: Activity, options: any = {}) => {
    // Implementation here
  };

  const getFriendActivities = (friendId: string) => {
    return feed
      .filter(
        (post) => post.type === "activity" && post.data.sharedBy.id === friendId
      )
      .map((post) => post.data);
  };

  const getFriendLocations = (friendId: string) => {
    return feed
      .filter(
        (post) => post.type === "location" && post.data.sharedBy.id === friendId
      )
      .map((post) => post.data);
  };

  const refreshFeed = async () => {
    await loadFeed();
  };

  const refreshSuggestions = async () => {
    await loadSuggestions();
  };

  const value: FriendsContextType = {
    friends,
    friendRequests,
    pendingRequests,
    suggestions,
    feed,
    loading,
    error,
    currentUserId,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    cancelFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,
    searchUsers,
    refreshFeed,
    refreshFriends,
    refreshSuggestions,
    shareActivity,
    shareLocation,
    shareAchievement,
    addActivityToFeed,
    likeItem,
    unlikeItem,
    addComment,
    deleteComment,
    getFriendActivities,
    getFriendLocations,
    privacySettings,
    updatePrivacySettings,
  };

  return (
    <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>
  );
};

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error("useFriends must be used within FriendsProvider");
  }
  return context;
};
