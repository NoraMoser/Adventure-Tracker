// components/PrivacySettingsModal.tsx

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../constants/theme";
import { Friend } from "../contexts/FriendsContext";

interface PrivacySettings {
  shareMyActivities: boolean;
  shareMyLocations: boolean;
  shareMyRoute: boolean;
  shareMyStats: boolean;
  allowViewMyFriends: boolean;
}

interface PrivacySettingsModalProps {
  visible: boolean;
  onClose: () => void;
  friend: Friend;
  settings: Partial<PrivacySettings>;
  onUpdateSettings: (settings: PrivacySettings) => void;
}

export function PrivacySettingsModal({
  visible,
  onClose,
  friend,
  settings,
  onUpdateSettings,
}: PrivacySettingsModalProps) {
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    shareMyActivities: settings?.shareMyActivities ?? true,
    shareMyLocations: settings?.shareMyLocations ?? true,
    shareMyRoute: settings?.shareMyRoute ?? false,
    shareMyStats: settings?.shareMyStats ?? true,
    allowViewMyFriends: settings?.allowViewMyFriends ?? true,
  });

  const handleSave = () => {
    onUpdateSettings(privacySettings);
    onClose();
  };

  const updateSetting = (key: keyof PrivacySettings, value: boolean) => {
    setPrivacySettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Privacy Settings</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Control what {friend.displayName} can see
          </Text>

          <View style={styles.settingsList}>
            <SettingItem
              label="Share My Activities"
              description="They can see your activity summaries"
              value={privacySettings.shareMyActivities}
              onValueChange={(v) => updateSetting("shareMyActivities", v)}
            />

            <SettingItem
              label="Share My Locations"
              description="They can see places you have saved"
              value={privacySettings.shareMyLocations}
              onValueChange={(v) => updateSetting("shareMyLocations", v)}
            />

            <SettingItem
              label="Share Exact Routes"
              description="Show detailed route paths on activities"
              value={privacySettings.shareMyRoute}
              onValueChange={(v) => updateSetting("shareMyRoute", v)}
            />

            <SettingItem
              label="Share Statistics"
              description="They can see your achievement stats"
              value={privacySettings.shareMyStats}
              onValueChange={(v) => updateSetting("shareMyStats", v)}
            />

            <SettingItem
              label="Show My Friends List"
              description="They can see who else you are friends with"
              value={privacySettings.allowViewMyFriends}
              onValueChange={(v) => updateSetting("allowViewMyFriends", v)}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveText}>Save Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Sub-component for setting items
function SettingItem({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: theme.colors.borderGray,
          true: theme.colors.forest,
        }}
      />
    </View>
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
    maxHeight: "80%",
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
  subtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
    marginTop: 15,
    marginHorizontal: 20,
  },
  settingsList: {
    padding: 20,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  actions: {
    flexDirection: "row",
    padding: 20,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
  },
  cancelText: {
    fontSize: 16,
    color: theme.colors.gray,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: theme.colors.forest,
  },
  saveText: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
  },
});