// app/friends-feed.tsx
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useFriends } from '../contexts/FriendsContext';
import { useSettings } from '../contexts/SettingsContext';
import { ShareService } from '../services/shareService';

// Share Modal Component for re-sharing items from friends
const ShareFriendItemModal = ({
  visible,
  onClose,
  item,
  onShare,
}: {
  visible: boolean;
  onClose: () => void;
  item: any;
  onShare: (selectedFriends: string[], message?: string) => void;
}) => {
  const { friends } = useFriends();
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [shareMessage, setShareMessage] = useState("");
  const [shareToAll, setShareToAll] = useState(false);

  const toggleFriend = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter((id) => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  const handleShare = () => {
    const friendsToShare = shareToAll
      ? friends.map((f) => f.id)
      : selectedFriends;
    if (friendsToShare.length === 0) {
      Alert.alert(
        "Select Friends",
        "Please select at least one friend to share with"
      );
      return;
    }
    onShare(friendsToShare, shareMessage);
    onClose();
    // Reset state
    setSelectedFriends([]);
    setShareMessage("");
    setShareToAll(false);
  };

  const getItemTitle = () => {
    if (item?.type === 'activity') {
      return `${item.data.sharedBy.displayName}'s ${item.data.type} activity`;
    } else if (item?.type === 'location') {
      return `${item.data.name} (shared by ${item.data.sharedBy.displayName})`;
    } else if (item?.type === 'achievement') {
      return `${item.data.achievementName} achievement`;
    }
    return 'Shared item';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={shareModalStyles.overlay}>
        <View style={shareModalStyles.content}>
          <View style={shareModalStyles.header}>
            <Text style={shareModalStyles.title}>Share with Friends</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <View style={shareModalStyles.itemPreview}>
            <View style={shareModalStyles.previewHeader}>
              <Ionicons
                name={
                  item?.type === 'activity' ? 'fitness' :
                  item?.type === 'location' ? 'location' :
                  'trophy'
                }
                size={20}
                color={theme.colors.forest}
              />
              <Text style={shareModalStyles.previewName}>{getItemTitle()}</Text>
            </View>
          </View>

          <TextInput
            style={shareModalStyles.messageInput}
            placeholder="Add a message (optional)..."
            value={shareMessage}
            onChangeText={setShareMessage}
            multiline
            numberOfLines={3}
            placeholderTextColor={theme.colors.lightGray}
          />

          <View style={shareModalStyles.shareToAll}>
            <Text style={shareModalStyles.shareToAllText}>
              Share with all friends
            </Text>
            <Switch
              value={shareToAll}
              onValueChange={(value: boolean) => setShareToAll(value)}
              trackColor={{
                false: theme.colors.borderGray,
                true: theme.colors.forest,
              }}
            />
          </View>

          {!shareToAll && (
            <ScrollView style={shareModalStyles.friendsList}>
              <Text style={shareModalStyles.friendsTitle}>Select Friends:</Text>
              {friends
                .filter((f) => f.status === "accepted")
                .map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={shareModalStyles.friendItem}
                    onPress={() => toggleFriend(friend.id)}
                  >
                    <View style={shareModalStyles.friendInfo}>
                      <Text style={shareModalStyles.friendAvatar}>
                        {friend.avatar || "👤"}
                      </Text>
                      <Text style={shareModalStyles.friendName}>
                        {friend.displayName}
                      </Text>
                    </View>
                    <Ionicons
                      name={
                        selectedFriends.includes(friend.id)
                          ? "checkbox"
                          : "square-outline"
                      }
                      size={24}
                      color={
                        selectedFriends.includes(friend.id)
                          ? theme.colors.forest
                          : theme.colors.gray
                      }
                    />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          )}

          <View style={shareModalStyles.actions}>
            <TouchableOpacity
              style={shareModalStyles.cancelBtn}
              onPress={onClose}
            >
              <Text style={shareModalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={shareModalStyles.shareBtn}
              onPress={handleShare}
            >
              <Ionicons name="share-social" size={20} color="white" />
              <Text style={shareModalStyles.shareText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const FeedItemCard = ({ item, onLike, onComment, onShare, formatDistance, formatSpeed }: any) => {
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
          <Ionicons name="navigate" size={16} color={theme.colors.gray} />
          <Text style={styles.statText}>{formatDistance(activity.distance)}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="time" size={16} color={theme.colors.gray} />
          <Text style={styles.statText}>{Math.round(activity.duration / 60)}min</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="speedometer" size={16} color={theme.colors.gray} />
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
        <Ionicons name="pin" size={14} color={theme.colors.gray} />
        <Text style={styles.coordsText}>
          {location.location.latitude.toFixed(4)}, {location.location.longitude.toFixed(4)}
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
      <Text style={styles.achievementText}>Achievement Unlocked! 🎉</Text>
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
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.data.sharedBy.avatar || '👤'}
            </Text>
          </View>
          <View style={styles.userText}>
            <Text style={styles.userName}>{item.data.sharedBy.displayName}</Text>
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
      
      {/* Content */}
      <View style={styles.cardContent}>
        {item.type === 'activity' && renderActivityContent(item.data)}
        {item.type === 'location' && renderLocationContent(item.data)}
        {item.type === 'achievement' && renderAchievementContent(item.data)}
      </View>
      
      {/* Actions */}
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
      
      {/* Comments Section */}
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [itemToShare, setItemToShare] = useState<any>(null);
  
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
    console.log('handleShare called with item:', item);
    
    // Check if user has friends to share with
    if (friends.filter((f) => f.status === "accepted").length === 0) {
      Alert.alert(
        "No Friends Yet",
        "Add some friends to share content with them!",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Find Friends", onPress: () => router.push("/friends") },
        ]
      );
      return;
    }

    // For now, let's try different sharing methods based on item type
    if (item.type === 'location') {
      // Share as location using existing ShareService
      handleShareLocation(item.data);
    } else if (item.type === 'activity') {
      // Share as activity using existing ShareService  
      handleShareActivity(item.data);
    } else {
      // For other types or re-sharing, use the modal
      setItemToShare(item);
      setShowShareModal(true);
    }
  };

  const handleShareLocation = async (location: any) => {
    try {
      if (location.photos && location.photos.length > 0) {
        await ShareService.shareLocationWithPhotos(location);
      } else {
        await ShareService.shareLocation(location);
      }
    } catch (error) {
      console.error("Error sharing location:", error);
      Alert.alert("Error", "Failed to share location");
    }
  };

  const handleShareActivity = async (activity: any) => {
    try {
      await ShareService.shareActivity?.(activity) || ShareService.shareLocation(activity);
    } catch (error) {
      console.error("Error sharing activity:", error);
      Alert.alert("Error", "Failed to share activity");
    }
  };

  const handleShareToFriends = async (
    selectedFriends: string[],
    message?: string
  ) => {
    try {
      // This would typically send to your backend
      // For now, just show success
      Alert.alert("Success", "Content shared with friends!");
      setShowShareModal(false);
      setItemToShare(null);
    } catch (error) {
      Alert.alert("Error", "Failed to share with friends");
    }
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
      
      {/* Friends Online Bar */}
      {friends.length > 0 && (
        <View style={styles.onlineBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {friends.filter(f => f.status === 'accepted').map(friend => {
              const isOnline = friend.lastActive && 
                (new Date().getTime() - new Date(friend.lastActive).getTime()) < 300000; // 5 minutes
              
              return (
                <TouchableOpacity 
                  key={friend.id}
                  style={styles.onlineFriend}
                  onPress={() => router.push(`/friend-profile/${friend.id}`)}
                >
                  <View style={styles.onlineAvatar}>
                    <Text style={styles.onlineAvatarText}>{friend.avatar || '👤'}</Text>
                    {isOnline && <View style={styles.onlineIndicator} />}
                  </View>
                  <Text style={styles.onlineName}>{friend.displayName.split(' ')[0]}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
      
      {/* Filter Tabs */}
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
      
      {/* Feed */}
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

      {/* Share Modal */}
      <ShareFriendItemModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        item={itemToShare}
        onShare={handleShareToFriends}
      />
    </View>
  );
}

// Share Modal Styles
const shareModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
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
  itemPreview: {
    backgroundColor: theme.colors.offWhite,
    margin: 20,
    padding: 15,
    borderRadius: 12,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  previewName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginLeft: 8,
  },
  messageInput: {
    backgroundColor: theme.colors.offWhite,
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    color: theme.colors.navy,
    minHeight: 80,
    textAlignVertical: "top",
  },
  shareToAll: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
  },
  shareToAllText: {
    fontSize: 16,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  friendsList: {
    maxHeight: 200,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  friendsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
    marginBottom: 10,
  },
  friendItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  friendInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendAvatar: {
    fontSize: 20,
    marginRight: 10,
  },
  friendName: {
    fontSize: 14,
    color: theme.colors.navy,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
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
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: theme.colors.forest,
  },
  shareText: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
});

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
  onlineBar: {
    backgroundColor: 'white',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  onlineFriend: {
    alignItems: 'center',
    marginHorizontal: 10,
  },
  onlineAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  onlineAvatarText: {
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
  onlineName: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 5,
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
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 20,
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
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    marginBottom: 10,
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
  },
  coordsText: {
    fontSize: 12,
    color: theme.colors.gray,
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
    backgroundColor: theme.colors.offWhite,
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
  },
  comment: {
    marginBottom: 10,
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
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 14,
    color: theme.colors.navy,
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