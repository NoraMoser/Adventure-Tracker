// app/profile.tsx - Complete profile screen with proper avatar handling
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useActivity } from '../contexts/ActivityContext';
import { useAuth } from '../contexts/AuthContext';
import { useFriends } from '../contexts/FriendsContext';
import { useLocation } from '../contexts/LocationContext';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { activities } = useActivity();
  const { savedSpots } = useLocation();
  const { friends } = useFriends();
  const { formatDistance, formatSpeed } = useSettings();
  
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: '',
    username: '',
    bio: '',
    avatar: '',
    profile_picture: null as string | null,
  });
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      
      if (profile) {
        setProfileData({
          displayName: profile.display_name || '',
          username: profile.username || '',
          bio: profile.bio || '',
          avatar: profile.avatar || '👤',
          profile_picture: profile.profile_picture || null,
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadProfilePicture(result.assets[0].uri);
    }
  };

  const uploadProfilePicture = async (uri: string) => {
    if (!user) return;
    
    try {
      setUploadingImage(true);
      
      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Create unique filename
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);
      
      // Update profile with new picture URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture: urlData.publicUrl })
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      setProfileData(prev => ({ ...prev, profile_picture: urlData.publicUrl }));
      Alert.alert('Success', 'Profile picture updated!');
      
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload profile picture');
    } finally {
      setUploadingImage(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profileData.displayName,
          bio: profileData.bio,
          avatar: profileData.avatar,
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      Alert.alert('Success', 'Profile updated!');
      setEditMode(false);
      
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/login');
          }
        },
      ]
    );
  };

  // Calculate stats
  const totalDistance = activities.reduce((sum, act) => sum + act.distance, 0);
  const totalDuration = activities.reduce((sum, act) => sum + act.duration, 0);
  const avgSpeed = activities.length > 0 
    ? activities.reduce((sum, act) => sum + act.averageSpeed, 0) / activities.length 
    : 0;
  
  // Recent activity types
  const activityTypes = activities.reduce((acc, act) => {
    acc[act.type] = (acc[act.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const favoriteActivity = Object.entries(activityTypes).sort((a, b) => b[1] - a[1])[0];

  // Avatar rendering component - properly handles all cases
  const ProfileAvatar = () => {
    if (profileData.profile_picture) {
      return (
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: profileData.profile_picture }} 
            style={styles.profilePicture}
          />
          {editMode && (
            <TouchableOpacity 
              style={styles.editAvatarButton}
              onPress={pickImage}
              disabled={uploadingImage}
            >
              <Ionicons name="camera" size={20} color="white" />
            </TouchableOpacity>
          )}
        </View>
      );
    }
    
    return (
      <View style={styles.avatarContainer}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>{profileData.avatar}</Text>
        </View>
        {editMode && (
          <TouchableOpacity 
            style={styles.editAvatarButton}
            onPress={pickImage}
            disabled={uploadingImage}
          >
            <Ionicons name="camera" size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Profile',
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerRight: () => (
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setEditMode(!editMode)}
            >
              <Ionicons 
                name={editMode ? "checkmark" : "create-outline"} 
                size={24} 
                color="white" 
              />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.forest}
            colors={[theme.colors.forest]}
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <ProfileAvatar />
          
          {editMode ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={profileData.displayName}
                onChangeText={(text) => setProfileData({...profileData, displayName: text})}
                placeholder="Display Name"
                placeholderTextColor={theme.colors.lightGray}
              />
              <TextInput
                style={[styles.editInput, styles.bioInput]}
                value={profileData.bio}
                onChangeText={(text) => setProfileData({...profileData, bio: text})}
                placeholder="Bio"
                placeholderTextColor={theme.colors.lightGray}
                multiline
                numberOfLines={3}
              />
              <View style={styles.emojiSelector}>
                <Text style={styles.emojiLabel}>Avatar Emoji:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {['👤', '🚴', '🏃', '🥾', '🏔️', '🌲', '⛺', '🎒', '🧗', '🚶'].map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.emojiOption,
                        profileData.avatar === emoji && styles.emojiSelected,
                      ]}
                      onPress={() => setProfileData({...profileData, avatar: emoji})}
                    >
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.displayName}>{profileData.displayName || 'Set your name'}</Text>
              <Text style={styles.username}>@{profileData.username}</Text>
              {profileData.bio ? (
                <Text style={styles.bio}>{profileData.bio}</Text>
              ) : null}
            </View>
          )}
        </View>
        
        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="bicycle" size={24} color={theme.colors.forest} />
              <Text style={styles.statNumber}>{activities.length}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
            
            <View style={styles.statCard}>
              <Ionicons name="navigate" size={24} color={theme.colors.navy} />
              <Text style={styles.statNumber}>{formatDistance(totalDistance, 0).split(' ')[0]}</Text>
              <Text style={styles.statLabel}>{formatDistance(totalDistance, 0).split(' ')[1]}</Text>
            </View>
            
            <View style={styles.statCard}>
              <Ionicons name="location" size={24} color={theme.colors.burntOrange} />
              <Text style={styles.statNumber}>{savedSpots.length}</Text>
              <Text style={styles.statLabel}>Places</Text>
            </View>
            
            <View style={styles.statCard}>
              <Ionicons name="people" size={24} color={theme.colors.forest} />
              <Text style={styles.statNumber}>{friends.filter(f => f.status === 'accepted').length}</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
          </View>
          
          {favoriteActivity && (
            <View style={styles.favoriteActivity}>
              <Text style={styles.favoriteLabel}>Favorite Activity:</Text>
              <Text style={styles.favoriteValue}>{favoriteActivity[0]} ({favoriteActivity[1]} times)</Text>
            </View>
          )}
        </View>
        
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings" size={24} color={theme.colors.forest} />
            <Text style={styles.actionText}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.gray} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionItem, styles.signOutButton]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out" size={24} color="#FF4757" />
            <Text style={[styles.actionText, { color: '#FF4757' }]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={20} color="#FF4757" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  headerButton: {
    marginRight: 10,
  },
  profileHeader: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.forest + '30',
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.colors.forest + '30',
  },
  avatarEmoji: {
    fontSize: 48,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.forest,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileInfo: {
    alignItems: 'center',
  },
  displayName: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 5,
  },
  username: {
    fontSize: 16,
    color: theme.colors.gray,
    marginBottom: 10,
  },
  bio: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 5,
  },
  editContainer: {
    width: '100%',
  },
  editInput: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
    color: theme.colors.navy,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  emojiSelector: {
    marginVertical: 10,
  },
  emojiLabel: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: 10,
  },
  emojiOption: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    backgroundColor: theme.colors.offWhite,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiSelected: {
    borderColor: theme.colors.forest,
  },
  emojiText: {
    fontSize: 24,
  },
  saveButton: {
    backgroundColor: theme.colors.forest,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statsSection: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.navy,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 4,
  },
  favoriteActivity: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    padding: 10,
    backgroundColor: theme.colors.forest + '10',
    borderRadius: 8,
  },
  favoriteLabel: {
    fontSize: 14,
    color: theme.colors.gray,
    marginRight: 8,
  },
  favoriteValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.forest,
  },
  quickActions: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.navy,
    marginLeft: 15,
  },
  signOutButton: {
    borderBottomWidth: 0,
    marginTop: 10,
  },
});