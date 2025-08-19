// app/friends.tsx
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { theme } from '../constants/theme';
import { Friend, useFriends } from '../contexts/FriendsContext';

const FriendItem = ({ friend, onPress, onRemove }: any) => {
  const getLastActiveText = (lastActive?: Date) => {
    if (!lastActive) return 'Offline';
    
    const now = new Date();
    const diff = now.getTime() - new Date(lastActive).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 5) return 'Online';
    if (hours < 1) return `${minutes}m ago`;
    if (days < 1) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };
  
  const isOnline = friend.lastActive && 
    (new Date().getTime() - new Date(friend.lastActive).getTime()) < 300000;
  
  return (
    <TouchableOpacity style={styles.friendItem} onPress={() => onPress(friend)}>
      <View style={styles.friendAvatar}>
        <Text style={styles.friendAvatarText}>{friend.avatar || '👤'}</Text>
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{friend.displayName}</Text>
        <Text style={styles.friendUsername}>@{friend.username}</Text>
        <Text style={styles.lastActive}>{getLastActiveText(friend.lastActive)}</Text>
      </View>
      
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => onRemove(friend)}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.gray} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default function FriendsScreen() {
  const router = useRouter();
  const { 
    friends, 
    friendRequests, 
    sendFriendRequest, 
    removeFriend,
    searchUsers 
  } = useFriends();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'friends' | 'find'>('friends');
  
  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
      
      if (results.length === 0) {
        Alert.alert('No Results', 'No users found with that username');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleSendRequest = async (username: string) => {
    Alert.alert(
      'Send Friend Request',
      `Send friend request to @${username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            await sendFriendRequest(username);
            setShowAddModal(false);
            setSearchQuery('');
            setSearchResults([]);
          },
        },
      ]
    );
  };
  
  const handleRemoveFriend = (friend: Friend) => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.displayName} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFriend(friend.id),
        },
      ]
    );
  };
  
  const handleFriendPress = (friend: Friend) => {
    // Navigate to friend profile
    router.push(`/friend-profile/${friend.id}`);
  };
  
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={80} color={theme.colors.lightGray} />
      <Text style={styles.emptyTitle}>No Friends Yet</Text>
      <Text style={styles.emptyText}>
        Add friends to share your adventures!
      </Text>
      <TouchableOpacity 
        style={styles.addFirstButton}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="person-add" size={20} color="white" />
        <Text style={styles.addFirstText}>Add Your First Friend</Text>
      </TouchableOpacity>
    </View>
  );
  
  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Friends',
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerRight: () => (
            <View style={styles.headerRight}>
              {friendRequests.length > 0 && (
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={() => router.push('/friend-requests')}
                >
                  <Ionicons name="person-add" size={24} color="white" />
                  <View style={styles.requestBadge}>
                    <Text style={styles.requestBadgeText}>{friendRequests.length}</Text>
                  </View>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => setShowAddModal(true)}
              >
                <Ionicons name="add" size={28} color="white" />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />
      
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'friends' && styles.tabActive]}
          onPress={() => setSelectedTab('friends')}
        >
          <Text style={[styles.tabText, selectedTab === 'friends' && styles.tabTextActive]}>
            My Friends ({acceptedFriends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'find' && styles.tabActive]}
          onPress={() => setSelectedTab('find')}
        >
          <Text style={[styles.tabText, selectedTab === 'find' && styles.tabTextActive]}>
            Find Friends
          </Text>
        </TouchableOpacity>
      </View>
      
      {selectedTab === 'friends' ? (
        <FlatList
          data={acceptedFriends}
          renderItem={({ item }) => (
            <FriendItem
              friend={item}
              onPress={handleFriendPress}
              onRemove={handleRemoveFriend}
            />
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={acceptedFriends.length === 0 ? styles.emptyContainer : styles.listContainer}
          ListEmptyComponent={renderEmptyState}
        />
      ) : (
        <View style={styles.findFriendsContainer}>
          <View style={styles.searchSection}>
            <Text style={styles.sectionTitle}>Search by Username</Text>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={theme.colors.gray} />
              <TextInput
                style={styles.searchInput}
                placeholder="Enter username..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={theme.colors.lightGray}
              />
              <TouchableOpacity onPress={handleSearch}>
                <Ionicons name="arrow-forward" size={20} color={theme.colors.forest} />
              </TouchableOpacity>
            </View>
          </View>
          
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              <Text style={styles.resultsTitle}>Search Results</Text>
              {searchResults.map(user => (
                <View key={user.id} style={styles.searchResultItem}>
                  <View style={styles.userInfo}>
                    <View style={styles.searchAvatar}>
                      <Text style={styles.searchAvatarText}>{user.avatar || '👤'}</Text>
                    </View>
                    <View>
                      <Text style={styles.searchName}>{user.displayName}</Text>
                      <Text style={styles.searchUsername}>@{user.username}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handleSendRequest(user.username)}
                  >
                    <Ionicons name="person-add" size={20} color={theme.colors.forest} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          
          <View style={styles.suggestionsSection}>
            <Text style={styles.sectionTitle}>Suggestions</Text>
            <View style={styles.suggestionCard}>
              <Ionicons name="share-social" size={40} color={theme.colors.forest} />
              <Text style={styles.suggestionTitle}>Share Your Username</Text>
              <Text style={styles.suggestionText}>
                Tell your friends to search for your username to connect
              </Text>
              <TouchableOpacity style={styles.shareButton}>
                <Text style={styles.shareButtonText}>Share Username</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      
      {/* Add Friend Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Friend</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.gray} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalLabel}>Enter Username</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="@username"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={theme.colors.lightGray}
            />
            
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                if (searchQuery.trim()) {
                  handleSendRequest(searchQuery);
                }
              }}
            >
              <Text style={styles.modalButtonText}>Send Friend Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  headerButton: {
    marginLeft: 15,
    position: 'relative',
  },
  requestBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.forest,
  },
  tabText: {
    fontSize: 15,
    color: theme.colors.gray,
    fontWeight: '500',
  },
  tabTextActive: {
    color: theme.colors.forest,
  },
  listContainer: {
    padding: 10,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    position: 'relative',
  },
  friendAvatarText: {
    fontSize: 24,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: 'white',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  friendUsername: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
  },
  lastActive: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 2,
  },
  removeButton: {
    padding: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.navy,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 10,
    marginBottom: 30,
    textAlign: 'center',
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  findFriendsContainer: {
    flex: 1,
    padding: 15,
  },
  searchSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 16,
    color: theme.colors.navy,
  },
  searchResults: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gray,
    marginBottom: 10,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchAvatarText: {
    fontSize: 20,
  },
  searchName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  searchUsername: {
    fontSize: 13,
    color: theme.colors.gray,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: theme.colors.forest + '20',
    padding: 8,
    borderRadius: 20,
  },
  suggestionsSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
  },
  suggestionCard: {
    alignItems: 'center',
    padding: 20,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginTop: 10,
  },
  suggestionText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 20,
  },
  shareButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 20,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.gray,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    color: theme.colors.navy,
  },
  modalButton: {
    backgroundColor: theme.colors.forest,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});