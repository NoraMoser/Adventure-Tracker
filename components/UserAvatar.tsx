// components/UserAvatar.tsx

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

interface UserAvatarProps {
  user: {
    profile_picture?: string;
    avatar?: string;
  } | null;
  size?: number;
  style?: any;
}

export function UserAvatar({ user, size = 40, style = {} }: UserAvatarProps) {
  if (user?.profile_picture) {
    return (
      <Image
        source={{ uri: user.profile_picture }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "#f0f0f0",
          },
          style,
        ]}
        onError={(e) => {
          console.log("Error loading profile picture:", e.nativeEvent.error);
        }}
      />
    );
  }

  if (user?.avatar) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "white",
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 1,
            borderColor: theme.colors.borderGray,
          },
          style,
        ]}
      >
        <Text style={{ fontSize: size * 0.6 }}>{user.avatar}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.lightGray + "30",
          justifyContent: "center",
          alignItems: "center",
        },
        style,
      ]}
    >
      <Ionicons name="person" size={size * 0.6} color={theme.colors.gray} />
    </View>
  );
}