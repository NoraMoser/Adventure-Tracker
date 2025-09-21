// app/notifications.tsx - Fixed type issues
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../constants/theme";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

// Define Notification interface with proper types
interface Notification {
  id: string;
  type:
    | "friend_request"
    | "friend_accepted"
    | "activity_shared"
    | "location_shared"
    | "achievement"
    | "comment"
    | "like"
    | "trip_shared";

  title: string;
  message: string;
  from_user?: {
    id: string;
    username: string;
    display_name: string;
    avatar?: string;
    profile_picture?: string;
  };
  data?: any;
  read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadNotifications();
      setupRealtimeSubscription();
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load notifications WITHOUT the foreign key relationship
      const { data: dbNotifs, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading notifications:", error);
        return;
      }

      if (dbNotifs && dbNotifs.length > 0) {
        // Get unique from_user_ids
        const userIds = [
          ...new Set(
            dbNotifs.filter((n) => n.from_user_id).map((n) => n.from_user_id)
          ),
        ];

        // Load user profiles separately
        let userProfiles: Record<string, any> = {};
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar, profile_picture")
            .in("id", userIds);

          if (profiles) {
            profiles.forEach((profile) => {
              userProfiles[profile.id] = profile;
            });
          }
        }

        // Transform notifications with user data
        const transformedNotifs: Notification[] = dbNotifs.map((notif) => ({
          id: notif.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          from_user:
            notif.from_user_id && userProfiles[notif.from_user_id]
              ? {
                  id: notif.from_user_id,
                  username: userProfiles[notif.from_user_id].username,
                  display_name: userProfiles[notif.from_user_id].display_name,
                  avatar: userProfiles[notif.from_user_id].avatar || undefined,
                  profile_picture:
                    userProfiles[notif.from_user_id].profile_picture ||
                    undefined,
                }
              : undefined,
          data: notif.data,
          read: notif.read || false,
          created_at: notif.created_at,
        }));

        setNotifications(transformedNotifs);
      } else {
        // No notifications found - just set empty array
        setNotifications([]);
      }
    } catch (err) {
      console.error("Error in loadNotifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return;

    const subscription = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("New notification:", payload);
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // Update in database
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      // Update in database
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      // Update local state
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);

    // Check the notification data for activity_id, location_id, or trip_id
    if (notification.data) {
      if (notification.data.activity_id) {
        router.push(`/activity/${notification.data.activity_id}` as any);
        return;
      } else if (notification.data.location_id) {
        router.push(`/location/${notification.data.location_id}` as any);
        return;
      } else if (notification.data.trip_id) {
        // Navigate to specific trip
        router.push(`/trip-detail?tripId=${notification.data.trip_id}` as any);
        return;
      }
    }

    // Fallback navigation based on type
    switch (notification.type) {
      case "friend_request":
        router.push("/friend-requests");
        break;
      case "friend_accepted":
        if (notification.from_user) {
          router.push(`/friend-profile/${notification.from_user.id}` as any);
        }
        break;
      case "activity_shared":
      case "location_shared":
      case "comment":
      case "like":
        router.push("/friends-feed");
        break;
      case "trip_shared":
        router.push("/trips");
        break;
      case "achievement":
        router.push("/achievements");
        break;
    }
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    const icons = {
      friend_request: "person-add",
      friend_accepted: "people",
      activity_shared: "fitness",
      location_shared: "location",
      achievement: "trophy",
      comment: "chatbubble",
      like: "heart",
      trip_shared: "airplane",
    };
    return icons[type] || "notifications";
  };

  const getNotificationColor = (type: Notification["type"]) => {
    const colors = {
      friend_request: theme.colors.forest,
      friend_accepted: theme.colors.forest,
      activity_shared: theme.colors.navy,
      location_shared: theme.colors.burntOrange,
      achievement: "#FFD700",
      comment: theme.colors.navy,
      like: "#FF4757",
      trip_shared: theme.colors.navy,
    };
    return colors[type] || theme.colors.gray;
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diff = now.getTime() - notifDate.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: getNotificationColor(item.type) + "20" },
        ]}
      >
        <Ionicons
          name={getNotificationIcon(item.type) as any}
          size={24}
          color={getNotificationColor(item.type)}
        />
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.time}>{getTimeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.message}>{item.message}</Text>

        {/* Show the actual comment text if it's a comment notification */}
        {item.type === "comment" && item.data?.comment_text && (
          <View style={styles.commentPreview}>
            <Text style={styles.commentText}>
              &quot;{item.data.comment_text}&quot;
            </Text>
          </View>
        )}

        {item.from_user && (
          <View style={styles.fromUser}>
            <Text style={styles.fromUserAvatar}>
              {item.from_user.avatar || "👤"}
            </Text>
            <Text style={styles.fromUserName}>@{item.from_user.username}</Text>
          </View>
        )}
      </View>

      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="notifications-off-outline"
        size={80}
        color={theme.colors.lightGray}
      />
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyText}>
        You are all caught up! Check back later for updates.
      </Text>
    </View>
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Notifications",
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          headerRight: () =>
            unreadCount > 0 ? (
              <TouchableOpacity
                style={styles.headerButton}
                onPress={markAllAsRead}
              >
                <Text style={styles.headerButtonText}>Mark all read</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadText}>
            {unreadCount} unread{" "}
            {unreadCount === 1 ? "notification" : "notifications"}
          </Text>
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          notifications.length === 0
            ? styles.emptyContainer
            : styles.listContainer
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  headerButton: {
    marginRight: 15,
  },
  headerButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  unreadBanner: {
    backgroundColor: theme.colors.forest + "15",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.forest + "30",
  },
  unreadText: {
    color: theme.colors.forest,
    fontSize: 14,
    fontWeight: "500",
  },
  listContainer: {
    padding: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
  },
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    position: "relative",
  },
  unreadCard: {
    backgroundColor: theme.colors.forest + "05",
    borderWidth: 1,
    borderColor: theme.colors.forest + "20",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  time: {
    fontSize: 12,
    color: theme.colors.lightGray,
  },
  message: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: 8,
  },
  fromUser: {
    flexDirection: "row",
    alignItems: "center",
  },
  fromUserAvatar: {
    fontSize: 16,
    marginRight: 6,
  },
  fromUserName: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  unreadDot: {
    position: "absolute",
    top: 15,
    right: 15,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.forest,
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
    textAlign: "center",
  },
  commentPreview: {
    backgroundColor: theme.colors.offWhite,
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  commentText: {
    fontSize: 14,
    color: theme.colors.navy,
    fontStyle: "italic",
  },
});
