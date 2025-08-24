// app/profile.tsx - Profile Screen
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useFriends } from '../contexts/FriendsContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { friends } = useFriends();

  const handleEditProfile = () => {
    router.push('/profile-edit');
  };

  const handleViewFriends = () => {
    router.push('/friends');
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
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
              onPress={handleEditProfile}
            >
              <Ionicons name="create-outline" size={24} color="white" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleEditProfile}>
            <View style={styles.avatarContainer}>
              {profile?.profile_picture ? (
                <Image 
                  source={{ uri: profile.profile_picture }} 
                  style={styles.profilePicture} 
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>
                    {profile?.avatar || '👤'}
                  </Text>
                </View>
              )}
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={16} color="white" />
              </View>
            </View>
          </TouchableOpacity>

          <Text style={styles.displayName}>
            {profile?.display_name || 'User'}
          </Text>
          <Text style={styles.username}>
            @{profile?.username || 'username'}
          </Text>

          {profile?.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}

          {/* Quick Stats */}
          <View style={styles.stats}>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={handleViewFriends}
            >
              <Text style={styles.statNumber}>{friends.length}</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Locations</Text>
            </View>
          </View>

          {/* Edit Profile Button */}
          <TouchableOpacity 
            style={styles.editButton}
            onPress={handleEditProfile}
          >
            <Ionicons name="create-outline" size={20} color="white" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Options */}
        <View style={styles.menu}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleViewFriends}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="people" size={24} color={theme.colors.forest} />
              <Text style={styles.menuItemText}>Friends</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.gray} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="settings" size={24} color={theme.colors.navy} />
              <Text style={styles.menuItemText}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.gray} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-checkmark" size={24} color={theme.colors.burntOrange} />
              <Text style={styles.menuItemText}>Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.gray} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle" size={24} color={theme.colors.gray} />
              <Text style={styles.menuItemText}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.gray} />
          </TouchableOpacity>
        </View>

        {/* Account Info */}
        <View style={styles.accountInfo}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>
              {profile?.created_at 
                ? new Date(profile.created_at).toLocaleDateString()
                : 'Unknown'}
            </Text>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color="#FF4757" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
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
    marginRight: 15,
  },
  header: {
    backgroundColor: 'white',
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.borderGray,
  },
  avatarText: {
    fontSize: 50,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.forest,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
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
    marginHorizontal: 30,
    marginBottom: 20,
    lineHeight: 20,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 25,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.navy,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.colors.borderGray,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  menu: {
    backgroundColor: 'white',
    marginTop: 10,
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: theme.colors.navy,
    marginLeft: 15,
  },
  accountInfo: {
    backgroundColor: 'white',
    marginTop: 10,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 15,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF4757',
  },
  signOutText: {
    color: '#FF4757',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomSpacer: {
    height: 30,
  },
});