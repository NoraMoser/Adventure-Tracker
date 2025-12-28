import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../constants/theme";

interface AddFriendModalProps {
  visible: boolean;
  onClose: () => void;
  onSendRequest: (username: string, message?: string) => void;
}

export function AddFriendModal({
  visible,
  onClose,
  onSendRequest,
}: AddFriendModalProps) {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");

  const handleSend = () => {
    onSendRequest(username, message || undefined);
    setUsername("");
    setMessage("");
  };

  const handleClose = () => {
    setUsername("");
    setMessage("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Friend</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={theme.colors.lightGray}
          />

          <Text style={styles.label}>Message (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add a personal message..."
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={3}
            placeholderTextColor={theme.colors.lightGray}
          />

          <TouchableOpacity
            style={[styles.button, !username.trim() && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={!username.trim()}
          >
            <Text style={styles.buttonText}>Send Friend Request</Text>
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
    padding: 20,
  },
  content: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.gray,
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: theme.colors.navy,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: theme.colors.forest,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.lightGray,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});