// contexts/FriendsContext.tsx - Enhanced with activity sharing
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Activity } from './ActivityContext';
import { SavedSpot } from './LocationContext';

export interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  friendsSince: Date;
  status: 'pending' | 'accepted' | 'blocked';
  lastActive?: Date;
}

export interface FriendRequest {
  id: string;
  from: Friend;
  to: string;
  sentAt: Date;
  message?: string;
}

export interface SharedActivity extends Activity {
  sharedBy: Friend;
  sharedAt: Date;
  likes: string[];
  comments: Comment[];
  privacySettings?: {
    includeRoute: boolean;
    includeExactLocation: boolean;
  };
}

export interface SharedLocation extends SavedSpot {
  sharedBy: Friend;
  sharedAt: Date;
  likes: string[];
  comments: Comment[];
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
}

export interface FeedItem {
  id: string;
  type: 'activity' | 'location' | 'achievement';
  data: SharedActivity | SharedLocation | AchievementShare;
  timestamp: Date;
}

export interface AchievementShare {
  id: string;
  achievementId: string;
  achievementName: string;
  achievementIcon: string;
  sharedBy: Friend;
  sharedAt: Date;
  likes: string[];
  comments: Comment[];
}

interface FriendsContextType {
  // Friends management
  friends: Friend[];
  friendRequests: FriendRequest[];
  pendingRequests: FriendRequest[];
  
