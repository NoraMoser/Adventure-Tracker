import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../constants/theme";
import { FriendRequest } from "../contexts/FriendsContext";
import { UserAvatar } from "./UserAvatar";

interface FriendRequestItemProps {
  request: FriendRequest;
  type: "incoming" | "outgoing";
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}

export function FriendRequestItem({
  request,
  type,
  onAccept,
  onDecline,
  onCancel,
}: FriendRequestItemProps) {
  let user: any = null;
  let displayName = "";
  let username = "";

  if (type === "incoming") {
    if (request.from) {
      user = request.from;
      displayName = user.displayName;
      username = user.username;
    } else if (request.from_user) {
      user = request.from_user;
      displayName = user.displayName || user.display_name || "Unknown";
      username = user.username;
    }
  } else {
    username = request.to || "Unknown";
    displayName = username;
  }

  const sentAt =
    request.sentAt ||
    (request.sent_at ? new Date(request.sent_at) : new Date());

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <UserAvatar user={user} size={45} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.username}>@{username}</Text>
          <Text style={styles.time}>{sentAt.toLocaleDateString()}</Text>
        </View>
      </View>

      {request.message && (
        <Text style={styles.message}>&quot;{request.message}&quot;</Text>
      )}

      <View style={styles.actions}>
        {type === "incoming" ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={onAccept}
            >
              <Ionicons name="checkmark" size={18} color="white" />
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={onDecline}
            >
              <Ionicons name="close" size={18} color={theme.colors.gray} />
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={onCancel}
          >
            <Text style={styles.cancelText}>Cancel Request</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    marginBottom: 10,
  },
  avatarContainer: {
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  username: {
    fontSize: 13,
    color: theme.colors.gray,
    marginTop: 2,
  },
  time: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 2,
  },
  message: {
    fontSize: 14,
    color: theme.colors.gray,
    fontStyle: "italic",
    marginBottom: 12,
    paddingLeft: 57,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  acceptButton: {
    backgroundColor: theme.colors.forest,
  },
  acceptText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 5,
  },
  declineButton: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  declineText: {
    color: theme.colors.gray,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 5,
  },
  cancelButton: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  cancelText: {
    color: theme.colors.gray,
    fontSize: 14,
    fontWeight: "600",
  },
});