// components/FriendOptionsModal.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../constants/theme";
import { Friend } from "../contexts/FriendsContext";
import { UserAvatar } from "./UserAvatar";

interface FriendOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  // Optional friend for header display (used in friends list)
  friend?: Friend | null;
  // Action handlers - all optional to support different contexts
  onViewProfile?: () => void;
  onPrivacySettings?: () => void;
  onUnfriend?: () => void;
  onRemoveFriend?: () => void;
  onBlock?: () => void;
  onBlockUser?: () => void;
}

export function FriendOptionsModal({
  visible,
  onClose,
  friend,
  onViewProfile,
  onPrivacySettings,
  onUnfriend,
  onRemoveFriend,
  onBlock,
  onBlockUser,
}: FriendOptionsModalProps) {
  // Normalize handlers (support both naming conventions)
  const handleUnfriend = onUnfriend || onRemoveFriend;
  const handleBlock = onBlock || onBlockUser;

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
            {friend ? (
              <View style={styles.headerInfo}>
                <UserAvatar user={friend} size={32} style={{ marginRight: 12 }} />
                <View>
                  <Text style={styles.name}>{friend.displayName}</Text>
                  <Text style={styles.username}>@{friend.username}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.headerTitle}>Options</Text>
            )}
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <View style={styles.options}>
            {onViewProfile && (
              <TouchableOpacity style={styles.option} onPress={onViewProfile}>
                <Ionicons name="person-outline" size={24} color={theme.colors.navy} />
                <Text style={styles.optionText}>View Profile</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.lightGray} />
              </TouchableOpacity>
            )}

            {onPrivacySettings && (
              <TouchableOpacity style={styles.option} onPress={onPrivacySettings}>
                <Ionicons name="shield-checkmark-outline" size={24} color={theme.colors.forest} />
                <Text style={styles.optionText}>Privacy Settings</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.lightGray} />
              </TouchableOpacity>
            )}

            {handleUnfriend && (
              <TouchableOpacity style={styles.option} onPress={handleUnfriend}>
                <Ionicons name="person-remove-outline" size={24} color={theme.colors.burntOrange} />
                <Text style={[styles.optionText, { color: theme.colors.burntOrange }]}>
                  Remove Friend
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.lightGray} />
              </TouchableOpacity>
            )}

            {handleBlock && (
              <TouchableOpacity style={[styles.option, styles.dangerOption]} onPress={handleBlock}>
                <Ionicons name="ban-outline" size={24} color="#FF4757" />
                <Text style={[styles.optionText, { color: "#FF4757" }]}>Block User</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.lightGray} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.warning}>
            Blocking will remove this person from your friends and prevent them from sending you requests.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  username: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
  },
  options: {
    padding: 20,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  dangerOption: {
    borderBottomWidth: 0,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.navy,
    marginLeft: 15,
  },
  warning: {
    fontSize: 12,
    color: theme.colors.lightGray,
    textAlign: "center",
    marginHorizontal: 20,
    marginTop: 10,
  },
});