  // Friend actions
  sendFriendRequest: (username: string, message?: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  
  // Sharing
  shareActivity: (activityId: string, friendIds?: string[], options?: any) => Promise<void>;
  shareLocation: (locationId: string, friendIds?: string[]) => Promise<void>;
  shareAchievement: (achievementId: string, achievementName: string, achievementIcon: string) => Promise<void>;
  
  // Feed
  feed: FeedItem[];
  refreshFeed: () => Promise<void>;
  addActivityToFeed: (activity: Activity, options?: any) => Promise<void>;
  
  // Interactions
  likeItem: (itemId: string) => Promise<void>;
  unlikeItem: (itemId: string) => Promise<void>;
  addComment: (itemId: string, text: string) => Promise<void>;
  deleteComment: (itemId: string, commentId: string) => Promise<void>;
  
  // Friend finder
  searchUsers: (query: string) => Promise<Friend[]>;
  getFriendActivities: (friendId: string) => SharedActivity[];
  getFriendLocations: (friendId: string) => SharedLocation[];
  
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
  loading: boolean;
  error: string | null;
  currentUserId: string;
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

// Mock data generator for demo purposes
const generateMockFriends = (): Friend[] => {
  return [
    {
      id: 'friend1',
      username: 'adventurer123',
      displayName: 'Sarah Adventures',
      avatar: '🏔️',
      friendsSince: new Date('2024-01-15'),
      status: 'accepted',
      lastActive: new Date(),
    },
    {
      id: 'friend2',
      username: 'trailblazer',
      displayName: 'Mike Trails',
      avatar: '🥾',
      friendsSince: new Date('2024-02-20'),
      status: 'accepted',
      lastActive: new Date(Date.now() - 3600000),
    },
    {
      id: 'friend3',
      username: 'naturelover',
      displayName: 'Emma Nature',
      avatar: '🌲',
      friendsSince: new Date('2024-03-10'),
      status: 'accepted',
      lastActive: new Date(Date.now() - 86400000),
    },
  ];
};

const generateMockFeed = (friends: Friend[]): FeedItem[] => {
  const now = new Date();
  return [
    {
      id: 'feed1',
      type: 'activity',
      timestamp: new Date(now.getTime() - 3600000),
      data: {
        id: 'act1',
        type: 'hike',
        name: 'Morning Trail Run',
        startTime: new Date(now.getTime() - 7200000),
        endTime: new Date(now.getTime() - 3600000),
        duration: 3600,
        distance: 5000,
        route: [
          { latitude: 47.7231, longitude: -122.1309, timestamp: now.getTime() - 7200000 },
          { latitude: 47.7241, longitude: -122.1319, timestamp: now.getTime() - 6600000 },
          { latitude: 47.7251, longitude: -122.1329, timestamp: now.getTime() - 6000000 },
        ],
        averageSpeed: 5,
        maxSpeed: 8,
        isManualEntry: false,
        sharedBy: friends[0] || {
          id: 'friend1',
          username: 'adventurer123',
          displayName: 'Sarah Adventures',
          avatar: '🏔️',
          friendsSince: new Date(),
          status: 'accepted' as const
        },
        sharedAt: new Date(now.getTime() - 3600000),
        likes: ['friend2', 'friend3'],
        comments: [
          {
            id: 'c1',
            userId: 'friend2',
            userName: 'Mike Trails',
            text: 'Great pace! 💪',
            timestamp: new Date(now.getTime() - 1800000),
          },
        ],
        privacySettings: {
          includeRoute: true,
          includeExactLocation: false,
        }
      } as SharedActivity,
    },
    {
      id: 'feed2',
      type: 'location',
      timestamp: new Date(now.getTime() - 86400000),
      data: {
        id: 'loc1',
        name: 'Hidden Waterfall',
        location: { latitude: 47.7231, longitude: -122.1309 },
        timestamp: new Date(now.getTime() - 86400000),
        category: 'viewpoint',
        description: 'Amazing hidden gem with crystal clear water!',
        photos: [],
        sharedBy: friends[1] || {
          id: 'friend2',
          username: 'trailblazer',
          displayName: 'Mike Trails',
          avatar: '🥾',
          friendsSince: new Date(),
          status: 'accepted' as const
        },
        sharedAt: new Date(now.getTime() - 86400000),
        likes: ['friend1', 'currentUser'],
        comments: [],
      } as SharedLocation,
    },
    {
      id: 'feed3',
      type: 'achievement',
      timestamp: new Date(now.getTime() - 172800000),
      data: {
        id: 'ach1',
        achievementId: 'week_streak',
        achievementName: 'Week Warrior',
        achievementIcon: 'flame',
        sharedBy: friends[2] || {
          id: 'friend3',
          username: 'naturelover',
          displayName: 'Emma Nature',
          avatar: '🌲',
          friendsSince: new Date(),
          status: 'accepted' as const
        },
        sharedAt: new Date(now.getTime() - 172800000),
        likes: ['friend1', 'friend2', 'currentUser'],
        comments: [
          {
            id: 'c2',
            userId: 'friend1',
            userName: 'Sarah Adventures',
            text: 'Congrats on the streak! 🔥',
            timestamp: new Date(now.getTime() - 172000000),
          },
        ],
      } as AchievementShare,
    },
  ];
};

export const FriendsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [privacySettings, setPrivacySettings] = useState({
    shareActivitiesWithFriends: true,
    shareLocationsWithFriends: true,
    allowFriendRequests: true,
    showOnlineStatus: true,
    defaultActivityPrivacy: 'general_area' as 'stats_only' | 'general_area' | 'full_route',
    autoShareActivities: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUserId = 'currentUser'; // In production, this would come from auth

  // Load friends data on mount
  useEffect(() => {
    loadFriendsData();
  }, []);

  const loadFriendsData = async () => {
    try {
      setLoading(true);
      
      // Load friends
      const friendsJson = await AsyncStorage.getItem('friends');
      if (friendsJson) {
        setFriends(JSON.parse(friendsJson));
      } else {
        // Initialize with mock data for demo
        const mockFriends = generateMockFriends();
        setFriends(mockFriends);
        await AsyncStorage.setItem('friends', JSON.stringify(mockFriends));
      }
      
      // Load friend requests
      const requestsJson = await AsyncStorage.getItem('friendRequests');
      if (requestsJson) {
        setFriendRequests(JSON.parse(requestsJson));
      }
      
      // Load privacy settings
      const privacyJson = await AsyncStorage.getItem('friendsPrivacy');
      if (privacyJson) {
        setPrivacySettings(JSON.parse(privacyJson));
      }
      
      // Load feed
      await refreshFeed();
      
    } catch (err) {
      console.error('Error loading friends data:', err);
      setError('Failed to load friends data');
    } finally {
      setLoading(false);
    }
  };

  const saveFriends = async (updatedFriends: Friend[]) => {
    try {
      await AsyncStorage.setItem('friends', JSON.stringify(updatedFriends));
    } catch (err) {
      console.error('Error saving friends:', err);
    }
  };

  const saveFeed = async (updatedFeed: FeedItem[]) => {
    try {
      await AsyncStorage.setItem('friendsFeed', JSON.stringify(updatedFeed));
    } catch (err) {
      console.error('Error saving feed:', err);
    }
  };

  const sendFriendRequest = async (username: string, message?: string) => {
    try {
      // In production, this would make an API call
      // For now, we'll create a mock request
      const newRequest: FriendRequest = {
        id: Date.now().toString(),
        from: {
          id: currentUserId,
          username: 'currentUser',
          displayName: 'You',
          friendsSince: new Date(),
          status: 'pending',
        },
        to: username,
        sentAt: new Date(),
        message,
      };
      
      const updatedPending = [...pendingRequests, newRequest];
      setPendingRequests(updatedPending);
      await AsyncStorage.setItem('pendingRequests', JSON.stringify(updatedPending));
      
      Alert.alert('Success', `Friend request sent to ${username}`);
    } catch (err) {
      console.error('Error sending friend request:', err);
      setError('Failed to send friend request');
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    try {
      const request = friendRequests.find(r => r.id === requestId);
      if (!request) return;
      
      // Add to friends
      const newFriend: Friend = {
        ...request.from,
        status: 'accepted',
        friendsSince: new Date(),
      };
      
      const updatedFriends = [...friends, newFriend];
      setFriends(updatedFriends);
      await saveFriends(updatedFriends);
      
      // Remove from requests
      const updatedRequests = friendRequests.filter(r => r.id !== requestId);
      setFriendRequests(updatedRequests);
      await AsyncStorage.setItem('friendRequests', JSON.stringify(updatedRequests));
      
      Alert.alert('Success', `You are now friends with ${newFriend.displayName}`);
    } catch (err) {
      console.error('Error accepting friend request:', err);
      setError('Failed to accept friend request');
    }
  };

  const declineFriendRequest = async (requestId: string) => {
    try {
      const updatedRequests = friendRequests.filter(r => r.id !== requestId);
      setFriendRequests(updatedRequests);
      await AsyncStorage.setItem('friendRequests', JSON.stringify(updatedRequests));
    } catch (err) {
      console.error('Error declining friend request:', err);
      setError('Failed to decline friend request');
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const updatedFriends = friends.filter(f => f.id !== friendId);
      setFriends(updatedFriends);
      await saveFriends(updatedFriends);
      
      Alert.alert('Success', 'Friend removed');
    } catch (err) {
      console.error('Error removing friend:', err);
      setError('Failed to remove friend');
    }
  };

  const blockUser = async (userId: string) => {
    try {
      const friend = friends.find(f => f.id === userId);
      if (friend) {
        friend.status = 'blocked';
        const updatedFriends = [...friends];
        setFriends(updatedFriends);
        await saveFriends(updatedFriends);
      }
    } catch (err) {
      console.error('Error blocking user:', err);
      setError('Failed to block user');
    }
  };

  const unblockUser = async (userId: string) => {
    try {
      const friend = friends.find(f => f.id === userId);
      if (friend) {
        friend.status = 'accepted';
        const updatedFriends = [...friends];
        setFriends(updatedFriends);
        await saveFriends(updatedFriends);
      }
    } catch (err) {
      console.error('Error unblocking user:', err);
      setError('Failed to unblock user');
    }
  };

  const shareActivity = async (activityId: string, friendIds?: string[], options?: any) => {
    try {
      console.log('Sharing activity:', activityId, 'to friends:', friendIds, 'with options:', options);
      
      // In production, this would post to a server
      Alert.alert('Success', 'Activity shared with friends!');
    } catch (err) {
      console.error('Error sharing activity:', err);
      setError('Failed to share activity');
    }
  };

  const shareLocation = async (locationId: string, friendIds?: string[]) => {
    try {
      // In production, this would post to a server
      Alert.alert('Success', 'Location shared with friends!');
    } catch (err) {
      console.error('Error sharing location:', err);
      setError('Failed to share location');
    }
  };

  const shareAchievement = async (achievementId: string, achievementName: string, achievementIcon: string) => {
    try {
      // In production, this would post to a server
      Alert.alert('Success', 'Achievement shared with friends!');
    } catch (err) {
      console.error('Error sharing achievement:', err);
      setError('Failed to share achievement');
    }
  };

  const addActivityToFeed = async (activity: Activity, options: any = {}) => {
    try {
      console.log('Adding activity to feed:', activity.name, 'with options:', options);
      
      // Create a shared activity for the feed
      const sharedActivity: SharedActivity = {
        ...activity,
        sharedBy: {
          id: currentUserId,
          username: 'currentUser',
          displayName: 'You',
          avatar: '🏃',
          friendsSince: new Date(),
          status: 'accepted',
        },
        sharedAt: new Date(),
        likes: [],
        comments: [],
        privacySettings: {
          includeRoute: options.includeRoute || false,
          includeExactLocation: options.includeExactLocation || false,
        },
      };

      const newFeedItem: FeedItem = {
        id: `feed_${activity.id}_${Date.now()}`,
        type: 'activity',
        timestamp: new Date(),
        data: sharedActivity,
      };

      const updatedFeed = [newFeedItem, ...feed];
      setFeed(updatedFeed);
      await saveFeed(updatedFeed);
      
      console.log('Activity added to feed successfully');
    } catch (err) {
      console.error('Error adding activity to feed:', err);
      setError('Failed to add activity to feed');
    }
  };

  const refreshFeed = async () => {
    try {
      setLoading(true);
      
      // Try to load existing feed first
      const feedJson = await AsyncStorage.getItem('friendsFeed');
      if (feedJson) {
        const storedFeed = JSON.parse(feedJson);
        setFeed(storedFeed);
      } else {
        // Generate mock feed if none exists
        const mockFeed = generateMockFeed(friends.length > 0 ? friends : generateMockFriends());
        setFeed(mockFeed);
        await saveFeed(mockFeed);
      }
    } catch (err) {
      console.error('Error refreshing feed:', err);
      setError('Failed to refresh feed');
    } finally {
      setLoading(false);
    }
  };

  const likeItem = async (itemId: string) => {
    try {
      const updatedFeed = feed.map(item => {
        if (item.id === itemId) {
          const data = item.data as any;
          if (!data.likes.includes(currentUserId)) {
            data.likes.push(currentUserId);
          }
        }
        return item;
      });
      setFeed(updatedFeed);
      await saveFeed(updatedFeed);
    } catch (err) {
      console.error('Error liking item:', err);
    }
  };

  const unlikeItem = async (itemId: string) => {
    try {
      const updatedFeed = feed.map(item => {
        if (item.id === itemId) {
          const data = item.data as any;
          data.likes = data.likes.filter((id: string) => id !== currentUserId);
        }
        return item;
      });
      setFeed(updatedFeed);
      await saveFeed(updatedFeed);
    } catch (err) {
      console.error('Error unliking item:', err);
    }
  };

  const addComment = async (itemId: string, text: string) => {
    try {
      const newComment: Comment = {
        id: Date.now().toString(),
        userId: currentUserId,
        userName: 'You',
        text,
        timestamp: new Date(),
      };
      
      const updatedFeed = feed.map(item => {
        if (item.id === itemId) {
          const data = item.data as any;
          data.comments.push(newComment);
        }
        return item;
      });
      setFeed(updatedFeed);
      await saveFeed(updatedFeed);
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  const deleteComment = async (itemId: string, commentId: string) => {
    try {
      const updatedFeed = feed.map(item => {
        if (item.id === itemId) {
          const data = item.data as any;
          data.comments = data.comments.filter((c: Comment) => c.id !== commentId);
        }
        return item;
      });
      setFeed(updatedFeed);
      await saveFeed(updatedFeed);
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const searchUsers = async (query: string): Promise<Friend[]> => {
    try {
      // In production, this would search a user database
      // For demo, return mock results
      if (query.toLowerCase().includes('john')) {
        return [{
          id: 'search1',
          username: 'johndoe',
          displayName: 'John Doe',
          avatar: '👤',
          friendsSince: new Date(),
          status: 'pending',
        }];
      }
      return [];
    } catch (err) {
      console.error('Error searching users:', err);
      return [];
    }
  };

  const getFriendActivities = (friendId: string): SharedActivity[] => {
    return feed
      .filter(item => item.type === 'activity' && (item.data as SharedActivity).sharedBy.id === friendId)
      .map(item => item.data as SharedActivity);
  };

  const getFriendLocations = (friendId: string): SharedLocation[] => {
    return feed
      .filter(item => item.type === 'location' && (item.data as SharedLocation).sharedBy.id === friendId)
      .map(item => item.data as SharedLocation);
  };

  const updatePrivacySettings = async (settings: Partial<FriendsContextType['privacySettings']>) => {
    try {
      const updatedSettings = { ...privacySettings, ...settings };
      setPrivacySettings(updatedSettings);
      await AsyncStorage.setItem('friendsPrivacy', JSON.stringify(updatedSettings));
    } catch (err) {
      console.error('Error updating privacy settings:', err);
      setError('Failed to update privacy settings');
    }
  };

  const value: FriendsContextType = {
    friends,
    friendRequests,
    pendingRequests,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,
    shareActivity,
    shareLocation,
    shareAchievement,
    feed,
    refreshFeed,
    addActivityToFeed,
    likeItem,
    unlikeItem,
    addComment,
    deleteComment,
    searchUsers,
    getFriendActivities,
    getFriendLocations,
    privacySettings,
    updatePrivacySettings,
    loading,
    error,
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