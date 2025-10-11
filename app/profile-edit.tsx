// app/profile-edit.tsx - Fixed with expo-camera
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState, useRef } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { theme } from "../constants/theme";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { Camera, CameraView } from "expo-camera";

// Avatar Selection Modal (unchanged)
const AvatarModal = ({
  visible,
  onClose,
  onSelectAvatar,
  currentAvatar,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectAvatar: (avatar: string) => void;
  currentAvatar: string;
}) => {
  const avatars = [
    "👤", "😀", "😎", "🤠", "🧑‍💻", "👨‍🎨", "👩‍🚀", "🧑‍🌾",
    "🏃", "🚴", "🏊", "🧗", "⛷️", "🏂", "🤸", "🧘",
    "🦊", "🐻", "🐼", "🦁", "🐯", "🦄", "🐺", "🦅",
    "🌲", "🏔️", "🌊", "🌅", "🌴", "🏕️", "⛺", "🗺️"
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={avatarStyles.overlay}>
        <View style={avatarStyles.content}>
          <View style={avatarStyles.header}>
            <Text style={avatarStyles.title}>Choose Avatar</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>
          
          <View style={avatarStyles.grid}>
            {avatars.map((avatar) => (
              <TouchableOpacity
                key={avatar}
                style={[
                  avatarStyles.avatarOption,
                  currentAvatar === avatar && avatarStyles.avatarSelected
                ]}
                onPress={() => {
                  onSelectAvatar(avatar);
                  onClose();
                }}
              >
                <Text style={avatarStyles.avatarText}>{avatar}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  
  // Form fields
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [avatar, setAvatar] = useState(profile?.avatar || "👤");
  const [profilePicture, setProfilePicture] = useState(profile?.profile_picture || null);
  const [usernameError, setUsernameError] = useState("");

  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraKey, setCameraKey] = useState(0);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setAvatar(profile.avatar || "👤");
      setProfilePicture(profile.profile_picture || null);
    }
  }, [profile]);

  // Create storage bucket if it doesn't exist
  const ensureStorageBucket = async () => {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const avatarBucket = buckets?.find(bucket => bucket.name === 'avatars');
      
      if (!avatarBucket) {
        const { error } = await supabase.storage.createBucket('avatars', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'],
          fileSizeLimit: 5242880, // 5MB
        });
        
        if (error) {
          console.error('Error creating bucket:', error);
          // If bucket already exists or other error, continue
        }
      }
    } catch (error) {
      console.error('Error checking/creating bucket:', error);
    }
  };

  // Check username availability
  const checkUsernameAvailability = async (newUsername: string) => {
    if (!newUsername || newUsername === profile?.username) {
      setUsernameError("");
      return true;
    }

    setCheckingUsername(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', newUsername.toLowerCase())
        .single();

      if (data && data.id !== user?.id) {
        setUsernameError("Username already taken");
        setCheckingUsername(false);
        return false;
      }
      
      setUsernameError("");
      setCheckingUsername(false);
      return true;
    } catch (err) {
      // No user found - username is available
      setUsernameError("");
      setCheckingUsername(false);
      return true;
    }
  };

  // Handle username change
  const handleUsernameChange = (text: string) => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    if (usernameError) {
      setUsernameError("");
    }
  };

  // Pick image from gallery
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photos to set a profile picture."
      );
      return;
    }

    const mediaTypes = (ImagePicker as any).MediaTypeOptions?.Images || ['images'];
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaTypes,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      uploadProfilePicture(result.assets[0].uri);
    } else if (!result.canceled && (result as any).uri) {
      // Fallback for older API
      uploadProfilePicture((result as any).uri);
    }
  };

  // Take photo with camera - FIXED with expo-camera
  const takePhoto = async () => {
    setShowCamera(true);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        console.log("Taking profile picture...");
        
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: true,
        });
        
        console.log("Profile photo result:", photo);
        
        if (photo && photo.uri) {
          // Upload the photo
          uploadProfilePicture(photo.uri);
          
          // Force camera to unmount and remount
          setCameraKey(prev => prev + 1);
          
          // Close camera
          setTimeout(() => {
            setShowCamera(false);
          }, 200);
        }
        
      } catch (error) {
        console.error("Camera error:", error);
        Alert.alert("Error", "Failed to take picture");
        setShowCamera(false);
      }
    }
  };

  // Upload profile picture - USING YOUR PHOTOSERVICE
  const uploadProfilePicture = async (uri: string) => {
    if (!user) return;

    setUploadingImage(true);
    try {
      console.log('Starting profile picture upload...');
      
      // Import PhotoService
      const { PhotoService } = await import('../services/photoService');
      
      // Use PhotoService to upload - same as your locations
      const uploadedUrl = await PhotoService.uploadPhoto(
        uri,
        'profile-avatars', // Use the profile-avatars bucket that exists
        user.id
      );

      if (uploadedUrl) {
        console.log('Profile picture uploaded successfully:', uploadedUrl);
        setProfilePicture(uploadedUrl);
        
        // Save to database
        const { error: dbError } = await supabase
          .from('profiles')
          .update({ 
            profile_picture: uploadedUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (dbError) {
          console.error('Error updating profile in database:', dbError);
        } else {
          // Refresh profile to get updated data
          if (refreshProfile) {
            await refreshProfile();
          }
        }
        
        Alert.alert("Success", "Profile picture updated!");
      } else {
        throw new Error('Upload failed - no URL returned');
      }
      
    } catch (error: any) {
      console.error("Error uploading profile picture:", error);
      
      Alert.alert(
        "Upload Failed", 
        "Could not upload profile picture. Please try again with a smaller image."
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // Remove profile picture
  const removeProfilePicture = () => {
    Alert.alert(
      "Remove Photo",
      "Are you sure you want to remove your profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setProfilePicture(null);
          },
        },
      ]
    );
  };

  // Save profile
  const handleSave = async () => {
    if (!user) return;
    
    if (!displayName.trim() || !username.trim()) {
      Alert.alert('Error', 'Display name and username are required');
      return;
    }
    
    if (username !== profile?.username) {
      const isAvailable = await checkUsernameAvailability(username);
      if (!isAvailable) {
        Alert.alert('Error', 'Username is already taken');
        return;
      }
    }

    setSaving(true);
    try {
      const updates = {
        display_name: displayName.trim(),
        username: username.toLowerCase(),
        bio: bio.trim(),
        avatar: avatar,
        profile_picture: profilePicture,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      
      Alert.alert(
        'Success',
        'Profile updated successfully!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error updating profile:', error);
      if (error.code === '23505') {
        Alert.alert('Error', 'Username is already taken');
      } else {
        Alert.alert('Error', 'Failed to update profile');
      }
    } finally {
      setSaving(false);
    }
  };

  // Photo options modal
  const showPhotoOptions = () => {
    Alert.alert(
      "Profile Picture",
      "Choose an option",
      [
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Gallery", onPress: pickImage },
        ...(profilePicture ? [{ text: "Remove Photo", onPress: removeProfilePicture, style: "destructive" as const }] : []),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  };

  // Camera view
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView 
          key={cameraKey}
          ref={cameraRef}
          style={styles.camera} 
          facing="front" // Use front camera for profile photos
        />
        <View style={styles.cameraOverlay}>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setCameraKey(prev => prev + 1);
              setShowCamera(false);
            }}
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Stack.Screen
        options={{
          title: "Edit Profile",
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture Section */}
        <View style={styles.photoSection}>
          <TouchableOpacity 
            style={styles.photoContainer}
            onPress={showPhotoOptions}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <View style={styles.photoPlaceholder}>
                <ActivityIndicator size="large" color={theme.colors.forest} />
              </View>
            ) : profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.profilePhoto} />
            ) : (
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{avatar}</Text>
              </View>
            )}
            
            <View style={styles.photoEditBadge}>
              <Ionicons name="camera" size={20} color="white" />
            </View>
          </TouchableOpacity>
          
          <Text style={styles.photoHint}>Tap to change profile picture</Text>
          
          {/* Avatar Selection */}
          <TouchableOpacity
            style={styles.changeAvatarButton}
            onPress={() => setShowAvatarModal(true)}
          >
            <Text style={styles.changeAvatarText}>Choose Emoji Avatar</Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          {/* Display Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your display name"
              placeholderTextColor={theme.colors.lightGray}
              maxLength={50}
            />
            <Text style={styles.hint}>This is how your name appears to friends</Text>
          </View>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.usernameContainer}>
              <Text style={styles.usernamePrefix}>@</Text>
              <TextInput
                style={[
                  styles.usernameInput,
                  usernameError && styles.inputError
                ]}
                value={username}
                onChangeText={handleUsernameChange}
                onBlur={() => checkUsernameAvailability(username)}
                placeholder="username"
                placeholderTextColor={theme.colors.lightGray}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
              />
              {checkingUsername && (
                <ActivityIndicator size="small" color={theme.colors.forest} style={styles.usernameSpinner} />
              )}
            </View>
            {usernameError ? (
              <Text style={styles.errorText}>{usernameError}</Text>
            ) : (
              <Text style={styles.hint}>Unique identifier (letters, numbers, underscore)</Text>
            )}
          </View>

          {/* Bio */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell others about yourself..."
              placeholderTextColor={theme.colors.lightGray}
              multiline
              numberOfLines={4}
              maxLength={200}
            />
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </View>

          {/* Account Info */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Account Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
                {profile?.created_at 
                  ? new Date(profile.created_at).toLocaleDateString()
                  : "Unknown"}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Avatar Modal */}
      <AvatarModal
        visible={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        onSelectAvatar={setAvatar}
        currentAvatar={avatar}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  scrollView: {
    flex: 1,
  },
  headerButton: {
    marginRight: 15,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  photoSection: {
    alignItems: "center",
    backgroundColor: "white",
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    position: "relative",
    marginBottom: 10,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: theme.colors.borderGray,
  },
  avatarText: {
    fontSize: 60,
  },
  photoEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.forest,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "white",
  },
  photoHint: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 5,
  },
  changeAvatarButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
  },
  changeAvatarText: {
    fontSize: 14,
    color: theme.colors.forest,
    fontWeight: "500",
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 25,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.navy,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  inputError: {
    borderColor: "#FF4757",
  },
  hint: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: "#FF4757",
    marginTop: 4,
  },
  usernameContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    paddingLeft: 12,
  },
  usernamePrefix: {
    fontSize: 16,
    color: theme.colors.gray,
    marginRight: 2,
  },
  usernameInput: {
    flex: 1,
    padding: 12,
    paddingLeft: 2,
    fontSize: 16,
    color: theme.colors.navy,
  },
  usernameSpinner: {
    marginRight: 12,
  },
  bioInput: {
    height: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 11,
    color: theme.colors.lightGray,
    textAlign: "right",
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 25,
    zIndex: 1,
  },
});

const avatarStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
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
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 15,
  },
  avatarOption: {
    width: "12.5%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 5,
  },
  avatarSelected: {
    backgroundColor: theme.colors.forest + "20",
    borderRadius: 8,
  },
  avatarText: {
    fontSize: 28,
  },
});