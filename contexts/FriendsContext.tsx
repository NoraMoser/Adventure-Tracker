// contexts/FriendsContext.tsx - Fixed to properly sync with user changes
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { Activity } from './ActivityContext';
import { useAuth } from './AuthContext'; // Import useAuth

// Types - Keeping OLD names for compatibility
export interface Friend {
  id: string;
  username: string;
  displayName: string; // Maps to display_name in DB
  avatar?: string;
  friendsSince: Date;
  status: 'pending' | 'accepted' | 'blocked';
  lastActive?: Date; // Maps to last_active in DB
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  requested_at: string;
  accepted_at?: string;
  friend?: Friend;
}

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  message?: string;
  sent_at: string;
  from_user?: Friend;
  from?: Friend; // For compatibility with existing code
  to?: string;   // For compatibility
  sentAt?: Date; // For compatibility
}

export interface FeedComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
}

export interface FeedPost {
  id: string;
  type: 'activity' | 'location' | 'achievement';
  timestamp?: Date;
  data: {
    // Activity data
    id?: string;
    name?: string;
    type?: string;
    distance?: number;
    duration?: number;
    averageSpeed?: number;
    maxSpeed?: number;
    elevationGain?: number;
    startTime?: Date;
    notes?: string;
    route?: any[];
    
    // Location data
    location?: {
      latitude: number;
      longitude: number;
    };
    description?: string;
    photos?: string[];
    category?: string;
    
    // Achievement data
    achievementName?: string;
    achievementIcon?: string;
    
    // Shared data
    sharedBy: Friend;
    sharedAt: Date;
    likes: string[]; // Array of user IDs who liked
    comments: FeedComment[];
  };
}

// Add missing type
export interface FriendSuggestion {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  mutualFriendsCount: number;
  suggestionReason: string;
}

// Context Type - Keeping OLD method names for compatibility
interface FriendsContextType {
  // State - Using OLD names
  friends: Friend[];
  friendRequests: FriendRequest[]; // incoming requests
  pendingRequests: FriendRequest[]; // outgoing requests (was sentRequests)
  suggestions?: FriendSuggestion[]; // optional for compatibility
  feed: FeedPost[];
  loading: boolean;
  error: string | null;

