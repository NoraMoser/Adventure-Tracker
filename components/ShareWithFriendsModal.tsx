import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../constants/theme";
import { useFriends } from "../contexts/FriendsContext";

interface ShareWithFriendsModalProps {
  visible: boolean;
  onClose: () => void;
  item: any;
  itemType: "activity" | "location" | "trip";
  onShare: (selectedFriends: string[], message?: string) => void;
  formatDistance?: (meters: number) => string;
}

export function ShareWithFriendsModal({
  visible,
  onClose,
  item,
  itemType,
  onShare,
  formatDistance,
}: ShareWithFriendsModalProps) {
  const { friends } = useFriends();
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [shareMessage, setShareMessage] = useState("");
  const [shareToAll, setShareToAll] = useState(false);

  const toggleFriend = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter((id) => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  const handleShare = () => {
    const friendsToShare = shareToAll
      ? friends.filter((f) => f.status === "accepted").map((f) => f.id)
      : selectedFriends;
    if (friendsToShare.length === 0) {
      Alert.alert(
        "Select Friends",
        "Please select at least one friend to share with"
      );
      return;
    }
    onShare(friendsToShare, shareMessage);
    // Reset state
    setSelectedFriends([]);
    setShareMessage("");
    setShareToAll(false);
    onClose();
  };

  const handleClose = () => {
    setSelectedFriends([]);
    setShareMessage("");
    setShareToAll(false);
    onClose();
  };

  const renderPreview = () => {
    if (itemType === "activity") {
      return (
        <View style={styles.itemPreview}>
          <Text style={styles.previewTitle}>{item?.name}</Text>
          <View style={styles.previewStats}>
            <Text style={styles.previewStat}>
              <Ionicons name="navigate" size={14} />{" "}
              {formatDistance ? formatDistance(item?.distance || 0) : `${item?.distance || 0}m`}
            </Text>
            <Text style={styles.previewStat}>
              <Ionicons name="time" size={14} />{" "}
              {Math.round((item?.duration || 0) / 60)} min
            </Text>
          </View>
        </View>
      );
    }

    if (itemType === "location") {
      return (
        <View style={styles.itemPreview}>
          <Text style={styles.previewTitle}>{item?.name}</Text>
          {item?.category && (
            <Text style={styles.previewStat}>{item.category}</Text>
          )}
        </View>
      );
    }

    if (itemType === "trip") {
      return (
        <View style={styles.itemPreview}>
          <Text style={styles.previewTitle}>{item?.name}</Text>
          {item?.start_date && (
            <Text style={styles.previewStat}>
              {new Date(item.start_date).toLocaleDateString()}
            </Text>
          )}
        </View>
      );
    }

    return null;
  };

  const acceptedFriends = friends.filter((f) => f.status === "accepted");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Share {itemType.charAt(0).toUpperCase() + itemType.slice(1)}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          {renderPreview()}

          <TextInput
            style={styles.shareMessageInput}
            placeholder="Add a message (optional)..."
            value={shareMessage}
            onChangeText={setShareMessage}
            multiline
            numberOfLines={3}
            placeholderTextColor={theme.colors.lightGray}
          />

          <View style={styles.shareToAllContainer}>
            <Text style={styles.shareToAllText}>Share with all friends</Text>
            <Switch
              value={shareToAll}
              onValueChange={setShareToAll}
              trackColor={{
                false: theme.colors.borderGray,
                true: theme.colors.forest,
              }}
              thumbColor={
                shareToAll ? theme.colors.white : theme.colors.lightGray
              }
            />
          </View>

          {!shareToAll && (
            <ScrollView style={styles.friendsList}>
              <Text style={styles.friendsListTitle}>Select Friends:</Text>
              {acceptedFriends.map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  style={styles.friendItem}
                  onPress={() => toggleFriend(friend.id)}
                >
                  <View style={styles.friendInfo}>
                    <View style={styles.friendAvatar}>
                      <Text>{friend.avatar || "👤"}</Text>
                    </View>
                    <Text style={styles.friendName}>{friend.displayName}</Text>
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
              ))}
              {acceptedFriends.length === 0 && (
                <Text style={styles.noFriendsText}>
                  No friends to share with yet
                </Text>
              )}
            </ScrollView>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-social" size={20} color="white" />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  itemPreview: {
    backgroundColor: theme.colors.offWhite,
    margin: 20,
    padding: 15,
    borderRadius: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  previewStats: {
    flexDirection: "row",
    gap: 15,
  },
  previewStat: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  shareMessageInput: {
    backgroundColor: theme.colors.offWhite,
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    color: theme.colors.navy,
    minHeight: 80,
    textAlignVertical: "top",
  },
  shareToAllContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
  },
  shareToAllText: {
    fontSize: 16,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  friendsList: {
    maxHeight: 200,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  friendsListTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
    marginBottom: 10,
  },
  friendItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  friendInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  friendName: {
    fontSize: 14,
    color: theme.colors.navy,
  },
  noFriendsText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
    paddingVertical: 20,
  },
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
  },
  cancelButtonText: {
    fontSize: 16,
    color: theme.colors.gray,
    fontWeight: "600",
  },
  shareButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: theme.colors.forest,
  },
  shareButtonText: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
});