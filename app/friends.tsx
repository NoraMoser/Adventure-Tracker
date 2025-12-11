// app/friends.tsx - Refactored
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { AddFriendModal } from "../components/AddFriendModal";
import { FriendItem } from "../components/FriendItem";
import { FriendOptionsModal } from "../components/FriendOptionsModal";
import { FriendRequestItem } from "../components/FriendRequestItem";
import { SuggestionCard } from "../components/SuggestionCard";
import { UserAvatar } from "../components/UserAvatar";
import { theme } from "../constants/theme";
import { Friend, FriendRequest, useFriends } from "../contexts/FriendsContext";

export default function FriendsScreen() {
  const router = useRouter();
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

  const [selectedTab, setSelectedTab] = useState<"friends" | "requests" | "find">("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  useEffect(() => {
    if (refreshFriends) {
      refreshFriends();
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (refreshFriends) await refreshFriends();
    if (selectedTab === "find" && refreshSuggestions) await refreshSuggestions();
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
    const androidLink = "https://play.google.com/store/apps/details?id=com.moser.explorable";
    const iosLink = "https://apps.apple.com/app/id6754299925";

    if (Platform.OS === "android") {
      Share.share({
        message: `${inviteMessage}\n\n${androidLink}`,
        title: "Join me on explorAble!",
      });
    } else {
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
          <Ionicons name="people-outline" size={60} color={theme.colors.lightGray} />
          <Text style={styles.emptyTitle}>No Friends Yet</Text>
          <Text style={styles.emptyText}>Add friends to share your adventures!</Text>
          <TouchableOpacity
            style={styles.addFirstButton}
            onPress={() => setSelectedTab("find")}
          >
            <Text style={styles.addFirstText}>Find Friends</Text>
          </TouchableOpacity>
        </View>
      }
      contentContainerStyle={friends.length === 0 ? styles.emptyContainer : styles.listContainer}
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
            <FriendRequestItem
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
            <FriendRequestItem
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
          <Ionicons name="mail-outline" size={60} color={theme.colors.lightGray} />
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
              <Ionicons name="arrow-forward" size={20} color={theme.colors.forest} />
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
                  <UserAvatar user={user} size={40} style={{ marginRight: 12 }} />
                  <View>
                    <Text style={styles.searchResultName}>{user.displayName}</Text>
                    <Text style={styles.searchResultUsername}>@{user.username}</Text>
                  </View>
                </View>
                <Ionicons name="person-add" size={20} color={theme.colors.forest} />
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
                <Ionicons name="refresh" size={20} color={theme.colors.forest} />
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
        <TouchableOpacity style={styles.shareButton} onPress={handleInviteFriends}>
          <Ionicons name="send" size={18} color="white" />
          <Text style={styles.shareButtonText}>Send Invite</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Friends",
          headerStyle: { backgroundColor: theme.colors.forest },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "bold" },
          headerRight: () => (
            <View style={styles.headerRight}>
              {friendRequests.length > 0 && (
                <View style={styles.requestBadge}>
                  <Text style={styles.requestBadgeText}>{friendRequests.length}</Text>
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
          <Text style={[styles.tabText, selectedTab === "friends" && styles.tabTextActive]}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === "requests" && styles.tabActive]}
          onPress={() => setSelectedTab("requests")}
        >
          <Text style={[styles.tabText, selectedTab === "requests" && styles.tabTextActive]}>
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
          <Text style={[styles.tabText, selectedTab === "find" && styles.tabTextActive]}>
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

      {/* Modals */}
      <AddFriendModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSendRequest={handleSendRequest}
      />

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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shareButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
});