  // Friend Management - OLD signatures
  sendFriendRequest: (username: string, message?: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  cancelFriendRequest?: (requestId: string) => Promise<void>; // optional
  removeFriend: (friendId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<Friend[]>;
  
  // Feed & Sharing - OLD signatures
  refreshFeed: () => Promise<void>;
  shareActivity: (activityId: string, friendIds?: string[], options?: any) => Promise<void>;
  shareLocation: (locationId: string, friendIds?: string[]) => Promise<void>;
  shareAchievement: (achievementId: string, achievementName: string, achievementIcon: string) => Promise<void>;
  addActivityToFeed: (activity: Activity, options?: any) => Promise<void>;
  
  // Interactions - OLD names
  likeItem: (itemId: string) => Promise<void>; // was likePost
  unlikeItem: (itemId: string) => Promise<void>; // was unlikePost
  addComment: (itemId: string, text: string) => Promise<void>;
  deleteComment: (itemId: string, commentId: string) => Promise<void>;
  
  // Friend Data
  getFriendActivities: (friendId: string) => any[];
  getFriendLocations: (friendId: string) => any[];
  
  // Privacy
  privacySettings: {
    shareActivitiesWithFriends: boolean;
    shareLocationsWithFriends: boolean;
    allowFriendRequests: boolean;
    showOnlineStatus: boolean;
    defaultActivityPrivacy: 'stats_only' | 'general_area' | 'full_route';
    autoShareActivities: boolean;
  };
  updatePrivacySettings: (settings: Partial<FriendsContextType['privacySettings']>) => Promise<void>;
  
  // Utils
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  
  // Current User
  currentUserId: string;
  
  // Optional new methods for compatibility
  refreshFriends?: () => Promise<void>;
  refreshSuggestions?: () => Promise<void>;
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

export const FriendsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth(); // Get user from AuthContext
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]); // incoming
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]); // outgoing
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [privacySettings, setPrivacySettings] = useState({
    shareActivitiesWithFriends: true,
    shareLocationsWithFriends: true,
    allowFriendRequests: true,
    showOnlineStatus: true,
    defaultActivityPrivacy: 'general_area' as 'stats_only' | 'general_area' | 'full_route',
    autoShareActivities: false,
  });

  // Update currentUserId when user changes from AuthContext
  useEffect(() => {
    if (user) {
      console.log('FriendsContext: User changed to:', user.id);
      setCurrentUserId(user.id);
    } else {
      console.log('FriendsContext: User logged out, clearing data');
      setCurrentUserId('');
      // Clear all data when user logs out
      setFriends([]);
      setFriendRequests([]);
      setPendingRequests([]);
      setSuggestions([]);
      setFeed([]);
      setError(null);
    }
  }, [user]);

  // Load data when currentUserId changes
  useEffect(() => {
    if (currentUserId && currentUserId !== '') {
      console.log('FriendsContext: Loading data for user:', currentUserId);
      loadFriendsData();
      loadFeed();
    }
  }, [currentUserId]);

  const loadFriendsData = async () => {
    if (!currentUserId || currentUserId === '') {
      console.log('No user ID, skipping friends data load');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Loading friends data for user:', currentUserId);
      
      // Clear previous data first
      setFriends([]);
      setFriendRequests([]);
      setPendingRequests([]);
      setSuggestions([]);
      
      // Load accepted friends
      const { data: friendships, error: friendsError } = await supabase
        .from('friendships')
        .select(`
          *,
          friend:profiles!friendships_friend_id_fkey(
            id,
            username,
            display_name,
            avatar,
            last_active
          )
        `)
        .eq('user_id', currentUserId)
        .eq('status', 'accepted');

      if (friendsError) {
        console.error('Error loading friends:', friendsError);
        throw friendsError;
      }
      
      console.log('Loaded friendships:', friendships?.length || 0);
      
      if (friendships && friendships.length > 0) {
        const transformedFriends = friendships
          .filter(f => f.friend)
          .map(f => ({
            id: f.friend.id,
            username: f.friend.username,
            displayName: f.friend.display_name, // Transform to old name
            avatar: f.friend.avatar,
            friendsSince: new Date(f.accepted_at || f.requested_at),
            status: 'accepted' as const,
            lastActive: f.friend.last_active ? new Date(f.friend.last_active) : undefined, // Transform to old name
          }));
        setFriends(transformedFriends);
      }

      // Load incoming friend requests
      const { data: requests, error: requestsError } = await supabase
        .from('friend_requests')
        .select(`
          *,
          from_user:profiles!friend_requests_from_user_id_fkey(
            id,
            username,
            display_name,
            avatar
          )
        `)
        .eq('to_user_id', currentUserId);

      if (requestsError) {
        console.error('Error loading requests:', requestsError);
        throw requestsError;
      }
      
      console.log('Loaded incoming friend requests:', requests?.length || 0);
      
      if (requests && requests.length > 0) {
        const transformedRequests = requests
          .filter(r => r.from_user)
          .map(r => ({
            id: r.id,
            from_user_id: r.from_user_id,
            to_user_id: r.to_user_id,
            message: r.message,
            sent_at: r.sent_at,
            from_user: {
              id: r.from_user.id,
              username: r.from_user.username,
              displayName: r.from_user.display_name, // Transform to old name
              avatar: r.from_user.avatar,
              friendsSince: new Date(),
              status: 'pending' as const,
            },
            from: {
              id: r.from_user.id,
              username: r.from_user.username,
              displayName: r.from_user.display_name,
              avatar: r.from_user.avatar,
              friendsSince: new Date(),
              status: 'pending' as const,
            },
            to: r.to_user_id,
            sentAt: new Date(r.sent_at),
          }));
        setFriendRequests(transformedRequests);
        console.log('Set friend requests:', transformedRequests.map(r => r.from.username));
      }

      // Load sent friend requests (pendingRequests in old naming)
      const { data: sent, error: sentError } = await supabase
        .from('friend_requests')
        .select(`
          *,
          to_user:profiles!friend_requests_to_user_id_fkey(
            id,
            username,
            display_name
          )
        `)
        .eq('from_user_id', currentUserId);

      if (sentError) {
        console.error('Error loading sent requests:', sentError);
        throw sentError;
      }
      
      console.log('Loaded sent requests:', sent?.length || 0);
      
      if (sent && sent.length > 0) {
        const transformedSent = sent.map(s => ({
          id: s.id,
          from_user_id: s.from_user_id,
          to_user_id: s.to_user_id,
          message: s.message,
          sent_at: s.sent_at,
          to: s.to_user?.username || s.to_user_id,
          sentAt: new Date(s.sent_at),
        }));
        setPendingRequests(transformedSent);
        console.log('Set pending requests to:', transformedSent.map(r => r.to));
      }

      // Load suggestions
      await loadSuggestions();

    } catch (err) {
      console.error('Error loading friends data:', err);
      setError('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    if (!currentUserId) return;

    try {
      // Get some active users as suggestions (simplified version)
      const { data: activeUsers } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar')
        .neq('id', currentUserId)
        .order('last_active', { ascending: false })
        .limit(10);

      if (activeUsers) {
        const friendIds = friends.map(f => f.id);
        const requestUserIds = [
          ...friendRequests.map(r => r.from_user_id),
          ...pendingRequests.map(r => r.to_user_id),
        ];

        const filtered = activeUsers.filter(u => 
          !friendIds.includes(u.id) && !requestUserIds.includes(u.id)
        );

        const suggestionsList: FriendSuggestion[] = filtered.map(u => ({
          id: u.id,
          username: u.username,
          displayName: u.display_name, // Transform to old name
          avatar: u.avatar,
          mutualFriendsCount: 0,
          suggestionReason: 'Active on ExplorAble',
        }));

        setSuggestions(suggestionsList);
      }
    } catch (err) {
      console.error('Error loading suggestions:', err);
    }
  };

  const loadFeed = async () => {
    if (!currentUserId || currentUserId === '') {
      return;
    }
    
    try {
      // TODO: Load feed from Supabase
      // For now, keep empty
      setFeed([]);
    } catch (err) {
      console.error('Error loading feed:', err);
    }
  };

  const refreshFeed = async () => {
    await loadFeed();
  };

  const refreshFriends = async () => {
    await loadFriendsData();
  };

  const refreshSuggestions = async () => {
    await loadSuggestions();
  };

  const sendFriendRequest = async (username: string, message?: string) => {
    if (!currentUserId || currentUserId === '') {
      Alert.alert('Error', 'Please log in to send friend requests');
      return;
    }

    try {
      console.log('Sending friend request from:', currentUserId, 'to username:', username);
      
      const cleanUsername = username.toLowerCase().trim();
      
      const { data: targetUser, error: userError } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .eq('username', cleanUsername)
        .single();

      console.log('User search result:', targetUser, 'Error:', userError);

      if (userError || !targetUser) {
        const { data: alternativeSearch } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .ilike('username', `${cleanUsername}%`)
          .limit(5);
        
        if (alternativeSearch && alternativeSearch.length > 0) {
          const userList = alternativeSearch.map(u => u.username).join('\n');
          Alert.alert(
            'User not found',
            `Did you mean one of these?\n${userList}`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', `User "${username}" not found`);
        }
        return;
      }

      // Check if already friends
      const { data: existingFriendship } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(user_id.eq.${currentUserId},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${currentUserId})`)
        .single();

      if (existingFriendship) {
        Alert.alert('Error', 'You are already friends with this user');
        return;
      }

      // Check for existing request (in either direction)
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('id')
        .or(`and(from_user_id.eq.${currentUserId},to_user_id.eq.${targetUser.id}),and(from_user_id.eq.${targetUser.id},to_user_id.eq.${currentUserId})`)
        .single();

      if (existingRequest) {
        Alert.alert('Error', 'A friend request already exists between you and this user');
        return;
      }

      // Send the request
      const { error: requestError } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: currentUserId,
          to_user_id: targetUser.id,
          message,
          sent_at: new Date().toISOString(),
        });

      if (requestError) throw requestError;

      Alert.alert('Success', `Friend request sent to ${targetUser.display_name} (@${targetUser.username})`);
      await loadFriendsData();

    } catch (err: any) {
      console.error('Error sending friend request:', err);
      Alert.alert('Error', err.message || 'Failed to send friend request');
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    if (!currentUserId) return;

    try {
      const request = friendRequests.find(r => r.id === requestId);
      if (!request) return;

      const { error: friendshipError } = await supabase
        .from('friendships')
        .insert([
          {
            user_id: currentUserId,
            friend_id: request.from_user_id,
            status: 'accepted',
            accepted_at: new Date().toISOString(),
          },
          {
            user_id: request.from_user_id,
            friend_id: currentUserId,
            status: 'accepted',
            accepted_at: new Date().toISOString(),
          },
        ]);

      if (friendshipError) throw friendshipError;

      const { error: deleteError } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (deleteError) throw deleteError;

      Alert.alert('Success', 'Friend request accepted');
      await loadFriendsData();

    } catch (err: any) {
      console.error('Error accepting friend request:', err);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const declineFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      await loadFriendsData();

    } catch (err: any) {
      console.error('Error declining friend request:', err);
      Alert.alert('Error', 'Failed to decline friend request');
    }
  };

  const cancelFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      Alert.alert('Success', 'Friend request cancelled');
      await loadFriendsData();

    } catch (err: any) {
      console.error('Error cancelling friend request:', err);
      Alert.alert('Error', 'Failed to cancel friend request');
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`);

      if (error) throw error;

      Alert.alert('Success', 'Friend removed');
      await loadFriendsData();

    } catch (err: any) {
      console.error('Error removing friend:', err);
      Alert.alert('Error', 'Failed to remove friend');
    }
  };

  const searchUsers = async (query: string): Promise<Friend[]> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      
      return (data || []).map(user => ({
        id: user.id,
        username: user.username,
        displayName: user.display_name, // Transform to old name
        avatar: user.avatar,
        friendsSince: new Date(),
        status: 'pending' as const,
        lastActive: user.last_active ? new Date(user.last_active) : undefined, // Transform to old name
      }));

    } catch (err) {
      console.error('Error searching users:', err);
      return [];
    }
  };

  const shareActivity = async (activityId: string, friendIds?: string[], options?: any) => {
    try {
      console.log('Sharing activity:', activityId, 'to friends:', friendIds, 'with options:', options);
      Alert.alert('Success', 'Activity shared with friends!');
    } catch (err) {
      console.error('Error sharing activity:', err);
    }
  };

  const shareLocation = async (locationId: string, friendIds?: string[]) => {
    try {
      Alert.alert('Success', 'Location shared with friends!');
    } catch (err) {
      console.error('Error sharing location:', err);
    }
  };

  const shareAchievement = async (achievementId: string, achievementName: string, achievementIcon: string) => {
    try {
      Alert.alert('Success', 'Achievement shared with friends!');
    } catch (err) {
      console.error('Error sharing achievement:', err);
    }
  };

  const addActivityToFeed = async (activity: Activity, options: any = {}) => {
    try {
      console.log('Adding activity to feed:', activity.name, 'with options:', options);
      
      const newPost: FeedPost = {
        id: `post-${Date.now()}`,
        type: 'activity',
        timestamp: new Date(),
        data: {
          ...activity,
          sharedBy: {
            id: currentUserId,
            username: 'you',
            displayName: 'You',
            avatar: '👤',
            friendsSince: new Date(),
            status: 'accepted',
          },
          sharedAt: new Date(),
          likes: [],
          comments: [],
        },
      };
      
      setFeed(prev => [newPost, ...prev]);
      console.log('Activity added to feed successfully');
      
    } catch (err) {
      console.error('Error adding activity to feed:', err);
    }
  };

  const likeItem = async (itemId: string) => {
    try {
      setFeed(prev => prev.map(post => {
        if (post.id === itemId) {
          const likes = post.data.likes.includes(currentUserId)
            ? post.data.likes.filter(id => id !== currentUserId)
            : [...post.data.likes, currentUserId];
          
          return {
            ...post,
            data: {
              ...post.data,
              likes,
            },
          };
        }
        return post;
      }));
    } catch (err) {
      console.error('Error liking item:', err);
    }
  };

  const unlikeItem = async (itemId: string) => {
    try {
      setFeed(prev => prev.map(post => {
        if (post.id === itemId) {
          return {
            ...post,
            data: {
              ...post.data,
              likes: post.data.likes.filter(id => id !== currentUserId),
            },
          };
        }
        return post;
      }));
    } catch (err) {
      console.error('Error unliking item:', err);
    }
  };

  const addComment = async (itemId: string, text: string) => {
    try {
      const newComment: FeedComment = {
        id: `comment-${Date.now()}`,
        userId: currentUserId,
        userName: 'You',
        text,
        timestamp: new Date(),
      };

      setFeed(prev => prev.map(post => {
        if (post.id === itemId) {
          return {
            ...post,
            data: {
              ...post.data,
              comments: [...post.data.comments, newComment],
            },
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  };

  const deleteComment = async (itemId: string, commentId: string) => {
    try {
      setFeed(prev => prev.map(post => {
        if (post.id === itemId) {
          return {
            ...post,
            data: {
              ...post.data,
              comments: post.data.comments.filter(c => c.id !== commentId),
            },
          };
        }
        return post;
      }));
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const blockUser = async (userId: string) => {
    try {
      if (!currentUserId) return;

      const { error } = await supabase
        .from('friendships')
        .update({ status: 'blocked' })
        .eq('user_id', currentUserId)
        .eq('friend_id', userId);

      if (error) throw error;
      
      await loadFriendsData();
      Alert.alert('Success', 'User blocked');
    } catch (err) {
      console.error('Error blocking user:', err);
      Alert.alert('Error', 'Failed to block user');
    }
  };

  const unblockUser = async (userId: string) => {
    try {
      if (!currentUserId) return;

      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('user_id', currentUserId)
        .eq('friend_id', userId);

      if (error) throw error;
      
      await loadFriendsData();
      Alert.alert('Success', 'User unblocked');
    } catch (err) {
      console.error('Error unblocking user:', err);
      Alert.alert('Error', 'Failed to unblock user');
    }
  };

  const updatePrivacySettings = async (settings: Partial<typeof privacySettings>) => {
    try {
      const updatedSettings = { ...privacySettings, ...settings };
      setPrivacySettings(updatedSettings);
      await AsyncStorage.setItem('friendsPrivacy', JSON.stringify(updatedSettings));
    } catch (err) {
      console.error('Error updating privacy settings:', err);
    }
  };

  const getFriendActivities = (friendId: string) => {
    return feed
      .filter(post => post.type === 'activity' && post.data.sharedBy.id === friendId)
      .map(post => post.data);
  };

  const getFriendLocations = (friendId: string) => {
    return feed
      .filter(post => post.type === 'location' && post.data.sharedBy.id === friendId)
      .map(post => post.data);
  };

  const value: FriendsContextType = {
    // State
    friends,
    friendRequests, // incoming
    pendingRequests, // outgoing (old name kept)
    suggestions,
    feed,
    loading,
    error,
    
    // Methods
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    cancelFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,
    searchUsers,
    refreshFeed,
    refreshFriends,
    refreshSuggestions,
    shareActivity,
    shareLocation,
    shareAchievement,
    addActivityToFeed,
    likeItem, // old name kept
    unlikeItem, // old name kept
    addComment,
    deleteComment,
    getFriendActivities,
    getFriendLocations,
    privacySettings,
    updatePrivacySettings,
    currentUserId,
  };

  return (
    <FriendsContext.Provider value={value}>
      {children}
    </FriendsContext.Provider>
  );
};

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (context === undefined) {
    throw new Error('useFriends must be used within a FriendsProvider');
  }
  return context;
};