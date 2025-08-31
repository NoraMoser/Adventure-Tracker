// contexts/FriendsContext.tsx - Complete version with location comments/likes
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
import { Activity } from "./ActivityContext";
import { useAuth } from "./AuthContext";

// Type definitions
export interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  profile_picture?: string | null;
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
  replyTo?: string; // ID of comment being replied to
  replyToUser?: string; // Name of user being replied to
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
  const { user } = useAuth();
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

  // Load data when user changes
  useEffect(() => {
    if (currentUserId) {
      loadFriendsData();
      loadFeed();
    }
  }, [currentUserId]);

  useEffect(() => {
    // Add defensive check
    if (friends && friends.length > 0 && currentUserId) {
      loadFeed();
    }
  }, [friends?.length, currentUserId]);

  const loadFriendsData = async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);

      // Load accepted friends
      const { data: friendships, error: friendsError } = await supabase
        .from("friendships")
        .select(
          `
          *,
          friend:profiles!friendships_friend_id_fkey(
            id,
            username,
            display_name,
            avatar,
            profile_picture,
            last_active
          )
        `
        )
        .eq("user_id", currentUserId)
        .eq("status", "accepted");

      if (friendsError) throw friendsError;

      if (friendships && friendships.length > 0) {
        const transformedFriends = friendships
          .filter((f) => f.friend)
          .map((f) => ({
            id: f.friend.id,
            username: f.friend.username,
            displayName: f.friend.display_name,
            avatar: f.friend.avatar,
            profile_picture: f.friend.profile_picture,
            friendsSince: new Date(f.accepted_at || f.requested_at),
            status: "accepted" as const,
            lastActive: f.friend.last_active
              ? new Date(f.friend.last_active)
              : undefined,
          }));
        setFriends(transformedFriends);
      }

      // Load incoming friend requests
      const { data: requests, error: requestsError } = await supabase
        .from("friend_requests")
        .select(
          `
          *,
          from_user:profiles!friend_requests_from_user_id_fkey(
            id,
            username,
            display_name,
            avatar,
            profile_picture
          )
        `
        )
        .eq("to_user_id", currentUserId);

      if (requestsError) throw requestsError;

      if (requests && requests.length > 0) {
        const transformedRequests = requests
          .filter((r) => r.from_user)
          .map((r) => ({
            id: r.id,
            from_user_id: r.from_user_id,
            to_user_id: r.to_user_id,
            message: r.message,
            sent_at: r.sent_at,
            from_user: {
              id: r.from_user.id,
              username: r.from_user.username,
              displayName: r.from_user.display_name,
              avatar: r.from_user.avatar,
              profile_picture: r.from_user.profile_picture,
              friendsSince: new Date(),
              status: "pending" as const,
            },
            from: {
              id: r.from_user.id,
              username: r.from_user.username,
              displayName: r.from_user.display_name,
              avatar: r.from_user.avatar,
              profile_picture: r.from_user.profile_picture,
              friendsSince: new Date(),
              status: "pending" as const,
            },
            to: r.to_user_id,
            sentAt: new Date(r.sent_at),
          }));
        setFriendRequests(transformedRequests);
      }

      // Load sent friend requests
      const { data: sent, error: sentError } = await supabase
        .from("friend_requests")
        .select(
          `
          *,
          to_user:profiles!friend_requests_to_user_id_fkey(
            id,
            username,
            display_name,
            avatar,
            profile_picture
          )
        `
        )
        .eq("from_user_id", currentUserId);

      if (sentError) throw sentError;

      if (sent && sent.length > 0) {
        const transformedSent = sent.map((s) => ({
          id: s.id,
          from_user_id: s.from_user_id,
          to_user_id: s.to_user_id,
          message: s.message,
          sent_at: s.sent_at,
          to: s.to_user?.username || s.to_user_id,
          sentAt: new Date(s.sent_at),
        }));
        setPendingRequests(transformedSent);
      }

      await loadSuggestions();
    } catch (err) {
      console.error("Error loading friends data:", err);
      setError("Failed to load friends");
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    if (!currentUserId) return;

    try {
      const { data: activeUsers } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar, profile_picture")
        .neq("id", currentUserId)
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
          displayName: u.display_name,
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
    if (!currentUserId || friends.length === 0) {
      setFeed([]);
      return;
    }

    try {
      const friendIds = friends.map((f) => f.id);

      // Load activities
      const { data: activities, error: activitiesError } = await supabase
        .from("activities")
        .select(
          `
          *,
          user:profiles!activities_user_id_fkey(
            id,
            username,
            display_name,
            avatar,
            profile_picture
          )
        `
        )
        .in("user_id", friendIds)
        .order("start_time", { ascending: false })
        .limit(50);

      if (activitiesError) {
        console.error("Error loading activities:", activitiesError);
        return;
      }

      // Load locations
      const { data: locations, error: locationsError } = await supabase
        .from("locations")
        .select(
          `
          *,
          user:profiles!locations_user_id_fkey(
            id,
            username,
            display_name,
            avatar,
            profile_picture
          )
        `
        )
        .in("user_id", friendIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (locationsError) {
        console.error("Error loading locations:", locationsError);
      }

      // Maps for likes and comments
      let likesMap: Record<string, string[]> = {};
      let commentsMap: Record<string, FeedComment[]> = {};

      // Load activity likes and comments
      if (activities && activities.length > 0) {
        const activityIds = activities.map((a) => a.id);

        // Load activity likes
        const { data: activityLikes } = await supabase
          .from("likes")
          .select("activity_id, user_id")
          .in("activity_id", activityIds);

        if (activityLikes) {
          activityLikes.forEach((like) => {
            if (!likesMap[like.activity_id]) {
              likesMap[like.activity_id] = [];
            }
            likesMap[like.activity_id].push(like.user_id);
          });
        }

        // Load activity comments
        const { data: activityComments } = await supabase
          .from("comments")
          .select("id, activity_id, text, created_at, user_id")
          .in("activity_id", activityIds)
          .order("created_at", { ascending: true });

        if (activityComments && activityComments.length > 0) {
          const userIds = [...new Set(activityComments.map((c) => c.user_id))];

          const { data: userProfiles } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar")
            .in("id", userIds);

          const userMap: Record<string, any> = {};
          if (userProfiles) {
            userProfiles.forEach((profile) => {
              userMap[profile.id] = profile;
            });
          }

          activityComments.forEach((comment) => {
            if (!commentsMap[comment.activity_id]) {
              commentsMap[comment.activity_id] = [];
            }
            const user = userMap[comment.user_id];
            commentsMap[comment.activity_id].push({
              id: comment.id,
              userId: comment.user_id,
              userName: user?.display_name || user?.username || "Unknown",
              text: comment.text,
              timestamp: new Date(comment.created_at),
            });
          });
        }
      }

      // Load location likes and comments
      if (locations && locations.length > 0) {
        const locationIds = locations.map((l) => l.id);

        // Load location likes
        const { data: locationLikes } = await supabase
          .from("likes")
          .select("location_id, user_id")
          .in("location_id", locationIds);

        if (locationLikes) {
          locationLikes.forEach((like) => {
            if (!likesMap[like.location_id]) {
              likesMap[like.location_id] = [];
            }
            likesMap[like.location_id].push(like.user_id);
          });
        }

        // Load location comments
        const { data: locationComments } = await supabase
          .from("comments")
          .select("id, location_id, text, created_at, user_id")
          .in("location_id", locationIds)
          .order("created_at", { ascending: true });

        if (locationComments && locationComments.length > 0) {
          const userIds = [...new Set(locationComments.map((c) => c.user_id))];

          const { data: userProfiles } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar")
            .in("id", userIds);

          const userMap: Record<string, any> = {};
          if (userProfiles) {
            userProfiles.forEach((profile) => {
              userMap[profile.id] = profile;
            });
          }

          locationComments.forEach((comment) => {
            if (!commentsMap[comment.location_id]) {
              commentsMap[comment.location_id] = [];
            }
            const user = userMap[comment.user_id];
            commentsMap[comment.location_id].push({
              id: comment.id,
              userId: comment.user_id,
              userName: user?.display_name || user?.username || "Unknown",
              text: comment.text,
              timestamp: new Date(comment.created_at),
            });
          });
        }
      }

      // Transform activities into feed posts
      const activityPosts: FeedPost[] = (activities || [])
        .filter((activity) => activity.user)
        .map((activity) => ({
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
              id: activity.user.id,
              username: activity.user.username,
              displayName: activity.user.display_name || activity.user.username,
              avatar: activity.user.avatar,
              profile_picture: activity.user.profile_picture,
              friendsSince: new Date(),
              status: "accepted" as const,
            },
            sharedAt: new Date(activity.created_at || activity.start_time),
            likes: likesMap[activity.id] || [],
            comments: commentsMap[activity.id] || [],
          },
        }));

      // Transform locations into feed posts with real likes and comments
      const locationPosts: FeedPost[] = (locations || [])
        .filter((location) => location.user)
        .map((location) => ({
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
              id: location.user.id,
              username: location.user.username,
              displayName: location.user.display_name || location.user.username,
              avatar: location.user.avatar,
              profile_picture: location.user.profile_picture,
              friendsSince: new Date(),
              status: "accepted" as const,
            },
            sharedAt: new Date(location.created_at),
            likes: likesMap[location.id] || [],
            comments: commentsMap[location.id] || [],
          },
        }));

      // Combine and sort
      const allPosts = [...activityPosts, ...locationPosts]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 50);

      setFeed(allPosts);
      console.log(`Loaded ${allPosts.length} feed items`);
    } catch (err) {
      console.error("Error loading feed:", err);
    }
  };

  const sendFriendRequest = async (username: string, message?: string) => {
    if (!currentUserId) {
      Alert.alert("Error", "Please log in to send friend requests");
      return;
    }

    try {
      const cleanUsername = username.toLowerCase().trim();

      const { data: targetUser, error: userError } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("username", cleanUsername)
        .single();

      if (userError || !targetUser) {
        Alert.alert("Error", `User "${username}" not found`);
        return;
      }

      // Check if already friends
      const { data: existingFriendship } = await supabase
        .from("friendships")
        .select("id")
        .or(
          `and(user_id.eq.${currentUserId},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${currentUserId})`
        )
        .single();

      if (existingFriendship) {
        Alert.alert("Error", "You are already friends with this user");
        return;
      }

      // Check for existing request
      const { data: existingRequest } = await supabase
        .from("friend_requests")
        .select("id")
        .or(
          `and(from_user_id.eq.${currentUserId},to_user_id.eq.${targetUser.id}),and(from_user_id.eq.${targetUser.id},to_user_id.eq.${currentUserId})`
        )
        .single();

      if (existingRequest) {
        Alert.alert("Error", "A friend request already exists");
        return;
      }

      // Send the request
      const { error: requestError } = await supabase
        .from("friend_requests")
        .insert({
          from_user_id: currentUserId,
          to_user_id: targetUser.id,
          message,
          sent_at: new Date().toISOString(),
        });

      if (requestError) throw requestError;

      Alert.alert(
        "Success",
        `Friend request sent to ${targetUser.display_name}`
      );
      await loadFriendsData();
    } catch (err: any) {
      console.error("Error sending friend request:", err);
      Alert.alert("Error", "Failed to send friend request");
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    if (!currentUserId) return;

    try {
      const request = friendRequests.find((r) => r.id === requestId);
      if (!request) return;

      // Create friendship records
      const { error: friendshipError } = await supabase
        .from("friendships")
        .insert([
          {
            user_id: currentUserId,
            friend_id: request.from_user_id,
            status: "accepted",
            accepted_at: new Date().toISOString(),
          },
          {
            user_id: request.from_user_id,
            friend_id: currentUserId,
            status: "accepted",
            accepted_at: new Date().toISOString(),
          },
        ]);

      if (friendshipError) throw friendshipError;

      // Delete the request
      const { error: deleteError } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId);

      if (deleteError) throw deleteError;

      Alert.alert("Success", "Friend request accepted");
      await loadFriendsData();
    } catch (err) {
      console.error("Error accepting friend request:", err);
      Alert.alert("Error", "Failed to accept friend request");
    }
  };

  const declineFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;
      await loadFriendsData();
    } catch (err) {
      Alert.alert("Error", "Failed to decline friend request");
    }
  };

  const cancelFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;
      Alert.alert("Success", "Friend request cancelled");
      await loadFriendsData();
    } catch (err) {
      Alert.alert("Error", "Failed to cancel friend request");
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .or(
          `and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`
        );

      if (error) throw error;
      Alert.alert("Success", "Friend removed");
      await loadFriendsData();
    } catch (err) {
      Alert.alert("Error", "Failed to remove friend");
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
        displayName: user.display_name,
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

  const likeItem = async (itemId: string) => {
    try {
      const isActivity = itemId.startsWith("activity-");
      const isLocation = itemId.startsWith("location-");

      const actualId = itemId.replace("activity-", "").replace("location-", "");

      // Build query based on type
      let existingLikeQuery = supabase
        .from("likes")
        .select("id")
        .eq("user_id", currentUserId);

      if (isActivity) {
        existingLikeQuery = existingLikeQuery.eq("activity_id", actualId);
      } else if (isLocation) {
        existingLikeQuery = existingLikeQuery.eq("location_id", actualId);
      } else {
        return;
      }

      const { data: existingLike } = await existingLikeQuery.single();

      if (existingLike) {
        // Unlike
        await supabase.from("likes").delete().eq("id", existingLike.id);
      } else {
        // Like
        const insertData: any = {
          user_id: currentUserId,
        };

        if (isActivity) {
          insertData.activity_id = actualId;
        } else if (isLocation) {
          insertData.location_id = actualId;
        }

        await supabase.from("likes").insert(insertData);
      }

      // Update local state
      setFeed((prev) =>
        prev.map((post) => {
          if (post.id === itemId) {
            const likes = post.data.likes.includes(currentUserId)
              ? post.data.likes.filter((id) => id !== currentUserId)
              : [...post.data.likes, currentUserId];

            return {
              ...post,
              data: {
                ...post.data,
                likes,
              },
            };
          }
          return post;
        })
      );
    } catch (err) {
      console.error("Error liking item:", err);
    }
  };

  const unlikeItem = async (itemId: string) => {
    await likeItem(itemId);
  };

  // In FriendsContext.tsx, update the addComment function:
  const addComment = async (
    itemId: string,
    text: string,
    replyToCommentId?: string,
    replyToUserName?: string
  ) => {
    if (!text.trim()) return;

    try {
      const isActivity = itemId.startsWith("activity-");
      const isLocation = itemId.startsWith("location-");

      const actualId = itemId.replace("activity-", "").replace("location-", "");

      // Build insert data with reply_to field
      const insertData: any = {
        user_id: currentUserId,
        text: text.trim(),
        reply_to: replyToCommentId || null, // Add the reply_to field
      };

      if (isActivity) {
        insertData.activity_id = actualId;
      } else if (isLocation) {
        insertData.location_id = actualId;
      } else {
        return;
      }

      const { data: newComment, error } = await supabase
        .from("comments")
        .insert(insertData)
        .select("id, text, created_at, reply_to") // Include reply_to in select
        .single();

      if (error) throw error;

      // Get user profile
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", currentUserId)
        .single();

      // Update local state with reply info
      const comment: FeedComment = {
        id: newComment.id,
        userId: currentUserId,
        userName: userProfile?.display_name || userProfile?.username || "You",
        text: newComment.text,
        timestamp: new Date(newComment.created_at),
        replyTo: replyToCommentId,
        replyToUser: replyToUserName, // Include who we're replying to
      };

      setFeed((prev) =>
        prev.map((post) => {
          if (post.id === itemId) {
            return {
              ...post,
              data: {
                ...post.data,
                comments: [...post.data.comments, comment],
              },
            };
          }
          return post;
        })
      );
    } catch (error) {
      console.error("Error adding comment:", error);
      Alert.alert("Error", "Failed to add comment");
    }
  };

  const deleteComment = async (itemId: string, commentId: string) => {
    try {
      await supabase.from("comments").delete().eq("id", commentId);

      setFeed((prev) =>
        prev.map((post) => {
          if (post.id === itemId) {
            return {
              ...post,
              data: {
                ...post.data,
                comments: post.data.comments.filter((c) => c.id !== commentId),
              },
            };
          }
          return post;
        })
      );
    } catch (err) {
      console.error("Error deleting comment:", err);
    }
  };

  const blockUser = async (userId: string) => {
    try {
      if (!currentUserId) return;

      const { error } = await supabase
        .from("friendships")
        .update({ status: "blocked" })
        .eq("user_id", currentUserId)
        .eq("friend_id", userId);

      if (error) throw error;
      await loadFriendsData();
      Alert.alert("Success", "User blocked");
    } catch (err) {
      Alert.alert("Error", "Failed to block user");
    }
  };

  const unblockUser = async (userId: string) => {
    try {
      if (!currentUserId) return;

      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("user_id", currentUserId)
        .eq("friend_id", userId);

      if (error) throw error;
      await loadFriendsData();
      Alert.alert("Success", "User unblocked");
    } catch (err) {
      Alert.alert("Error", "Failed to unblock user");
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
    const newPost: FeedPost = {
      id: `post-${Date.now()}`,
      type: "activity",
      timestamp: new Date(),
      data: {
        ...activity,
        sharedBy: {
          id: currentUserId,
          username: "you",
          displayName: "You",
          avatar: "👤",
          friendsSince: new Date(),
          status: "accepted",
        },
        sharedAt: new Date(),
        likes: [],
        comments: [],
      },
    };

    setFeed((prev) => [newPost, ...prev]);
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

  const refreshFriends = async () => {
    await loadFriendsData();
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
