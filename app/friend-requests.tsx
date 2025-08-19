// app/friend-requests.tsx
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useFriends } from '../contexts/FriendsContext';

export default function FriendRequestsScreen() {
  const { 
    friendRequests, 
    pendingRequests,
    acceptFriendRequest, 
    declineFriendRequest 
  } = useFriends();
  
  const renderRequestItem = ({ item }: any) => {
    const timeAgo = (date: Date) => {
      const now = new Date();
      const diff = now.getTime() - new Date(date).getTime();
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    };
    
    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.from.avatar || '👤'}</Text>
          </View>
          <View style={styles.requestInfo}>
            <Text style={styles.requestName}>{item.from.displayName}</Text>
            <Text style={styles.requestUsername}>@{item.from.username}</Text>
            <Text style={styles.requestTime}>{timeAgo(item.sentAt)}</Text>
          </View>
        </View>
        
        {item.message && (
          <Text style={styles.requestMessage}>{item.message}</Text>
        )}
        
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => acceptFriendRequest(item.id)}
          >
            <Ionicons name="checkmark" size={20} color="white" />
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => declineFriendRequest(item.id)}
          >
            <Ionicons name="close" size={20} color={theme.colors.gray} />
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  const renderPendingItem = ({ item }: any) => {
    return (
      <View style={styles.pendingCard}>
        <View style={styles.pendingInfo}>
          <Text style={styles.pendingLabel}>Sent to</Text>
          <Text style={styles.pendingUsername}>@{item.to}</Text>
          <Text style={styles.pendingTime}>
            {new Date(item.sentAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.pendingStatus}>
          <Ionicons name="time-outline" size={20} color={theme.colors.gray} />
          <Text style={styles.pendingStatusText}>Pending</Text>
        </View>
      </View>
    );
  };
  
  const renderEmptyState = (type: 'received' | 'sent') => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={type === 'received' ? 'mail-outline' : 'send-outline'} 
        size={60} 
        color={theme.colors.lightGray} 
      />
      <Text style={styles.emptyText}>
        {type === 'received' 
          ? 'No friend requests' 
          : 'No pending requests'}
      </Text>
    </View>
  );
  
  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Friend Requests',
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }} 
      />
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Received ({friendRequests.length})
        </Text>
        <FlatList
          data={friendRequests}
          renderItem={renderRequestItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={() => renderEmptyState('received')}
        />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Sent ({pendingRequests.length})
        </Text>
        <FlatList
          data={pendingRequests}
          renderItem={renderPendingItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={() => renderEmptyState('sent')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  section: {
    flex: 1,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 15,
  },
  listContainer: {
    flexGrow: 1,
  },
  requestCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  requestUsername: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
  },
  requestTime: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 2,
  },
  requestMessage: {
    fontSize: 14,
    color: theme.colors.gray,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  acceptButton: {
    backgroundColor: theme.colors.forest,
  },
  declineButton: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  acceptText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  declineText: {
    color: theme.colors.gray,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  pendingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingLabel: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  pendingUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginTop: 2,
  },
  pendingTime: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 2,
  },
  pendingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.offWhite,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  pendingStatusText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginLeft: 5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.lightGray,
    marginTop: 10,
  },
});