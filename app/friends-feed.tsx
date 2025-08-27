import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { theme } from '../constants/theme';
import { useFriends } from '../contexts/FriendsContext';
import { useSettings } from '../contexts/SettingsContext';

// Reusable Avatar Component
const UserAvatar = ({ 
  user, 
  size = 40, 
  style = {} 
}: { 
  user: any; 
  size?: number; 
  style?: any;
}) => {
  if (user?.profile_picture) {
    return (
      <Image 
        source={{ uri: user.profile_picture }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#f0f0f0',
          },
          style
        ]}
        onError={(e) => {
          console.log('Error loading profile picture:', e.nativeEvent.error);
        }}
      />
    );
  }
  
  if (user?.avatar) {
    return (
      <View style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: 'white',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.borderGray,
        },
        style
      ]}>
        <Text style={{ fontSize: size * 0.6 }}>{user.avatar}</Text>
      </View>
    );
  }
  
  return (
    <View style={[
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.lightGray + '30',
        justifyContent: 'center',
        alignItems: 'center',
      },
      style
    ]}>
      <Ionicons 
        name="person" 
        size={size * 0.6} 
        color={theme.colors.gray} 
      />
    </View>
  );
};

// Feed Item Card Component
const FeedItemCard = ({ 
  item, 
  onLike, 
  onComment, 
  onShare, 
  formatDistance, 
  formatSpeed 
}: any) => {
  const { currentUserId } = useFriends();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  
  const isLiked = item.data.likes.includes(currentUserId);
  const likesCount = item.data.likes.length;
  const commentsCount = item.data.comments.length;
  
  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };
  
  const renderActivityContent = (activity: any) => (
    <View style={styles.activityContent}>
      <View style={styles.activityStats}>
        <View style={styles.statItem}>
          <Ionicons name="navigate" size={16} color={theme.colors.forest} />
          <Text style={styles.statText}>{formatDistance(activity.distance)}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="time" size={16} color={theme.colors.forest} />
          <Text style={styles.statText}>{Math.round(activity.duration / 60)}min</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="speedometer" size={16} color={theme.colors.forest} />
          <Text style={styles.statText}>{formatSpeed(activity.averageSpeed)}</Text>
        </View>
      </View>
      {activity.notes && (
        <Text style={styles.notes}>{activity.notes}</Text>
      )}
    </View>
  );
  
  const renderLocationContent = (location: any) => (
    <View style={styles.locationContent}>
      <Text style={styles.locationName}>{location.name}</Text>
      {location.description && (
        <Text style={styles.locationDescription}>{location.description}</Text>
      )}
      {location.photos && location.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {location.photos.slice(0, 3).map((photo: string, index: number) => (
            <Image key={index} source={{ uri: photo }} style={styles.locationPhoto} />
          ))}
        </ScrollView>
      )}
      <View style={styles.locationCoords}>
        <Ionicons name="location" size={14} color={theme.colors.burntOrange} />
        <Text style={styles.coordsText}>
          {location.location?.latitude?.toFixed(4)}, {location.location?.longitude?.toFixed(4)}
        </Text>
      </View>
    </View>
  );
  
  const renderAchievementContent = (achievement: any) => (
    <View style={styles.achievementContent}>
      <View style={styles.achievementBadge}>
        <Ionicons name={achievement.achievementIcon as any} size={40} color="#FFD700" />
      </View>
      <Text style={styles.achievementName}>{achievement.achievementName}</Text>
      <Text style={styles.achievementText}>Achievement Unlocked!</Text>
    </View>
  );
  
  const getActivityIcon = (type: string) => {
    const icons: any = {
      bike: 'bicycle',
      run: 'walk',
      walk: 'footsteps',
      hike: 'trail-sign',
      paddleboard: 'boat',
      climb: 'trending-up',
      other: 'fitness',
    };
    return icons[type] || 'fitness';
  };
  
  return (
    <View style={styles.feedCard}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <UserAvatar user={item.data.sharedBy} size={40} />
          <View style={styles.userText}>
            <Text style={styles.userName}>
              {item.data.sharedBy.displayName || item.data.sharedBy.display_name}
            </Text>
            <Text style={styles.timeAgo}>{getTimeAgo(item.data.sharedAt)}</Text>
          </View>
        </View>
        {item.type === 'activity' && (
          <View style={[styles.activityTypeBadge, { backgroundColor: theme.colors.forest + '20' }]}>
            <Ionicons name={getActivityIcon(item.data.type)} size={16} color={theme.colors.forest} />
            <Text style={[styles.activityTypeText, { color: theme.colors.forest }]}>
              {item.data.type}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.cardContent}>
        {item.type === 'activity' && renderActivityContent(item.data)}
        {item.type === 'location' && renderLocationContent(item.data)}
        {item.type === 'achievement' && renderAchievementContent(item.data)}
      </View>
      
      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onLike(item.id, !isLiked)}
        >
          <Ionicons 
            name={isLiked ? 'heart' : 'heart-outline'} 
            size={20} 
            color={isLiked ? '#FF4757' : theme.colors.gray} 
          />
          <Text style={[styles.actionText, isLiked && { color: '#FF4757' }]}>
            {likesCount > 0 ? likesCount : 'Like'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowComments(!showComments)}
        >
          <Ionicons name="chatbubble-outline" size={20} color={theme.colors.gray} />
          <Text style={styles.actionText}>
            {commentsCount > 0 ? commentsCount : 'Comment'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onShare(item)}
        >
          <Ionicons name="share-social-outline" size={20} color={theme.colors.gray} />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
      
      {showComments && (
        <View style={styles.commentsSection}>
          {item.data.comments.map((comment: any) => (
            <View key={comment.id} style={styles.comment}>
              <Text style={styles.commentUser}>{comment.userName}</Text>
              <Text style={styles.commentText}>{comment.text}</Text>
              <Text style={styles.commentTime}>{getTimeAgo(comment.timestamp)}</Text>
            </View>
          ))}
          
          <View style={styles.addCommentContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              value={commentText}
              onChangeText={setCommentText}
              placeholderTextColor={theme.colors.lightGray}
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={() => {
                if (commentText.trim()) {
                  onComment(item.id, commentText);
                  setCommentText('');
                }
              }}
            >
              <Ionicons name="send" size={20} color={theme.colors.forest} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default function FriendsFeedScreen() {
  const router = useRouter();
  const { 
    feed, 
    friends,
    friendRequests,
    refreshFeed, 
    likeItem, 
    unlikeItem, 
    addComment,
    loading 
  } = useFriends();
  const { formatDistance, formatSpeed } = useSettings();
  
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'activities' | 'locations' | 'achievements'>('all');
  
  useEffect(() => {
    refreshFeed();
  }, []);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshFeed();
    setRefreshing(false);
  };
  
  const handleLike = (itemId: string, shouldLike: boolean) => {
    if (shouldLike) {
      likeItem(itemId);
    } else {
      unlikeItem(itemId);
    }
  };
  
  const handleComment = (itemId: string, text: string) => {
    addComment(itemId, text);
  };
  
  const handleShare = (item: any) => {
    Alert.alert('Share', 'Sharing functionality coming soon!');
  };
  
  const filteredFeed = feed.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'activities') return item.type === 'activity';
    if (filter === 'locations') return item.type === 'location';
    if (filter === 'achievements') return item.type === 'achievement';
    return true;
  });
  
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={80} color={theme.colors.lightGray} />
      <Text style={styles.emptyTitle}>No Activity Yet</Text>
      <Text style={styles.emptyText}>
        The adventures of your friends will appear here
      </Text>
      <TouchableOpacity 
        style={styles.findFriendsButton}
        onPress={() => router.push('/friends')}
      >
        <Text style={styles.findFriendsText}>Find Friends</Text>
      </TouchableOpacity>
    </View>
  );
  
  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Friends Feed',
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
                onPress={() => router.push('/friends')}
              >
                <Ionicons name="people" size={24} color="white" />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />
      
      {friends.length > 0 && (
        <View style={styles.onlineBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {friends.filter(f => f.status === 'accepted').map(friend => {
              const isOnline = friend.lastActive && 
                (new Date().getTime() - new Date(friend.lastActive).getTime()) < 300000;
              
              return (
                <TouchableOpacity 
                  key={friend.id}
                  style={styles.onlineFriend}
                  onPress={() => router.push(`/friend-profile/${friend.id}`)}
                >
                  <View style={styles.onlineAvatar}>
                    <UserAvatar user={friend} size={46} />
                    {isOnline && <View style={styles.onlineIndicator} />}
                  </View>
                  <Text style={styles.onlineName}>
                    {(friend.displayName || friend.displayName || friend.username).split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
      
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'activities' && styles.filterTabActive]}
          onPress={() => setFilter('activities')}
        >
          <Text style={[styles.filterTabText, filter === 'activities' && styles.filterTabTextActive]}>
            Activities
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'locations' && styles.filterTabActive]}
          onPress={() => setFilter('locations')}
        >
          <Text style={[styles.filterTabText, filter === 'locations' && styles.filterTabTextActive]}>
            Places
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'achievements' && styles.filterTabActive]}
          onPress={() => setFilter('achievements')}
        >
          <Text style={[styles.filterTabText, filter === 'achievements' && styles.filterTabTextActive]}>
            Achievements
          </Text>
        </TouchableOpacity>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.forest} />
        </View>
      ) : (
        <FlatList
          data={filteredFeed}
          renderItem={({ item }) => (
            <FeedItemCard
              item={item}
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
              formatDistance={formatDistance}
              formatSpeed={formatSpeed}
            />
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={filteredFeed.length === 0 ? styles.emptyContainer : styles.feedContainer}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.forest}
              colors={[theme.colors.forest]}
            />
          }
        />
      )}
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
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  requestBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  onlineBar: {
    backgroundColor: theme.colors.forest + '15',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.forest + '20',
  },
  onlineFriend: {
    alignItems: 'center',
    marginHorizontal: 10,
  },
  onlineAvatar: {
    position: 'relative',
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
  onlineName: {
    fontSize: 12,
    color: theme.colors.navy,
    marginTop: 5,
    fontWeight: '500',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 5,
    backgroundColor: theme.colors.offWhite,
  },
  filterTabActive: {
    backgroundColor: theme.colors.forest,
  },
  filterTabText: {
    fontSize: 14,
    color: theme.colors.gray,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: 'white',
  },
  feedContainer: {
    padding: 10,
  },
  feedCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: theme.colors.offWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userText: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  timeAgo: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  activityTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  activityTypeText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 5,
  },
  cardContent: {
    padding: 15,
  },
  activityContent: {},
  activityStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: theme.colors.forest + '08',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.forest + '15',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 5,
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: '500',
  },
  notes: {
    fontSize: 14,
    color: theme.colors.gray,
    fontStyle: 'italic',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  locationContent: {},
  locationName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 5,
  },
  locationDescription: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: 10,
    lineHeight: 20,
  },
  photoScroll: {
    marginVertical: 10,
  },
  locationPhoto: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 10,
  },
  locationCoords: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: theme.colors.burntOrange + '10',
    padding: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  coordsText: {
    fontSize: 12,
    color: theme.colors.navy,
    marginLeft: 5,
    fontFamily: 'monospace',
  },
  achievementContent: {
    alignItems: 'center',
    padding: 20,
  },
  achievementBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.forest + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  achievementName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 5,
  },
  achievementText: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    backgroundColor: theme.colors.offWhite,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 5,
  },
  actionText: {
    marginLeft: 5,
    fontSize: 14,
    color: theme.colors.gray,
  },
  commentsSection: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    backgroundColor: theme.colors.offWhite,
  },
  comment: {
    marginBottom: 10,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  commentText: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
  },
  commentTime: {
    fontSize: 11,
    color: theme.colors.lightGray,
    marginTop: 2,
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 14,
    color: theme.colors.navy,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  sendButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  findFriendsButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  findFriendsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});