import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../constants/theme";

interface CommentInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  replyingTo?: string | null;
  onCancelReply?: () => void;
  placeholder?: string;
  inputRef?: React.RefObject<TextInput>;
}

export function CommentInput({
  value,
  onChangeText,
  onSubmit,
  submitting = false,
  replyingTo,
  onCancelReply,
  placeholder = "Add a comment...",
  inputRef,
}: CommentInputProps) {
  const isDisabled = !value.trim() || submitting;

  return (
    <View style={styles.container}>
      {replyingTo && onCancelReply && (
        <View style={styles.replyingToContainer}>
          <Text style={styles.replyingToText}>Replying...</Text>
          <TouchableOpacity onPress={onCancelReply}>
            <Ionicons name="close" size={20} color={theme.colors.gray} />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, isDisabled && styles.sendButtonDisabled]}
          onPress={onSubmit}
          disabled={isDisabled}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="send" size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
  },
  replyingToContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  replyingToText: {
    fontSize: 12,
    color: theme.colors.gray,
    fontStyle: "italic",
  },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    paddingTop: 8,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.forest,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.lightGray,
  },
});