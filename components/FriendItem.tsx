import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../constants/theme";
import { Friend } from "../contexts/FriendsContext";
import { UserAvatar } from "./UserAvatar";

interface FriendItemProps {
  friend: Friend;
  onPress: () => void;
  onOptions: () => void;
}

const getLastActiveText = (lastActive?: Date) => {
  if (!lastActive) return "Offline";

  const now = new Date();
  const diff = now.getTime() - lastActive.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 5) return "Online now";
  if (hours < 1) return `${minutes}m ago`;
  if (days < 1) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
};

export function FriendItem({ friend, onPress, onOptions }: FriendItemProps) {
  const isOnline =
    friend.lastActive &&
    new Date().getTime() - friend.lastActive.getTime() < 300000;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.avatarContainer}>
        <UserAvatar user={friend} size={50} />
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.info}>
        <Text style={styles.name}>{friend.displayName}</Text>
        <Text style={styles.username}>@{friend.username}</Text>
        <Text style={styles.lastActive}>
          {getLastActiveText(friend.lastActive)}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.moreButton}
        onPress={onOptions}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.gray} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    marginRight: 12,
    position: "relative",
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
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  username: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
  },
  lastActive: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 2,
  },
  moreButton: {
    padding: 5,
  },
});