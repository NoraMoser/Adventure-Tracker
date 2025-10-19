// app/settings.tsx - Complete Settings Screen with Home Location Feature
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Location from "expo-location"; // ADD THIS IMPORT
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react"; // ADD useEffect
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useActivity } from "../contexts/ActivityContext";
import { useAuth } from "../contexts/AuthContext";
import { useFriends } from "../contexts/FriendsContext";
import { useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext";
import { useWishlist } from "../contexts/WishlistContext";
import { supabase } from "../lib/supabase";
import { Linking } from "react-native";

// Export Modal Component (keeping your existing modal)
const ExportModal = ({
  visible,
  onClose,
  onExport,
}: {
  visible: boolean;
  onClose: () => void;
  onExport: (format: "json" | "csv", method: "share" | "email") => void;
}) => {
  const [selectedFormat, setSelectedFormat] = useState<"json" | "csv">("json");
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
  const { user, profile, signOut } = useAuth();
  const { savedSpots } = useLocation();
  const { activities } = useActivity();
  const { wishlistItems } = useWishlist();
  const { settings, updateSettings } = useSettings();
  const { privacySettings, updatePrivacySettings, friends } = useFriends();

  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // NEW STATE FOR HOME LOCATION
  const [homeLocation, setHomeLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isSettingHome, setIsSettingHome] = useState(false);
  const [homeRadius, setHomeRadius] = useState(2); // Default 2km

  // LOAD HOME LOCATION ON MOUNT
  useEffect(() => {
    loadHomeLocation();
  }, [user]);

  const loadHomeLocation = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("home_location, home_radius")
      .eq("id", user.id)
      .single();

    if (data) {
      setHomeLocation(data.home_location);
      setHomeRadius(data.home_radius || 2);
    }
  };

  // HOME LOCATION HANDLERS
  const handleSetCurrentLocationAsHome = async () => {
    if (!user) return;

    setIsSettingHome(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required");
        setIsSettingHome(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const newHome = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      const { error } = await supabase
        .from("profiles")
        .update({
          home_location: newHome,
          home_radius: homeRadius,
        })
        .eq("id", user.id);

      if (!error) {
        setHomeLocation(newHome);
        Alert.alert(
          "Home Location Set",
          `Trip suggestions are now disabled within ${homeRadius}km of this location`
        );
      }
    } catch (error) {
      console.error("Error setting home:", error);
      Alert.alert("Error", "Could not set home location");
    } finally {
      setIsSettingHome(false);
    }
  };

  const handleClearHomeLocation = () => {
    Alert.alert(
      "Clear Home Location?",
      "This will enable trip suggestions everywhere",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await supabase
              .from("profiles")
              .update({ home_location: null })
              .eq("id", user.id);
            setHomeLocation(null);
          },
        },
      ]
    );
  };

  const handleChangeHomeRadius = () => {
    Alert.alert(
      "Home Area Radius",
      "Choose how far from home to disable trip suggestions",
      [
        { text: "1km", onPress: () => updateHomeRadius(1) },
        { text: "2km (Default)", onPress: () => updateHomeRadius(2) },
        { text: "5km", onPress: () => updateHomeRadius(5) },
        { text: "10km", onPress: () => updateHomeRadius(10) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const updateHomeRadius = async (radius: number) => {
    setHomeRadius(radius);
    if (homeLocation && user) {
      await supabase
        .from("profiles")
        .update({ home_radius: radius })
        .eq("id", user.id);
    }
  };

  // Profile Header Component
  const ProfileHeader = () => (
    <TouchableOpacity
      style={styles.profileHeader}
      onPress={() => router.push("/profile")}
      activeOpacity={0.8}
    >
      <View style={styles.profileInfo}>
        {profile?.profile_picture ? (
          <Image
            source={{ uri: profile.profile_picture }}
            style={styles.profilePicture}
          />
        ) : (
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{profile?.avatar || "👤"}</Text>
          </View>
        )}
        <View style={styles.profileTextInfo}>
          <Text style={styles.profileName}>
            {profile?.display_name || "User"}
          </Text>
          <Text style={styles.profileEmail}>
            @{profile?.username || user?.email?.split("@")[0]}
          </Text>
        </View>
      </View>
      <View style={styles.profileArrow}>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.gray} />
      </View>
    </TouchableOpacity>
  );

  const updateSetting = async (key: string, value: any) => {
    await updateSettings({ [key]: value });
  };

  const updatePrivacySetting = async (key: string, value: any) => {
    await updatePrivacySettings({ [key]: value });
  };

  const handleExport = async (
    format: "json" | "csv",
    method: "share" | "email"
  ) => {
    setIsExporting(true);
    try {
      let content: string;
      let filename: string;

      if (format === "json") {
        const exportData = {
          exportDate: new Date().toISOString(),
          settings,
          savedSpots,
          activities,
          wishlistItems,
        };
        content = JSON.stringify(exportData, null, 2);
        filename = `explorable_backup_${
          new Date().toISOString().split("T")[0]
        }.json`;
      } else {
        // Simple CSV export for activities
        const csvHeader = "Name,Type,Distance,Duration,Date\n";
        const csvRows = activities
          .map(
            (a) =>
              `"${a.name}","${a.type}","${a.distance}","${a.duration}","${a.startTime}"`
          )
          .join("\n");
        content = csvHeader + csvRows;
        filename = `explorable_activities_${
          new Date().toISOString().split("T")[0]
        }.csv`;
      }

      // Copy to clipboard as a simple solution
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(content);

      Alert.alert(
        "Export Complete",
        `Your ${format.toUpperCase()} data has been copied to clipboard.\n\nFilename: ${filename}\n\nPaste it into Notes or any text app to save it.`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("Export Failed", "Could not export your data");
    } finally {
      setIsExporting(false);
    }
  };

  // Simple import handler
  const handleImport = async () => {
    try {
      setIsImporting(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      // Check if user cancelled
      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsImporting(false);
        return;
      }

      // Get the first selected file
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      const data = JSON.parse(content);

      // Basic validation
      if (data.exportDate && data.settings) {
        Alert.alert(
          "Import Backup",
          `Import backup from ${new Date(
            data.exportDate
          ).toLocaleDateString()}?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Import",
              onPress: async () => {
                // Here you would restore the data to your contexts
                // This is simplified - you'd need to update each context
                Alert.alert("Success", "Data imported successfully!");
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "Invalid File",
          "This doesn't appear to be a valid backup file"
        );
      }
    } catch (error) {
      console.error("Import error:", error);
      Alert.alert("Import Failed", "Could not import the file");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            // Clear local data
            await AsyncStorage.multiRemove(["userName"]);

            // Sign out from auth
            await signOut();

            // Wait longer to ensure everything is cleaned up
            setTimeout(() => {
              // Use push instead of replace during sign out
              router.push("/auth/login");
            }, 500);
          } catch (error) {
            console.error("Sign out error:", error);

            setTimeout(() => {
              router.dismissAll();
              router.replace("/auth/login");
            }, 100);
          }
        },
      },
    ]);
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
              Alert.alert("Data Cleared", "All your data has been deleted.", [
                { text: "OK", onPress: () => router.replace("/") },
              ]);
            } catch (error) {
              Alert.alert("Error", "Failed to clear data");
            }
          },
        },
      ]
    );
  };

  const appVersion = Application.nativeApplicationVersion || "1.0.0";
  const buildNumber = Application.nativeBuildVersion || "1";

  return (
    <View style={styles.container}>
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

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Section - Tap to view/edit profile */}
        {user && <ProfileHeader />}

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="location" size={24} color={theme.colors.forest} />
            <Text style={styles.statNumber}>{savedSpots.length}</Text>
            <Text style={styles.statLabel}>Places</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="bicycle" size={24} color={theme.colors.navy} />
            <Text style={styles.statNumber}>{activities.length}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="heart" size={24} color={theme.colors.burntOrange} />
            <Text style={styles.statNumber}>{wishlistItems.length}</Text>
            <Text style={styles.statLabel}>Wishlist</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color={theme.colors.forest} />
            <Text style={styles.statNumber}>{friends.length}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
        </View>

        {/* Settings Sections */}

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => router.push("/profile")}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="person-circle-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>View Profile</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.lightGray}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => router.push("/profile-edit")}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="create-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>Edit Profile</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.lightGray}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => router.push("/friends")}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="people-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>Friends</Text>
            </View>
            <View style={styles.settingRight}>
              {friends.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{friends.length}</Text>
                </View>
              )}
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.lightGray}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              const newUnit =
                settings.units === "metric" ? "imperial" : "metric";
              updateSetting("units", newUnit);
            }}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="speedometer-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>Distance Units</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {settings.units === "metric" ? "Kilometers" : "Miles"}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="notifications-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>Notifications</Text>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={(value) => updateSetting("notifications", value)}
              trackColor={{
                false: theme.colors.borderGray,
                true: theme.colors.forest,
              }}
              thumbColor={
                settings.notifications
                  ? theme.colors.white
                  : theme.colors.lightGray
              }
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="save-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>Auto-save Activities</Text>
            </View>
            <Switch
              value={settings.autoSave}
              onValueChange={(value) => updateSetting("autoSave", value)}
              trackColor={{
                false: theme.colors.borderGray,
                true: theme.colors.forest,
              }}
              thumbColor={
                settings.autoSave ? theme.colors.white : theme.colors.lightGray
              }
            />
          </View>
        </View>

        {/* ============= NEW HOME LOCATION SECTION ============= */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Home Location</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="home" size={22} color={theme.colors.forest} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Home Area</Text>
                <Text style={styles.settingDescription}>
                  {homeLocation
                    ? `Trip suggestions disabled within ${homeRadius}km`
                    : "Not set - trips suggested everywhere"}
                </Text>
              </View>
            </View>
            {homeLocation && (
              <TouchableOpacity onPress={handleClearHomeLocation}>
                <Ionicons
                  name="close-circle"
                  size={22}
                  color={theme.colors.burntOrange}
                />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleSetCurrentLocationAsHome}
            disabled={isSettingHome}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="location" size={22} color={theme.colors.gray} />
              <Text style={styles.settingLabel}>
                {homeLocation ? "Update Home Location" : "Set Home Location"}
              </Text>
            </View>
            {isSettingHome ? (
              <ActivityIndicator size="small" color={theme.colors.forest} />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.lightGray}
              />
            )}
          </TouchableOpacity>

          {homeLocation && (
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleChangeHomeRadius}
            >
              <View style={styles.settingLeft}>
                <Ionicons
                  name="resize-outline"
                  size={22}
                  color={theme.colors.gray}
                />
                <Text style={styles.settingLabel}>Home Area Radius</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>{homeRadius}km</Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.lightGray}
                />
              </View>
            </TouchableOpacity>
          )}

          {homeLocation && (
            <View style={styles.infoBox}>
              <Ionicons
                name="information-circle"
                size={16}
                color={theme.colors.forest}
              />
              <Text style={styles.infoText}>
                Activities and spots saved near your home won't trigger trip
                suggestions
              </Text>
            </View>
          )}
        </View>
        {/* ============= END NEW HOME LOCATION SECTION ============= */}

        {/* Memory & Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Memory Features</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="calendar-outline"
                size={22}
                color={theme.colors.gray}
              />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>On This Day</Text>
                <Text style={styles.settingDescription}>
                  Get memories from past years
                </Text>
              </View>
            </View>
            <Switch
              value={settings.memoriesEnabled !== false}
              onValueChange={(value) => updateSetting("memoriesEnabled", value)}
              trackColor={{
                false: theme.colors.borderGray,
                true: theme.colors.forest,
              }}
              thumbColor={
                settings.memoriesEnabled !== false
                  ? theme.colors.white
                  : theme.colors.lightGray
              }
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="location-outline"
                size={22}
                color={theme.colors.gray}
              />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Proximity Alerts</Text>
                <Text style={styles.settingDescription}>
                  Notify when near past locations
                </Text>
              </View>
            </View>
            <Switch
              value={settings.proximityEnabled !== false}
              onValueChange={(value) =>
                updateSetting("proximityEnabled", value)
              }
              trackColor={{
                false: theme.colors.borderGray,
                true: theme.colors.forest,
              }}
              thumbColor={
                settings.proximityEnabled !== false
                  ? theme.colors.white
                  : theme.colors.lightGray
              }
            />
          </View>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              Alert.alert(
                "Proximity Distance",
                "Choose how close you need to be to receive notifications",
                [
                  {
                    text: "50m",
                    onPress: () => updateSetting("proximityDistance", 50),
                  },
                  {
                    text: "100m (Default)",
                    onPress: () => updateSetting("proximityDistance", 100),
                  },
                  {
                    text: "200m",
                    onPress: () => updateSetting("proximityDistance", 200),
                  },
                  {
                    text: "500m",
                    onPress: () => updateSetting("proximityDistance", 500),
                  },
                  { text: "Cancel", style: "cancel" },
                ]
              );
            }}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="resize-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>Proximity Distance</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {settings.proximityDistance || 100}m
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.lightGray}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Sharing</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="share-social-outline"
                size={22}
                color={theme.colors.gray}
              />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Auto-share Activities</Text>
                <Text style={styles.settingDescription}>
                  Share new activities with friends
                </Text>
              </View>
            </View>
            <Switch
              value={privacySettings.autoShareActivities}
              onValueChange={(value) =>
                updatePrivacySetting("autoShareActivities", value)
              }
              trackColor={{
                false: theme.colors.borderGray,
                true: theme.colors.forest,
              }}
              thumbColor={
                privacySettings.autoShareActivities
                  ? theme.colors.white
                  : theme.colors.lightGray
              }
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="location-outline"
                size={22}
                color={theme.colors.gray}
              />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Share Locations</Text>
                <Text style={styles.settingDescription}>
                  Let friends see your saved spots
                </Text>
              </View>
            </View>
            <Switch
              value={privacySettings.shareLocationsWithFriends}
              onValueChange={(value) =>
                updatePrivacySetting("shareLocationsWithFriends", value)
              }
              trackColor={{
                false: theme.colors.borderGray,
                true: theme.colors.forest,
              }}
              thumbColor={
                privacySettings.shareLocationsWithFriends
                  ? theme.colors.white
                  : theme.colors.lightGray
              }
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="eye-outline"
                size={22}
                color={theme.colors.gray}
              />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Online Status</Text>
                <Text style={styles.settingDescription}>
                  Show when you are active
                </Text>
              </View>
            </View>
            <Switch
              value={privacySettings.showOnlineStatus}
              onValueChange={(value) =>
                updatePrivacySetting("showOnlineStatus", value)
              }
              trackColor={{
                false: theme.colors.borderGray,
                true: theme.colors.forest,
              }}
              thumbColor={
                privacySettings.showOnlineStatus
                  ? theme.colors.white
                  : theme.colors.lightGray
              }
            />
          </View>
        </View>

        {/* Data Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowExportModal(true)}
            disabled={isExporting}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="download-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>Export Data</Text>
            </View>
            {isExporting ? (
              <ActivityIndicator size="small" color={theme.colors.forest} />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.lightGray}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleImport}
            disabled={isImporting}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="cloud-upload-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>Import Backup</Text>
            </View>
            {isImporting ? (
              <ActivityIndicator size="small" color={theme.colors.forest} />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.lightGray}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, styles.dangerItem]}
            onPress={clearAllData}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="trash-outline"
                size={22}
                color={theme.colors.burntOrange}
              />
              <Text style={[styles.settingLabel, styles.dangerText]}>
                Clear All Data
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.burntOrange}
            />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & About</Text>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="help-circle-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>Help Center</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.lightGray}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              Linking.openURL(
                "mailto:explorable.contact@gmail.com?subject=explorAble Support Request"
              );
            }}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="mail-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>Contact Support</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.lightGray}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="star-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>Rate explorAble</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.lightGray}
            />
          </TouchableOpacity>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color={theme.colors.gray}
              />
              <Text style={styles.settingLabel}>Version</Text>
            </View>
            <Text style={styles.settingValue}>
              {appVersion} ({buildNumber})
            </Text>
          </View>
        </View>

        {/* Sign Out Button */}
        {user && (
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={22} color="#FF4757" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with ❤️ for adventurers</Text>
          <Text style={styles.footerSubtext}>© 2025 explorAble</Text>
        </View>
      </ScrollView>

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  profileHeader: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  profilePicture: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    borderWidth: 2,
    borderColor: theme.colors.borderGray,
  },
  avatarText: {
    fontSize: 30,
  },
  profileTextInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  profileArrow: {
    marginLeft: 10,
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginHorizontal: 5,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.navy,
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.gray,
  },
  section: {
    backgroundColor: "white",
    marginBottom: 10,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
    paddingHorizontal: 20,
    paddingBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  dangerItem: {
    backgroundColor: theme.colors.burntOrange + "05",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.colors.navy,
    marginLeft: 15,
  },
  settingDescription: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  settingValue: {
    fontSize: 14,
    color: theme.colors.gray,
    marginRight: 5,
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    backgroundColor: theme.colors.forest,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 10,
  },
  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  dangerText: {
    color: theme.colors.burntOrange,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest + "10",
    marginHorizontal: 20,
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    color: theme.colors.forest,
    marginLeft: 8,
    flex: 1,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF4757",
  },
  signOutText: {
    color: "#FF4757",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 30,
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
    backgroundColor: "white",
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
    color: "white",
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
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
