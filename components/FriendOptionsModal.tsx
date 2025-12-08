// components/FriendOptionsModal.tsx

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../constants/theme";

interface FriendOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onPrivacySettings: () => void;
  onRemoveFriend: () => void;
  onBlockUser: () => void;
}

export function FriendOptionsModal({
  visible,
  onClose,
  onPrivacySettings,
  onRemoveFriend,
  onBlockUser,
}: FriendOptionsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modal}>
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              onClose();
              onPrivacySettings();
            }}
          >
            <Ionicons
              name="shield-checkmark"
              size={22}
              color={theme.colors.forest}
            />
            <Text style={styles.optionText}>Privacy Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              onClose();
              onRemoveFriend();
            }}
          >
            <Ionicons
              name="person-remove"
              size={22}
              color={theme.colors.burntOrange}
            />
            <Text style={styles.optionText}>Remove Friend</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionItem, styles.optionDanger]}
            onPress={() => {
              onClose();
              onBlockUser();
            }}
          >
            <Ionicons name="ban" size={22} color="#FF4757" />
            <Text style={[styles.optionText, { color: "#FF4757" }]}>
              Block User
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionItem, styles.optionCancel]}
            onPress={onClose}
          >
            <Text style={styles.optionCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  optionText: {
    fontSize: 16,
    color: theme.colors.navy,
    marginLeft: 15,
  },
  optionDanger: {
    borderBottomWidth: 0,
  },
  optionCancel: {
    justifyContent: "center",
    borderBottomWidth: 0,
    marginTop: 10,
  },
  optionCancelText: {
    fontSize: 16,
    color: theme.colors.gray,
    fontWeight: "600",
  },
});