// app/friends.tsx - Complete file with unfriend and block options
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../constants/theme";
import { useAuth } from "../contexts/AuthContext";
import {
  Friend,
  FriendRequest,
  FriendSuggestion,
  useFriends,
} from "../contexts/FriendsContext";

const UserAvatar = ({
  user,
  size = 40,
  style = {},
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
            backgroundColor: "#f0f0f0",
          },
          style,
        ]}
        onError={(e) => {
          console.log("Error loading profile picture:", e.nativeEvent.error);
        }}
      />
    );
  }

  if (user?.avatar) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "white",
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 1,
            borderColor: theme.colors.borderGray,
          },
          style,
        ]}
      >
        <Text style={{ fontSize: size * 0.6 }}>{user.avatar}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.lightGray + "30",
          justifyContent: "center",
          alignItems: "center",
        },
        style,
      ]}
    >
      <Ionicons name="person" size={size * 0.6} color={theme.colors.gray} />
    </View>
  );
};

// Friend Options Modal Component
const FriendOptionsModal = ({
  visible,
  friend,
  onClose,
  onUnfriend,
  onBlock,
  onViewProfile,
}: {
  visible: boolean;
  friend: Friend | null;
  onClose: () => void;
  onUnfriend: () => void;
  onBlock: () => void;
  onViewProfile: () => void;
}) => {
  if (!friend) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={optionStyles.overlay}>
        <View style={optionStyles.container}>
          <View style={optionStyles.header}>
            <View style={optionStyles.headerInfo}>
              <UserAvatar user={friend} size={32} style={{ marginRight: 12 }} />
              <View>
                <Text style={optionStyles.name}>{friend.displayName}</Text>
                <Text style={optionStyles.username}>@{friend.username}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <View style={optionStyles.options}>
            <TouchableOpacity
              style={optionStyles.option}
              onPress={onViewProfile}
            >
              <Ionicons
                name="person-outline"
                size={24}
                color={theme.colors.navy}
              />
              <Text style={optionStyles.optionText}>View Profile</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.lightGray}
              />
            </TouchableOpacity>

            <TouchableOpacity style={optionStyles.option} onPress={onUnfriend}>
              <Ionicons
                name="person-remove-outline"
                size={24}
                color={theme.colors.burntOrange}
              />
              <Text
                style={[
                  optionStyles.optionText,
                  { color: theme.colors.burntOrange },
                ]}
              >
                Unfriend
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.lightGray}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[optionStyles.option, optionStyles.dangerOption]}
              onPress={onBlock}
            >
              <Ionicons name="ban-outline" size={24} color="#FF4757" />
              <Text style={[optionStyles.optionText, { color: "#FF4757" }]}>
                Block User
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.lightGray}
              />
            </TouchableOpacity>
          </View>

          <Text style={optionStyles.warning}>
            Blocking will remove this person from your friends and prevent them
            from sending you requests.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

// Friend Item Component
const FriendItem: React.FC<{
  friend: Friend;
  onPress: () => void;
  onOptions: () => void;
}> = ({ friend, onPress, onOptions }) => {
  const getLastActiveText = (lastActive?: Date) => {
    if (!lastActive) return "Offline";

    const now = new Date();
    const diff = now.getTime() - lastActive.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 5) return "Online now";
    if (hours < 1) return `${minutes}m ago`;
    if (days < 1) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  };

  const isOnline =
    friend.lastActive &&
    new Date().getTime() - friend.lastActive.getTime() < 300000;

  return (
    <TouchableOpacity style={styles.friendCard} onPress={onPress}>
      <View style={styles.friendAvatar}>
        <UserAvatar user={friend} size={50} />
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{friend.displayName}</Text>
        <Text style={styles.friendUsername}>@{friend.username}</Text>
        <Text style={styles.lastActive}>
          {getLastActiveText(friend.lastActive)}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.moreButton}
        onPress={onOptions}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name="ellipsis-vertical"
          size={20}
          color={theme.colors.gray}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

