// settings.tsx - Enhanced with full Export/Import functionality and Friends Settings
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
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
import { ActivityPickerModal } from "../components/ActivityPickerModal";
import { ExplorableIcon } from "../components/Logo";
import { theme } from "../constants/theme";
import { useActivity } from "../contexts/ActivityContext";
import { useAuth } from "../contexts/AuthContext";
import { useFriends } from "../contexts/FriendsContext";
import { useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext";
import { useWishlist } from "../contexts/WishlistContext";
import { ExportService } from "../services/exportService";

// Export Modal Component
const ExportModal = ({
  visible,
  onClose,
  onExport,
}: {
  visible: boolean;
  onClose: () => void;
  onExport: (format: "json" | "csv" | "gpx", method: "share" | "email") => void;
}) => {
  const [selectedFormat, setSelectedFormat] = useState<"json" | "csv" | "gpx">(
    "json"
  );
  const [emailAddress, setEmailAddress] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);

  const exportFormats = [
    {
      id: "json",
      name: "JSON Backup",
      description: "Complete backup with all data",
      icon: "code-outline",
      color: theme.colors.forest,
    },
    {
      id: "csv",
      name: "CSV Export",
      description: "Spreadsheet format for analysis",
      icon: "grid-outline",
      color: theme.colors.navy,
    },
    {
      id: "gpx",
      name: "GPX Tracks",
      description: "GPS routes for other apps",
      icon: "navigate-outline",
      color: theme.colors.burntOrange,
    },
  ];

  const handleExport = () => {
    if (showEmailInput && !emailAddress.trim()) {
      Alert.alert("Email Required", "Please enter an email address");
      return;
    }
    onExport(selectedFormat, showEmailInput ? "email" : "share");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Export Data</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>Choose export format:</Text>

          {exportFormats.map((format) => (
            <TouchableOpacity
              key={format.id}
              style={[
                styles.formatOption,
                selectedFormat === format.id && styles.formatOptionSelected,
              ]}
              onPress={() => setSelectedFormat(format.id as any)}
            >
              <View
                style={[
                  styles.formatIcon,
                  { backgroundColor: format.color + "20" },
                ]}
              >
                <Ionicons
                  name={format.icon as any}
                  size={24}
                  color={format.color}
                />
              </View>
              <View style={styles.formatInfo}>
                <Text style={styles.formatName}>{format.name}</Text>
                <Text style={styles.formatDescription}>
                  {format.description}
                </Text>
              </View>
              {selectedFormat === format.id && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.forest}
                />
              )}
            </TouchableOpacity>
          ))}

          <View style={styles.exportMethodSection}>
            <Text style={styles.modalSubtitle}>Export via:</Text>

            <View style={styles.methodButtons}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  !showEmailInput && styles.methodButtonActive,
                ]}
                onPress={() => setShowEmailInput(false)}
              >
                <Ionicons
                  name="share-social"
                  size={20}
                  color={
                    !showEmailInput ? theme.colors.white : theme.colors.gray
                  }
                />
                <Text
                  style={[
                    styles.methodButtonText,
                    !showEmailInput && styles.methodButtonTextActive,
                  ]}
                >
                  Share
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodButton,
                  showEmailInput && styles.methodButtonActive,
                ]}
                onPress={() => setShowEmailInput(true)}
              >
                <Ionicons
                  name="mail"
                  size={20}
                  color={
                    showEmailInput ? theme.colors.white : theme.colors.gray
                  }
                />
                <Text
                  style={[
                    styles.methodButtonText,
                    showEmailInput && styles.methodButtonTextActive,
                  ]}
                >
                  Email
                </Text>
              </TouchableOpacity>
            </View>

            {showEmailInput && (
              <TextInput
                style={styles.emailInput}
                placeholder="Enter email address"
                value={emailAddress}
                onChangeText={setEmailAddress}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={theme.colors.lightGray}
              />
            )}
          </View>

          <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
            <Ionicons
              name="download-outline"
              size={20}
              color={theme.colors.white}
            />
            <Text style={styles.exportButtonText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function SettingsScreen() {
  const router = useRouter();
  const { savedSpots } = useLocation();
  const { activities } = useActivity();
  const { wishlistItems } = useWishlist();
  const { settings, updateSettings } = useSettings();
  const { privacySettings: friendsPrivacy, updatePrivacySettings } =
    useFriends();

  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { user, signOut, isOfflineMode } = useAuth();

  const updateSetting = async (key: string, value: any) => {
    await updateSettings({ [key]: value });
  };

  const updatePrivacySetting = async (key: string, value: boolean) => {
    await updateSettings({
      privacy: { ...settings.privacy, [key]: value },
    });
  };

  // Enhanced export functionality
  const handleExport = async (
    format: "json" | "csv" | "gpx",
    method: "share" | "email"
  ) => {
    setIsExporting(true);
    try {
      let fileUri: string;
      let filename: string;
      let mimeType: string;

      switch (format) {
        case "json":
          const backup = await ExportService.createBackup(
            settings,
            savedSpots,
            activities,
            wishlistItems
          );
          fileUri = backup.uri;
          filename = backup.filename;
          mimeType = "application/json";
          break;

        case "csv":
          const csvFiles = await ExportService.exportAsCSV(
            savedSpots,
            activities
          );
          // For CSV, we'll share the activities file (you could let user choose)
          fileUri = csvFiles.activitiesUri;
          filename = `explorable_activities_${
            new Date().toISOString().split("T")[0]
          }.csv`;
          mimeType = "text/csv";

          // Also share spots CSV
          Alert.alert(
            "CSV Export",
            "Two CSV files created:\n• Activities data\n• Saved locations\n\nSharing activities first.",
            [
              {
                text: "Share Both",
                onPress: async () => {
                  await ExportService.shareFile(
                    csvFiles.activitiesUri,
                    "text/csv"
                  );
                  setTimeout(() => {
                    ExportService.shareFile(csvFiles.spotsUri, "text/csv");
                  }, 1000);
                },
              },
              { text: "Activities Only", onPress: () => {} },
            ]
          );
          break;

        case "gpx":
          const gpx = await ExportService.exportActivitiesAsGPX(activities);
          fileUri = gpx.uri;
          filename = gpx.filename;
          mimeType = "application/gpx+xml";
          break;

        default:
          throw new Error("Invalid export format");
      }

      // Get file size for user info
      const fileSize = await ExportService.getFileSize(fileUri);

      if (method === "email") {
        await ExportService.emailBackup(fileUri, filename, undefined);
      } else {
        await ExportService.shareFile(fileUri, mimeType);
      }

      // Show success with file info
      Alert.alert(
        "Export Ready",
        `File: ${filename}\nSize: ${fileSize}\n\nYour data has been prepared for export.`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert(
        "Export Failed",
        "Could not export your data. Please try again."
      );
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  // Import functionality
  const handleImport = async () => {
    Alert.alert(
      "Import Backup",
      "This will replace all current data with the imported backup. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import",
          style: "destructive",
          onPress: async () => {
            setIsImporting(true);
            try {
              const data = await ExportService.importBackup();

              if (data) {
                const success = await ExportService.restoreFromBackup(data);

                if (success) {
                  Alert.alert(
                    "Import Successful",
                    `Imported backup from ${new Date(
                      data.exportDate
                    ).toLocaleDateString()}\n\n• ${
                      data.savedSpots?.length || 0
                    } locations\n• ${
                      data.activities?.length || 0
                    } activities\n• ${
                      data.wishlistItems?.length || 0
                    } wishlist items`,
                    [
                      {
                        text: "Restart App",
                        onPress: () => {
                          // Force app reload to reflect new data
                          router.replace("/");
                        },
                      },
                    ]
                  );
                } else {
                  Alert.alert(
                    "Import Failed",
                    "Could not restore data from backup"
                  );
                }
              }
            } catch (error) {
              console.error("Import error:", error);
              Alert.alert("Import Failed", "Could not import backup file");
            } finally {
              setIsImporting(false);
            }
          },
        },
      ]
    );
  };

  const clearAllData = () => {
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all your saved locations, activities, and wishlist items. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Everything",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert(
                "Data Cleared",
                "All your data has been deleted. The app will now restart.",
                [{ text: "OK", onPress: () => router.replace("/") }]
              );
            } catch (error) {
              Alert.alert("Error", "Failed to clear data");
            }
          },
        },
      ]
    );
  };

  const openPrivacyPolicy = () => {
    Alert.alert(
      "Privacy Policy",
      "explorAble respects your privacy. We only store data locally on your device. Location access is used only for tracking activities and saving spots. Your data is never shared with third parties.",
      [{ text: "OK" }]
    );
  };

  const openTerms = () => {
    Alert.alert(
      "Terms of Service",
      "By using explorAble, you agree to use the app responsibly and at your own risk during outdoor activities. Always prioritize safety and follow local regulations.",
      [{ text: "OK" }]
    );
  };

  const contactSupport = () => {
    // You can replace this with your actual support email
    Alert.alert(
      "Contact Support",
      "Email: support@explorable.app\n\nWe'd love to hear from you!",
      [{ text: "OK" }]
    );
  };

  const rateApp = () => {
    Alert.alert(
      "Coming Soon!",
      "explorAble will be available on the app stores soon. Thanks for your interest!",
      [{ text: "OK" }]
    );
  };

  const shareApp = () => {
    Alert.alert(
      "Share explorAble",
      "Share this app with your adventure buddies!",
      [{ text: "OK" }]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out? Your local data will be preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              // Navigate to login screen
              router.replace("/auth/login");
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Error", "Failed to sign out. Please try again.");
            }
          },
        },
      ]
    );
  };
  // In your settings.tsx file, replace the settingSections array with this:

  // Replace your settingSections array with this fixed version:

  const settingSections = [
    {
      title: "Preferences",
      icon: "settings-outline",
      items: [
        {
          type: "toggle",
          label: "Distance Units",
          value: settings.units,
          options: ["metric", "imperial"],
          displayValue: settings.units === "metric" ? "Kilometers" : "Miles",
          onPress: () => {
            updateSetting(
              "units",
              settings.units === "metric" ? "imperial" : "metric"
            );
          },
        },
        {
          type: "select",
          label: "Default Activity",
          value: settings.defaultActivityType,
          displayValue:
            settings.defaultActivityType.charAt(0).toUpperCase() +
            settings.defaultActivityType.slice(1),
          onPress: () => setShowActivityPicker(true),
        },
        {
          type: "switch",
          label: "Auto-save Activities",
          value: settings.autoSave,
          onValueChange: (value: boolean) => updateSetting("autoSave", value),
        },
        {
          type: "switch",
          label: "Notifications",
          value: settings.notifications,
          onValueChange: (value: boolean) =>
            updateSetting("notifications", value),
        },
      ],
    },
    {
      title: "Map Settings",
      icon: "map-outline",
      items: [
        {
          type: "select",
          label: "Map Style",
          value: settings.mapStyle,
          displayValue:
            settings.mapStyle.charAt(0).toUpperCase() +
            settings.mapStyle.slice(1),
          onPress: () => {
            const styles = ["standard", "satellite", "terrain"];
            const currentIndex = styles.indexOf(settings.mapStyle);
            const nextIndex = (currentIndex + 1) % styles.length;
            updateSetting("mapStyle", styles[nextIndex]);
          },
        },
      ],
    },
    {
      title: "Social & Sharing",
      icon: "people-outline",
      items: [
        {
          type: "switch",
          label: "Auto-share Activities",
          subtitle: "Automatically share completed activities with friends",
          value: friendsPrivacy.autoShareActivities,
          onValueChange: (value: boolean) =>
            updatePrivacySettings({ autoShareActivities: value }),
        },
        {
          type: "select",
          label: "Default Activity Privacy",
          subtitle: "How much detail to share by default",
          value: friendsPrivacy.defaultActivityPrivacy,
          displayValue:
            friendsPrivacy.defaultActivityPrivacy === "stats_only"
              ? "Stats Only"
              : friendsPrivacy.defaultActivityPrivacy === "general_area"
              ? "General Area"
              : "Full Route",
          onPress: () => {
            const options = ["stats_only", "general_area", "full_route"];
            const labels = ["Stats Only", "General Area", "Full Route"];
            const currentIndex = options.indexOf(
              friendsPrivacy.defaultActivityPrivacy
            );
            const nextIndex = (currentIndex + 1) % options.length;
            updatePrivacySettings({
              defaultActivityPrivacy: options[nextIndex] as
                | "stats_only"
                | "general_area"
                | "full_route",
            });
          },
        },
        {
          type: "switch",
          label: "Share Locations with Friends",
          value: friendsPrivacy.shareLocationsWithFriends,
          onValueChange: (value: boolean) =>
            updatePrivacySettings({ shareLocationsWithFriends: value }),
        },
        {
          type: "switch",
          label: "Show Online Status",
          value: friendsPrivacy.showOnlineStatus,
          onValueChange: (value: boolean) =>
            updatePrivacySettings({ showOnlineStatus: value }),
        },
      ],
    },
    {
      title: "Privacy",
      icon: "lock-closed-outline",
      items: [
        {
          type: "switch",
          label: "Share Location",
          value: settings.privacy.shareLocation,
          onValueChange: (value: boolean) =>
            updatePrivacySetting("shareLocation", value),
        },
        {
          type: "switch",
          label: "Public Profile",
          value: settings.privacy.publicProfile,
          onValueChange: (value: boolean) =>
            updatePrivacySetting("publicProfile", value),
        },
      ],
    },
    {
      title: "Account",
      icon: "person-circle-outline",
      items: (() => {
        // Build items array conditionally without spread operators
        const items: any[] = [];

        // Add user info if logged in
        if (user) {
          items.push({
            type: "info",
            label: "Email",
            value: user.email || "Not available",
            icon: "mail-outline",
          });
          items.push({
            type: "info",
            label: "User ID",
            value: user.id ? `${user.id.substring(0, 8)}...` : "Not available",
            icon: "finger-print-outline",
          });
        }

        // Always show sync status
        items.push({
          type: "info",
          label: "Sync Status",
          value: user
            ? "Connected"
            : isOfflineMode
            ? "Offline Mode"
            : "Not signed in",
          icon: user ? "cloud-done-outline" : "cloud-offline-outline",
        });

        // Add auth actions based on login status
        if (user) {
          items.push({
            type: "action",
            label: "Sign Out",
            subtitle: "Sign out of your account",
            icon: "log-out-outline",
            danger: true,
            onPress: handleLogout,
          });
        } else {
          items.push({
            type: "action",
            label: "Sign In",
            subtitle: "Sign in to sync your data",
            icon: "log-in-outline",
            onPress: () => router.push("/auth/login"),
          });
          items.push({
            type: "action",
            label: "Create Account",
            subtitle: "Sign up for a new account",
            icon: "person-add-outline",
            onPress: () => router.push("/auth/signup"),
          });
        }

        return items;
      })(),
    },
    {
      title: "Data Management",
      icon: "server-outline",
      items: [
        {
          type: "action",
          label: "Export Data",
          subtitle: "Backup to JSON, CSV, or GPX",
          icon: "download-outline",
          onPress: () => setShowExportModal(true),
        },
        {
          type: "action",
          label: "Import Backup",
          subtitle: "Restore from backup file",
          icon: "cloud-download-outline",
          onPress: handleImport,
        },
        {
          type: "action",
          label: "Clear All Data",
          subtitle: "Delete everything permanently",
          icon: "trash-outline",
          danger: true,
          onPress: clearAllData,
        },
      ],
    },
    {
      title: "Support",
      icon: "help-circle-outline",
      items: [
        {
          type: "link",
          label: "Contact Support",
          icon: "mail-outline",
          onPress: contactSupport,
        },
        {
          type: "link",
          label: "Rate explorAble",
          icon: "star-outline",
          onPress: rateApp,
        },
        {
          type: "link",
          label: "Share with Friends",
          icon: "share-social-outline",
          onPress: shareApp,
        },
      ],
    },
    {
      title: "Legal",
      icon: "document-text-outline",
      items: [
        {
          type: "link",
          label: "Privacy Policy",
          icon: "shield-checkmark-outline",
          onPress: openPrivacyPolicy,
        },
        {
          type: "link",
          label: "Terms of Service",
          icon: "document-outline",
          onPress: openTerms,
        },
      ],
    },
  ];

  const appVersion = Application.nativeApplicationVersion || "1.0.0";
  const buildNumber = Application.nativeBuildVersion || "1";

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Stack.Screen
          options={{
            title: "Settings",
            headerStyle: {
              backgroundColor: theme.colors.forest,
            },
            headerTintColor: "#fff",
            headerTitleStyle: {
              fontWeight: "bold",
            },
          }}
        />

        {/* App Info Header */}
        <View style={styles.appHeader}>
          <ExplorableIcon size={80} />
          <Text style={styles.appName}>explorAble</Text>
          <Text style={styles.appVersion}>
            Version {appVersion} ({buildNumber})
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{savedSpots.length}</Text>
              <Text style={styles.statLabel}>Places</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{activities.length}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{wishlistItems.length}</Text>
              <Text style={styles.statLabel}>Wishlist</Text>
            </View>
          </View>
        </View>

        {/* Settings Sections */}
        {settingSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name={section.icon as any}
                size={20}
                color={theme.colors.forest}
              />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.items.map((item: any, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                style={[
                  styles.settingItem,
                  item.danger && styles.dangerItem,
                  itemIndex === section.items.length - 1 && styles.lastItem,
                ]}
                onPress={
                  item.type !== "switch" && item.type !== "info"
                    ? item.onPress
                    : undefined
                }
                activeOpacity={
                  item.type === "switch" || item.type === "info" ? 1 : 0.7
                }
                disabled={
                  item.type === "info" ||
                  (item.label === "Export Data" && isExporting) ||
                  (item.label === "Import Backup" && isImporting)
                }
              >
                <View style={styles.settingContent}>
                  {item.icon && (
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={
                        item.danger
                          ? theme.colors.burntOrange
                          : theme.colors.gray
                      }
                      style={styles.settingIcon}
                    />
                  )}
                  <View style={styles.settingText}>
                    <Text
                      style={[
                        styles.settingLabel,
                        item.danger && styles.dangerText,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.subtitle && (
                      <Text style={styles.settingSubtitle}>
                        {item.subtitle}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Show loading indicator for export/import */}
                {((item.label === "Export Data" && isExporting) ||
                  (item.label === "Import Backup" && isImporting)) && (
                  <ActivityIndicator size="small" color={theme.colors.forest} />
                )}

                {/* Info type - shows value text */}
                {item.type === "info" && (
                  <View style={styles.infoValue}>
                    <Text style={styles.infoText}>{item.value}</Text>
                  </View>
                )}

                {item.type === "switch" && (
                  <Switch
                    value={item.value}
                    onValueChange={item.onValueChange}
                    trackColor={{
                      false: theme.colors.borderGray,
                      true: theme.colors.forest,
                    }}
                    thumbColor={
                      item.value ? theme.colors.white : theme.colors.lightGray
                    }
                  />
                )}

                {item.type === "toggle" && (
                  <View style={styles.toggleValue}>
                    <Text style={styles.valueText}>{item.displayValue}</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={theme.colors.lightGray}
                    />
                  </View>
                )}

                {item.type === "select" && (
                  <View style={styles.selectValue}>
                    <Text style={styles.valueText}>{item.displayValue}</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={theme.colors.lightGray}
                    />
                  </View>
                )}

                {item.type === "link" && !isExporting && !isImporting && (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.lightGray}
                  />
                )}

                {item.type === "action" &&
                  !item.danger &&
                  !isExporting &&
                  !isImporting && (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={theme.colors.lightGray}
                    />
                  )}

                {item.type === "action" &&
                  item.danger &&
                  !isExporting &&
                  !isImporting && (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={theme.colors.burntOrange}
                    />
                  )}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with ❤️ for adventurers</Text>
          <Text style={styles.footerSubtext}>© 2024 explorAble</Text>
        </View>
      </ScrollView>

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
      />

      {/* Activity Picker Modal */}
      <ActivityPickerModal
        visible={showActivityPicker}
        currentValue={settings.defaultActivityType as any}
        onClose={() => setShowActivityPicker(false)}
        onSelect={(activity) => updateSetting("defaultActivityType", activity)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  appHeader: {
    backgroundColor: theme.colors.white,
    alignItems: "center",
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  appName: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
    marginTop: 12,
  },
  appVersion: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 20,
    paddingHorizontal: 40,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.forest,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.borderGray,
    marginHorizontal: 20,
  },
  section: {
    backgroundColor: theme.colors.white,
    marginTop: 20,
    paddingVertical: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginLeft: 8,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  dangerItem: {
    backgroundColor: theme.colors.burntOrange + "05",
  },
  settingContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.colors.navy,
  },
  settingSubtitle: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  dangerText: {
    color: theme.colors.burntOrange,
  },
  toggleValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  valueText: {
    fontSize: 14,
    color: theme.colors.gray,
    marginRight: 8,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 30,
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  footerSubtext: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: 15,
    marginTop: 10,
  },
  formatOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  formatOptionSelected: {
    borderColor: theme.colors.forest,
    backgroundColor: theme.colors.forest + "10",
  },
  formatIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  formatInfo: {
    flex: 1,
  },
  formatName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  formatDescription: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  exportMethodSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  methodButtons: {
    flexDirection: "row",
    marginBottom: 15,
  },
  methodButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginHorizontal: 5,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  methodButtonActive: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  methodButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
  },
  methodButtonTextActive: {
    color: theme.colors.white,
  },
  emailInput: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.navy,
  },
  exportButton: {
    backgroundColor: theme.colors.forest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 20,
  },
  exportButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  infoValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.gray,
  },
});
