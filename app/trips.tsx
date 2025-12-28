import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../constants/theme";
import { useAuth } from "../contexts/AuthContext";
import { useFriends } from "../contexts/FriendsContext";
import { Trip, useTrips } from "../contexts/TripContext";
import { useActivity } from "../contexts/ActivityContext";
import { useLocation } from "../contexts/LocationContext";
import { useJournal } from "../contexts/JournalContext";

const MergeSuggestions = ({
  onMerge,
}: {
  onMerge: (autoTrip: Trip, sharedTrip: Trip) => void;
}) => {
  const { getSuggestedMerges } = useTrips();
  const { friends } = useFriends();
  const [isVisible, setIsVisible] = useState(true); // Add state for visibility
  const suggestions = getSuggestedMerges();

  const getFriendName = (friendId: string) => {
    const friend = friends.find((f) => f.id === friendId);
    return friend?.displayName || friend?.username || "Friend";
  };

  if (suggestions.length === 0 || !isVisible) return null; // Check isVisible

  return (
    <View style={mergeStyles.container}>
      <View style={mergeStyles.header}>
        <View style={mergeStyles.headerLeft}>
          <Ionicons
            name="git-merge"
            size={20}
            color={theme.colors.burntOrange}
          />
          <Text style={mergeStyles.title}>Suggested Merges</Text>
        </View>
        <TouchableOpacity
          onPress={() => setIsVisible(false)}
          style={mergeStyles.closeButton}
        >
          <Ionicons name="close" size={20} color={theme.colors.gray} />
        </TouchableOpacity>
      </View>
      <Text style={mergeStyles.subtitle}>
        Your auto-detected trips might match these shared trips:
      </Text>

      {suggestions.map(({ autoTrip, sharedTrip }) => (
        <View key={`${autoTrip.id}-${sharedTrip.id}`} style={mergeStyles.card}>
          <View style={mergeStyles.info}>
            <View style={mergeStyles.tripRow}>
              <Ionicons name="sparkles" size={14} color={theme.colors.forest} />
              <Text style={mergeStyles.autoText}>Auto: {autoTrip.name}</Text>
            </View>
            <View style={mergeStyles.tripRow}>
              <Ionicons name="people" size={14} color={theme.colors.navy} />
              <Text style={mergeStyles.sharedText}>
                Shared: {sharedTrip.name} (by{" "}
                {getFriendName(sharedTrip.created_by)})
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={mergeStyles.button}
            onPress={() => onMerge(autoTrip, sharedTrip)}
          >
            <Ionicons name="git-merge" size={16} color="white" />
            <Text style={mergeStyles.buttonText}>Merge</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

export default function TripsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { activities } = useActivity();
  const { savedSpots } = useLocation();
  const { entries } = useJournal();

  const {
    trips,
    getMyTrips,
    getSharedTrips,
    mergeTripWithShared,
    addToTrip,
    deleteTrip,
    triggerAutoDetection,
  } = useTrips();
  const { friends } = useFriends();
  const [viewMode, setViewMode] = useState<"my" | "shared" | "all">("all");
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [tripToMerge, setTripToMerge] = useState<Trip | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const userId = user?.id || "default-user";
  const myTrips = getMyTrips();
  const sharedTrips = getSharedTrips();

  // Helper function to get journal count for a trip
  const getJournalCountForTrip = (tripId: string) => {
    return entries.filter((e) => e.trip_id === tripId).length;
  };

  useEffect(() => {
    const testClustering = async () => {
      await triggerAutoDetection();
    };

    testClustering();
  }, []);

  const getFilteredTrips = () => {
    let baseTrips =
      viewMode === "my" ? myTrips : viewMode === "shared" ? sharedTrips : trips;

    if (searchQuery.trim() === "") {
      return baseTrips;
    }

    const query = searchQuery.toLowerCase();
    return baseTrips.filter((trip) => {
      // Search in trip name
      if (trip.name.toLowerCase().includes(query)) return true;

      // Search in trip dates
      const dateRange = `${new Date(
        trip.start_date
      ).toLocaleDateString()} - ${new Date(
        trip.end_date
      ).toLocaleDateString()}`;
      if (dateRange.toLowerCase().includes(query)) return true;

      // Search in trip items
      if (trip.items) {
        return trip.items.some((item) => {
          const itemName = item.data.name || item.data.description || "";
          return itemName.toLowerCase().includes(query);
        });
      }

      return false;
    });
  };

  const displayedTrips = getFilteredTrips();

  const handleTripPress = (trip: Trip) => {
    router.push(`/trip-detail?tripId=${trip.id}`);
  };

  const handleMergeTrip = (sharedTrip: Trip) => {
    setTripToMerge(sharedTrip);
    setShowMergeModal(true);
  };

  const handleSmartMerge = async (autoTrip: Trip, sharedTrip: Trip) => {
    Alert.alert("Merge Trips", `How would you like to merge these trips?`, [
      {
        text: "Add my items to shared trip",
        onPress: async () => {
          try {
            // Move items from auto trip to shared trip
            for (const item of autoTrip.items || []) {
              await addToTrip(sharedTrip.id, item.data, item.type);
            }
            // Delete the auto trip
            await deleteTrip(autoTrip.id);
            Alert.alert(
              "Success",
              "Your items have been added to the shared trip"
            );
          } catch (error) {
            Alert.alert("Error", "Failed to merge trips");
          }
        },
      },
      {
        text: "Copy shared items to my trip",
        onPress: async () => {
          try {
            await mergeTripWithShared(autoTrip.id, sharedTrip.id);
          } catch (error) {
            Alert.alert("Error", "Failed to merge trips");
          }
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const performMerge = async (targetTripId: string) => {
    if (!tripToMerge) return;

    try {
      await mergeTripWithShared(targetTripId, tripToMerge.id);
      setShowMergeModal(false);
      setTripToMerge(null);
    } catch (error) {
      Alert.alert("Error", "Failed to merge trips");
    }
  };

  const getFriendName = (friendId: string) => {
    const friend = friends.find((f) => f.id === friendId);
    return friend?.displayName || friend?.username || "Friend";
  };

  const formatDate = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderTripCard = ({ item: trip }: { item: Trip }) => {
    const isShared = trip.created_by !== userId;
    const activityCount =
      trip.items?.filter((i) => i.type === "activity").length || 0;
    const spotCount = trip.items?.filter((i) => i.type === "spot").length || 0;
    const journalCount = getJournalCountForTrip(trip.id);

    const coverPhoto =
      trip.cover_photo ||
      trip.items?.find((i) => i.type === "spot" && i.data.photos?.length > 0)
        ?.data.photos[0];

    return (
      <TouchableOpacity
        style={styles.tripCard}
        onPress={() => handleTripPress(trip)}
        activeOpacity={0.7}
      >
        {coverPhoto ? (
          <View style={styles.tripCoverContainer}>
            <View
              style={{
                position: "absolute",
                width: 700, // Slightly smaller for list view
                height: 700,
                left: -250, // Center horizontally
                top: -275, // Center vertically
                transform: [
                  { translateX: trip.cover_photo_position?.x || 0 },
                  { translateY: trip.cover_photo_position?.y || 0 },
                ],
              }}
            >
              <Image
                source={{ uri: coverPhoto }}
                style={{
                  width: "100%",
                  height: "100%",
                  resizeMode: "contain",
                }}
              />
            </View>
          </View>
        ) : (
          <View style={[styles.tripCover, styles.tripCoverPlaceholder]}>
            <Ionicons name="images-outline" size={40} color="#ccc" />
          </View>
        )}

        <View style={styles.tripContent}>
          <View style={styles.tripHeader}>
            <Text style={styles.tripName} numberOfLines={1}>
              {trip.name}
            </Text>
            {isShared && (
              <View style={styles.sharedBadge}>
                <Ionicons name="people" size={14} color="#fff" />
                <Text style={styles.sharedBadgeText}>Shared</Text>
              </View>
            )}
            {trip.auto_generated && (
              <View style={styles.autoBadge}>
                <Ionicons name="sparkles" size={14} color="#fff" />
              </View>
            )}
          </View>

          <Text style={styles.tripDates}>
            {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
          </Text>

          <View style={styles.tripStats}>
            <View style={styles.statItem}>
              <Ionicons name="fitness" size={16} color={theme.colors.forest} />
              <Text style={styles.statText}>{activityCount}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons
                name="location"
                size={16}
                color={theme.colors.burntOrange}
              />
              <Text style={styles.statText}>{spotCount}</Text>
            </View>
            {journalCount > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="book" size={16} color="#9C27B0" />
                <Text style={styles.statText}>{journalCount}</Text>
              </View>
            )}
            {trip.tagged_friends && trip.tagged_friends.length > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="people" size={16} color={theme.colors.navy} />
                <Text style={styles.statText}>
                  {trip.tagged_friends.length}
                </Text>
              </View>
            )}
          </View>

          {isShared && (
            <View style={styles.sharedInfo}>
              <Text style={styles.sharedByText}>
                Created by {getFriendName(trip.created_by)}
              </Text>
              <TouchableOpacity
                style={styles.mergeButton}
                onPress={() => handleMergeTrip(trip)}
              >
                <Ionicons
                  name="git-merge"
                  size={16}
                  color={theme.colors.forest}
                />
                <Text style={styles.mergeButtonText}>Merge</Text>
              </TouchableOpacity>
            </View>
          )}

          {trip.tagged_friends &&
            trip.tagged_friends.length > 0 &&
            !isShared && (
              <View style={styles.taggedFriends}>
                <Text style={styles.taggedLabel}>Shared with: </Text>
                <Text style={styles.taggedNames} numberOfLines={1}>
                  {trip.tagged_friends
                    .map((id) => getFriendName(id))
                    .join(", ")}
                </Text>
              </View>
            )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Trips</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/create-trip")}
        >
          <Ionicons name="add-circle" size={32} color={theme.colors.forest} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.colors.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trips, places, or dates..."
            placeholderTextColor={theme.colors.lightGray}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.colors.gray}
              />
            </TouchableOpacity>
          )}
        </View>

        {searchQuery.length > 0 && (
          <Text style={styles.searchResults}>
            {displayedTrips.length}{" "}
            {displayedTrips.length === 1 ? "trip" : "trips"} found
          </Text>
        )}
      </View>

      {/* Merge Suggestions */}
      <MergeSuggestions onMerge={handleSmartMerge} />

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            viewMode === "all" && styles.filterTabActive,
          ]}
          onPress={() => setViewMode("all")}
        >
          <Text
            style={[
              styles.filterTabText,
              viewMode === "all" && styles.filterTabTextActive,
            ]}
          >
            All Trips ({trips.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            viewMode === "my" && styles.filterTabActive,
          ]}
          onPress={() => setViewMode("my")}
        >
          <Text
            style={[
              styles.filterTabText,
              viewMode === "my" && styles.filterTabTextActive,
            ]}
          >
            My Trips ({myTrips.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            viewMode === "shared" && styles.filterTabActive,
          ]}
          onPress={() => setViewMode("shared")}
        >
          <Text
            style={[
              styles.filterTabText,
              viewMode === "shared" && styles.filterTabTextActive,
            ]}
          >
            Shared ({sharedTrips.length})
          </Text>
          {sharedTrips.length > 0 && (
            <View style={styles.filterTabBadge}>
              <Text style={styles.filterTabBadgeText}>
                {sharedTrips.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Trips List */}
      {displayedTrips.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={viewMode === "shared" ? "people-outline" : "airplane-outline"}
            size={80}
            color={theme.colors.lightGray}
          />
          <Text style={styles.emptyTitle}>
            {viewMode === "shared"
              ? "No shared trips yet"
              : viewMode === "my"
              ? "No trips created yet"
              : "No trips yet"}
          </Text>
          <Text style={styles.emptyText}>
            {viewMode === "shared"
              ? "When friends share trips with you, they'll appear here"
              : "Create your first trip to start organizing your adventures"}
          </Text>
          {viewMode !== "shared" && (
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push("/create-trip")}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.createButtonText}>Create Trip</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayedTrips} // Changed from filteredTrips
          renderItem={renderTripCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Merge Modal */}
      <Modal
        visible={showMergeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMergeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Merge Trip</Text>
              <TouchableOpacity onPress={() => setShowMergeModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.gray} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select which trip to merge &quot;{tripToMerge?.name}&quot; into:
            </Text>

            <ScrollView style={styles.modalList}>
              {myTrips.map((trip) => (
                <TouchableOpacity
                  key={trip.id}
                  style={styles.modalTripItem}
                  onPress={() => performMerge(trip.id)}
                >
                  <View style={styles.modalTripInfo}>
                    <Text style={styles.modalTripName}>{trip.name}</Text>
                    <Text style={styles.modalTripDates}>
                      {formatDate(trip.start_date)} -{" "}
                      {formatDate(trip.end_date)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.gray}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowMergeModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.colors.navy,
  },
  addButton: {
    padding: 5,
  },
  filterTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  filterTab: {
    marginRight: 20,
    paddingVertical: 5,
    position: "relative",
  },
  filterTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.forest,
  },
  filterTabText: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  filterTabTextActive: {
    color: theme.colors.forest,
    fontWeight: "600",
  },
  filterTabBadge: {
    position: "absolute",
    top: -5,
    right: -15,
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  filterTabBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  listContainer: {
    padding: 15,
  },
  tripCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 15,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripCover: {
    width: "100%",
    height: 150,
  },
  tripCoverPlaceholder: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  tripContent: {
    padding: 15,
  },
  tripHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tripName: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    flex: 1,
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.navy,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  sharedBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  autoBadge: {
    backgroundColor: theme.colors.forest,
    padding: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  tripDates: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: 10,
  },
  tripStats: {
    flexDirection: "row",
    marginBottom: 10,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 15,
  },
  statText: {
    fontSize: 14,
    color: theme.colors.navy,
    marginLeft: 4,
    fontWeight: "500",
  },
  sharedInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  sharedByText: {
    fontSize: 13,
    color: theme.colors.gray,
    fontStyle: "italic",
  },
  mergeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest + "20",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mergeButtonText: {
    fontSize: 13,
    color: theme.colors.forest,
    fontWeight: "600",
    marginLeft: 4,
  },
  taggedFriends: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  taggedLabel: {
    fontSize: 13,
    color: theme.colors.gray,
  },
  taggedNames: {
    fontSize: 13,
    color: theme.colors.navy,
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
    marginBottom: 30,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    padding: 20,
    paddingBottom: 10,
  },
  modalList: {
    maxHeight: 300,
  },
  modalTripItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray + "30",
  },
  modalTripInfo: {
    flex: 1,
  },
  modalTripName: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
  },
  modalTripDates: {
    fontSize: 13,
    color: theme.colors.gray,
    marginTop: 2,
  },
  modalCancelButton: {
    padding: 15,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  modalCancelText: {
    fontSize: 16,
    color: theme.colors.gray,
    fontWeight: "500",
  },
  tripCoverContainer: {
    width: "100%",
    height: 150,
    overflow: "hidden", // Critical for clipping
    backgroundColor: theme.colors.offWhite,
    position: "relative",
  },
  searchContainer: {
    padding: 15,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.navy,
    padding: 4,
  },
  searchResults: {
    marginTop: 8,
    fontSize: 13,
    color: theme.colors.gray,
    fontStyle: "italic",
  },
});

const mergeStyles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.burntOrange + "10",
    margin: 15,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.burntOrange + "30",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.gray,
    marginBottom: 12,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  info: {
    flex: 1,
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  autoText: {
    fontSize: 13,
    color: theme.colors.forest,
    marginLeft: 6,
    fontWeight: "500",
  },
  sharedText: {
    fontSize: 13,
    color: theme.colors.navy,
    marginLeft: 6,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  buttonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  closeButton: {
    padding: 4,
  },
});