// Request Item Component
const RequestItem: React.FC<{
  request: FriendRequest;
  type: "incoming" | "outgoing";
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}> = ({ request, type, onAccept, onDecline, onCancel }) => {
  let user: any = null;
  let displayName = "";
  let username = "";
  let avatar = "";

  if (type === "incoming") {
    if (request.from) {
      user = request.from;
      displayName = user.displayName;
      username = user.username;
      avatar = user.avatar;
    } else if (request.from_user) {
      user = request.from_user;
      displayName = user.displayName || user.display_name || "Unknown";
      username = user.username;
      avatar = user.avatar;
    }
  } else {
    username = request.to || "Unknown";
    displayName = username;
  }

  const sentAt =
    request.sentAt ||
    (request.sent_at ? new Date(request.sent_at) : new Date());

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestAvatar}>
          <UserAvatar user={user} size={45} />
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.requestName}>{displayName}</Text>
          <Text style={styles.requestUsername}>@{username}</Text>
          <Text style={styles.requestTime}>{sentAt.toLocaleDateString()}</Text>
        </View>
      </View>

      {request.message && (
        <Text style={styles.requestMessage}>&quot;{request.message}&quot;</Text>
      )}

      <View style={styles.requestActions}>
        {type === "incoming" ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={onAccept}
            >
              <Ionicons name="checkmark" size={18} color="white" />
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={onDecline}
            >
              <Ionicons name="close" size={18} color={theme.colors.gray} />
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={onCancel}
          >
            <Text style={styles.cancelText}>Cancel Request</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// Suggestion Card Component
const SuggestionCard: React.FC<{
  suggestion: FriendSuggestion;
  onAddFriend: () => void;
}> = ({ suggestion, onAddFriend }) => {
  return (
    <View style={styles.suggestionCard}>
      <View style={styles.suggestionAvatar}>
        <UserAvatar user={suggestion} size={50} />
      </View>

      <Text style={styles.suggestionName} numberOfLines={1}>
        {suggestion.displayName}
      </Text>
      <Text style={styles.suggestionUsername} numberOfLines={1}>
        @{suggestion.username}
      </Text>
      <Text style={styles.suggestionReason} numberOfLines={2}>
        {suggestion.suggestionReason}
      </Text>

      <TouchableOpacity
        style={styles.suggestionAddButton}
        onPress={onAddFriend}
      >
        <Ionicons name="person-add" size={16} color="white" />
      </TouchableOpacity>
    </View>
  );
};

// Main Friends Screen
export default function FriendsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const {
    friends,
    friendRequests,
    pendingRequests,
    suggestions,
    loading,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    cancelFriendRequest,
    removeFriend,
    blockUser,
    searchUsers,
    refreshFriends,
    refreshSuggestions,
  } = useFriends();

  const [selectedTab, setSelectedTab] = useState<
    "friends" | "requests" | "find"
  >("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUsername, setAddUsername] = useState("");
  const [addMessage, setAddMessage] = useState("");
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  useEffect(() => {
    if (refreshFriends) {
      refreshFriends();
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (refreshFriends) {
      await refreshFriends();
    }
    if (selectedTab === "find" && refreshSuggestions) {
      await refreshSuggestions();
    }
    setRefreshing(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    const results = await searchUsers(searchQuery);
    setSearchResults(results);
    setIsSearching(false);

    if (results.length === 0) {
      Alert.alert("No Results", "No users found matching your search");
    }
  };

  const handleSendRequest = async (username: string, message?: string) => {
    await sendFriendRequest(username, message);
    setAddUsername("");
    setAddMessage("");
    setShowAddModal(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleFriendOptions = (friend: Friend) => {
    setSelectedFriend(friend);
    setShowOptionsModal(true);
  };

  const handleUnfriend = () => {
    if (!selectedFriend) return;

    Alert.alert(
      "Unfriend",
      `Remove ${selectedFriend.displayName} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unfriend",
          style: "destructive",
          onPress: () => {
            removeFriend(selectedFriend.id);
            setShowOptionsModal(false);
            setSelectedFriend(null);
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    if (!selectedFriend) return;

    Alert.alert(
      "Block User",
      `Block ${selectedFriend.displayName}? They won't be able to send you friend requests or see your shared content.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            blockUser(selectedFriend.id);
            setShowOptionsModal(false);
            setSelectedFriend(null);
          },
        },
      ]
    );
  };

  const handleViewProfile = () => {
    if (!selectedFriend) return;
    setShowOptionsModal(false);
    router.push(`/friend-profile/${selectedFriend.id}` as any);
  };

  const handleCancelRequest = async (requestId: string) => {
    if (cancelFriendRequest) {
      await cancelFriendRequest(requestId);
    } else {
      await declineFriendRequest(requestId);
    }
  };

  const handleInviteFriends = () => {
    const inviteMessage = `Hey! I've been using explorAble to track my outdoor adventures and save cool spots. Join me on the app!`;

    const androidLink =
      "https://play.google.com/store/apps/details?id=com.moser.explorable";
    const iosLink = "https://apps.apple.com/app/id6754299925";

    if (Platform.OS === "android") {
      // Android: Include link in the message
      Share.share({
        message: `${inviteMessage}\n\n${androidLink}`,
        title: "Join me on explorAble!",
      });
    } else {
      // iOS: Use url parameter
      Share.share({
        message: inviteMessage,
        url: iosLink,
        title: "Join me on explorAble!",
      });
    }
  };

  const renderFriendsTab = () => (
    <FlatList
      data={friends}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <FriendItem
          friend={item}
          onPress={() => router.push(`/friend-profile/${item.id}` as any)}
          onOptions={() => handleFriendOptions(item)}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.forest}
        />
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons
            name="people-outline"
            size={60}
            color={theme.colors.lightGray}
          />
          <Text style={styles.emptyTitle}>No Friends Yet</Text>
          <Text style={styles.emptyText}>
            Add friends to share your adventures!
          </Text>
          <TouchableOpacity
            style={styles.addFirstButton}
            onPress={() => setSelectedTab("find")}
          >
            <Text style={styles.addFirstText}>Find Friends</Text>
          </TouchableOpacity>
        </View>
      }
      contentContainerStyle={
        friends.length === 0 ? styles.emptyContainer : styles.listContainer
      }
    />
  );

  const renderRequestsTab = () => (
    <ScrollView
      style={styles.requestsContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.forest}
        />
      }
    >
      {friendRequests.length > 0 && (
        <View style={styles.requestSection}>
          <Text style={styles.requestSectionTitle}>
            Incoming Requests ({friendRequests.length})
          </Text>
          {friendRequests.map((request: FriendRequest) => (
            <RequestItem
              key={request.id}
              request={request}
              type="incoming"
              onAccept={() => acceptFriendRequest(request.id)}
              onDecline={() => declineFriendRequest(request.id)}
            />
          ))}
        </View>
      )}

      {pendingRequests.length > 0 && (
        <View style={styles.requestSection}>
          <Text style={styles.requestSectionTitle}>
            Sent Requests ({pendingRequests.length})
          </Text>
          {pendingRequests.map((request: FriendRequest) => (
            <RequestItem
              key={request.id}
              request={request}
              type="outgoing"
              onCancel={() => handleCancelRequest(request.id)}
            />
          ))}
        </View>
      )}

      {friendRequests.length === 0 && pendingRequests.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons
            name="mail-outline"
            size={60}
            color={theme.colors.lightGray}
          />
          <Text style={styles.emptyTitle}>No Friend Requests</Text>
          <Text style={styles.emptyText}>
            When someone sends you a friend request, it will appear here
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderFindTab = () => (
    <ScrollView
      style={styles.findContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.forest}
        />
      }
    >
      {/* Search Section */}
      <View style={styles.searchSection}>
        <Text style={styles.sectionTitle}>Search Users</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.colors.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            placeholderTextColor={theme.colors.lightGray}
          />
          <TouchableOpacity onPress={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <ActivityIndicator size="small" color={theme.colors.forest} />
            ) : (
              <Ionicons
                name="arrow-forward"
                size={20}
                color={theme.colors.forest}
              />
            )}
          </TouchableOpacity>
        </View>

        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.searchResult}
                onPress={() => handleSendRequest(user.username)}
              >
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultAvatar}>
                    {user.avatar || "👤"}
                  </Text>
                  <View>
                    <Text style={styles.searchResultName}>
                      {user.displayName}
                    </Text>
                    <Text style={styles.searchResultUsername}>
                      @{user.username}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name="person-add"
                  size={20}
                  color={theme.colors.forest}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Suggestions Section */}
      {suggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>People You May Know</Text>
            {refreshSuggestions && (
              <TouchableOpacity onPress={refreshSuggestions}>
                <Ionicons
                  name="refresh"
                  size={20}
                  color={theme.colors.forest}
                />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionsScroll}
          >
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onAddFriend={() => handleSendRequest(suggestion.username)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Invite Section */}
      <View style={styles.shareSection}>
        <Ionicons name="gift" size={40} color={theme.colors.forest} />
        <Text style={styles.shareTitle}>Invite Friends to explorAble</Text>
        <Text style={styles.shareText}>
          Share the app with friends and start exploring together!
        </Text>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleInviteFriends}
        >
          <Ionicons name="send" size={18} color="white" />
          <Text style={[styles.shareButtonText, { marginLeft: 8 }]}>
            Send Invite
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Friends",
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          headerRight: () => (
            <View style={styles.headerRight}>
              {friendRequests.length > 0 && (
                <View style={styles.requestBadge}>
                  <Text style={styles.requestBadgeText}>
                    {friendRequests.length}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowAddModal(true)}
              >
                <Ionicons name="person-add" size={24} color="white" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === "friends" && styles.tabActive]}
          onPress={() => setSelectedTab("friends")}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "friends" && styles.tabTextActive,
            ]}
          >
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === "requests" && styles.tabActive]}
          onPress={() => setSelectedTab("requests")}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "requests" && styles.tabTextActive,
            ]}
          >
            Requests
          </Text>
          {friendRequests.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{friendRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === "find" && styles.tabActive]}
          onPress={() => setSelectedTab("find")}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "find" && styles.tabTextActive,
            ]}
          >
            Find
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.forest} />
        </View>
      ) : (
        <>
          {selectedTab === "friends" && renderFriendsTab()}
          {selectedTab === "requests" && renderRequestsTab()}
          {selectedTab === "find" && renderFindTab()}
        </>
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

            <Text style={styles.modalLabel}>Username</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter username"
              value={addUsername}
              onChangeText={setAddUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={theme.colors.lightGray}
            />

            <Text style={styles.modalLabel}>Message (optional)</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Add a personal message..."
              value={addMessage}
              onChangeText={setAddMessage}
              multiline
              numberOfLines={3}
              placeholderTextColor={theme.colors.lightGray}
            />

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => handleSendRequest(addUsername, addMessage)}
              disabled={!addUsername.trim()}
            >
              <Text style={styles.modalButtonText}>Send Friend Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Friend Options Modal */}
      <FriendOptionsModal
        visible={showOptionsModal}
        friend={selectedFriend}
        onClose={() => {
          setShowOptionsModal(false);
          setSelectedFriend(null);
        }}
        onUnfriend={handleUnfriend}
        onBlock={handleBlockUser}
        onViewProfile={handleViewProfile}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  headerButton: {
    marginLeft: 15,
  },
  requestBadge: {
    position: "absolute",
    top: -5,
    right: 10,
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  requestBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.forest,
  },
  tabText: {
    fontSize: 15,
    color: theme.colors.gray,
    fontWeight: "500",
  },
  tabTextActive: {
    color: theme.colors.forest,
  },
  tabBadge: {
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 5,
  },
  tabBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
    marginTop: 15,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 8,
    textAlign: "center",
  },
  addFirstButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  addFirstText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
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
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    position: "relative",
  },
  friendAvatarText: {
    fontSize: 24,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "white",
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "600",
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
  moreButton: {
    padding: 5,
  },
  requestsContainer: {
    flex: 1,
  },
  requestSection: {
    padding: 15,
  },
  requestSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 15,
  },
  requestCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: "row",
    marginBottom: 10,
  },
  requestAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  requestAvatarText: {
    fontSize: 20,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  requestUsername: {
    fontSize: 13,
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
    fontStyle: "italic",
    marginBottom: 12,
    paddingLeft: 57,
  },
  requestActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  acceptButton: {
    backgroundColor: theme.colors.forest,
  },
  acceptText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 5,
  },
  declineButton: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  declineText: {
    color: theme.colors.gray,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 5,
  },
  cancelButton: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  cancelText: {
    color: theme.colors.gray,
    fontSize: 14,
    fontWeight: "600",
  },
  findContainer: {
    flex: 1,
  },
  searchSection: {
    backgroundColor: "white",
    margin: 15,
    padding: 15,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 15,
    color: theme.colors.navy,
  },
  searchResults: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  searchResult: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  searchResultInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchResultAvatar: {
    fontSize: 24,
    marginRight: 12,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.navy,
  },
  searchResultUsername: {
    fontSize: 13,
    color: theme.colors.gray,
    marginTop: 2,
  },
  suggestionsSection: {
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  suggestionsScroll: {
    marginHorizontal: -5,
  },
  suggestionCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 5,
    width: 140,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  suggestionAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  suggestionAvatarText: {
    fontSize: 24,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
    textAlign: "center",
  },
  suggestionUsername: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  suggestionReason: {
    fontSize: 11,
    color: theme.colors.forest,
    marginTop: 5,
    textAlign: "center",
  },
  suggestionAddButton: {
    backgroundColor: theme.colors.forest,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  shareSection: {
    backgroundColor: "white",
    margin: 15,
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  shareTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginTop: 10,
  },
  shareText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 15,
  },
  shareButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: "row", // ADD THIS
    alignItems: "center",
  },
  shareButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
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
  modalLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.gray,
    marginBottom: 8,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: theme.colors.navy,
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: "top",
  },
  modalButton: {
    backgroundColor: theme.colors.forest,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

const optionStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    fontSize: 32,
    marginRight: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  username: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
  },
  options: {
    padding: 20,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  dangerOption: {
    borderBottomWidth: 0,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.navy,
    marginLeft: 15,
  },
  warning: {
    fontSize: 12,
    color: theme.colors.lightGray,
    textAlign: "center",
    marginHorizontal: 20,
    marginTop: 10,
  },
});
