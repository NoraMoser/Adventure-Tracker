import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../constants/theme";
import { FriendSuggestion } from "../contexts/FriendsContext";
import { UserAvatar } from "./UserAvatar";

interface SuggestionCardProps {
  suggestion: FriendSuggestion;
  onAddFriend: () => void;
}

export function SuggestionCard({ suggestion, onAddFriend }: SuggestionCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <UserAvatar user={suggestion} size={50} />
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {suggestion.displayName}
      </Text>
      <Text style={styles.username} numberOfLines={1}>
        @{suggestion.username}
      </Text>
      <Text style={styles.reason} numberOfLines={2}>
        {suggestion.suggestionReason}
      </Text>

      <TouchableOpacity style={styles.addButton} onPress={onAddFriend}>
        <Ionicons name="person-add" size={16} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 5,
    width: 140,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    marginBottom: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
    textAlign: "center",
  },
  username: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  reason: {
    fontSize: 11,
    color: theme.colors.forest,
    marginTop: 5,
    textAlign: "center",
  },
  addButton: {
    backgroundColor: theme.colors.forest,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
});