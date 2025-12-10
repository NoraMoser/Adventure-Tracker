// components/FriendSelectionModal.tsx

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../constants/theme";

interface Friend {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  profile_picture?: string;
}

interface FriendSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  friends: Friend[];
  selectedFriends: string[];
  onToggleFriend: (friendId: string) => void;
  title?: string;
}

export function FriendSelectionModal({
  visible,
  onClose,
  friends,
  selectedFriends,
  onToggleFriend,
  title = "Tag Friends",
}: FriendSelectionModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.friendsList}>
            {friends.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No friends to tag</Text>
                <Text style={styles.emptySubtext}>
                  Add friends to share trips with them
                </Text>
              </View>
            ) : (
              friends.map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  style={styles.friendItem}
                  onPress={() => onToggleFriend(friend.id)}
                >
                  <View style={styles.friendInfo}>
                    {friend.profile_picture ? (
                      <Image
                        source={{ uri: friend.profile_picture }}
                        style={styles.friendAvatar}
                      />
                    ) : (
                      <View style={styles.friendAvatarPlaceholder}>
                        <Text>{friend.avatar || "👤"}</Text>
                      </View>
                    )}
                    <View style={styles.friendDetails}>
                      <Text style={styles.friendName}>
                        {friend.displayName || friend.username}
                      </Text>
                      <Text style={styles.friendUsername}>
                        @{friend.username}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={
                      selectedFriends.includes(friend.id)
                        ? "checkbox"
                        : "square-outline"
                    }
                    size={24}
                    color={
                      selectedFriends.includes(friend.id)
                        ? theme.colors.forest
                        : theme.colors.gray
                    }
                  />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
  },
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    maxHeight: "70%",
    marginHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  friendsList: {
    padding: 20,
    maxHeight: 400,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.gray,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.lightGray,
    textAlign: "center",
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray + "30",
  },
  friendInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  friendAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
  },
  friendUsername: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
  },
  doneButton: {
    backgroundColor: theme.colors.forest,
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  doneButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});