// app/edit-trip.tsx - Updated with friend tagging
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../constants/theme";
import { useAuth } from "../contexts/AuthContext";
import { useFriends } from "../contexts/FriendsContext";
import { useTrips } from "../contexts/TripContext";

// Friend Selection Modal
const FriendSelectionModal = ({
  visible,
  onClose,
  friends,
  selectedFriends,
  onToggleFriend,
}: {
  visible: boolean;
  onClose: () => void;
  friends: any[];
  selectedFriends: string[];
  onToggleFriend: (friendId: string) => void;
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Tag Friends</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.friendsList}>
            {friends.length === 0 ? (
              <View style={modalStyles.emptyState}>
                <Text style={modalStyles.emptyText}>No friends to tag</Text>
                <Text style={modalStyles.emptySubtext}>
                  Add friends to share trips with them
                </Text>
              </View>
            ) : (
              friends.map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  style={modalStyles.friendItem}
                  onPress={() => onToggleFriend(friend.id)}
                >
                  <View style={modalStyles.friendInfo}>
                    {friend.profile_picture ? (
                      <Image
                        source={{ uri: friend.profile_picture }}
                        style={modalStyles.friendAvatar}
                      />
                    ) : (
                      <View style={modalStyles.friendAvatarPlaceholder}>
                        <Text>{friend.avatar || "👤"}</Text>
                      </View>
                    )}
                    <View style={modalStyles.friendDetails}>
                      <Text style={modalStyles.friendName}>
                        {friend.displayName || friend.username}
                      </Text>
                      <Text style={modalStyles.friendUsername}>
                        @{friend.username}
                      </Text>
                    </View>
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
              ))
            )}
          </ScrollView>

          <TouchableOpacity style={modalStyles.doneButton} onPress={onClose}>
            <Text style={modalStyles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function EditTripScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, updateTrip, deleteTrip, tagFriend, untagFriend } = useTrips();
  const { friends } = useFriends();
  const { user } = useAuth();

  const trip = trips.find((t) => t.id === tripId);

  // Form state
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [taggedFriends, setTaggedFriends] = useState<string[]>([]);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allowFriendsToEdit, setAllowFriendsToEdit] = useState(true);

  // Get accepted friends only
  const acceptedFriends = friends.filter((f) => f.status === "accepted");

  // Initialize form with existing trip data
  useEffect(() => {
    if (trip) {
      setName(trip.name);
      setStartDate(
        trip.start_date instanceof Date
          ? trip.start_date
          : new Date(trip.start_date)
      );
      setEndDate(
        trip.end_date instanceof Date ? trip.end_date : new Date(trip.end_date)
      );
      setTaggedFriends(trip.tagged_friends || []);
    }
  }, [trip]);

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Trip not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const formatDate = (date: Date) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a trip name");
      return;
    }

    if (endDate < startDate) {
      Alert.alert("Error", "End date cannot be before start date");
      return;
    }

    setSaving(true);
    try {
      await updateTrip(trip.id, {
        ...trip,
        name: name.trim(),
        start_date: startDate, // Changed from start_date to startDate
        end_date: endDate, // Changed from end_date to endDate
        tagged_friends: taggedFriends, // This one was already correct
      });
      Alert.alert("Success", "Trip updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to update trip");
      setSaving(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Discard Changes?",
      "Are you sure you want to discard your changes?",
      [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => router.back(),
        },
      ]
    );
  };

  const handleDeleteTrip = () => {
    Alert.alert(
      "Delete Trip",
      "Are you sure you want to delete this trip? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTrip(trip.id);
              router.back();
            } catch (error) {
              Alert.alert("Error", "Failed to delete trip");
            }
          },
        },
      ]
    );
  };

  const toggleFriend = (friendId: string) => {
    if (taggedFriends.includes(friendId)) {
      setTaggedFriends(taggedFriends.filter((id) => id !== friendId));
    } else {
      setTaggedFriends([...taggedFriends, friendId]);
    }
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
      if (selectedDate > endDate) {
        setEndDate(selectedDate);
      }
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      if (selectedDate < startDate) {
        Alert.alert("Invalid Date", "End date cannot be before start date");
      } else {
        setEndDate(selectedDate);
      }
    }
  };

  const getTaggedFriendNames = () => {
    const tagged = acceptedFriends.filter((f) => taggedFriends.includes(f.id));
    if (tagged.length === 0) return "No friends tagged";
    if (tagged.length === 1) return tagged[0].displayName || tagged[0].username;
    if (tagged.length === 2) {
      return `${tagged[0].displayName || tagged[0].username} and ${
        tagged[1].displayName || tagged[1].username
      }`;
    }
    return `${tagged[0].displayName || tagged[0].username} and ${
      tagged.length - 1
    } others`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
          <Ionicons name="close" size={24} color={theme.colors.gray} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Trip</Text>
        <TouchableOpacity
          style={[
            styles.headerButton,
            styles.saveButton,
            saving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text
            style={[
              styles.saveButtonText,
              saving && styles.saveButtonTextDisabled,
            ]}
          >
            {saving ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Trip Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Trip Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter trip name"
            placeholderTextColor={theme.colors.lightGray}
            autoFocus
            maxLength={50}
          />
          <Text style={styles.hint}>{name.length}/50 characters</Text>
        </View>

        {/* Date Range */}
        <View style={styles.section}>
          <Text style={styles.label}>Date Range</Text>

          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartDatePicker(true)}
          >
            <View style={styles.dateButtonContent}>
              <View style={styles.dateLeft}>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={theme.colors.forest}
                />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <Text style={styles.dateValue}>{formatDate(startDate)}</Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.gray}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateButton, styles.lastDateButton]}
            onPress={() => setShowEndDatePicker(true)}
          >
            <View style={styles.dateButtonContent}>
              <View style={styles.dateLeft}>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={theme.colors.burntOrange}
                />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>End Date</Text>
                  <Text style={styles.dateValue}>{formatDate(endDate)}</Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.gray}
              />
            </View>
          </TouchableOpacity>

          <View style={styles.durationInfo}>
            <Ionicons name="time-outline" size={16} color={theme.colors.gray} />
            <Text style={styles.durationText}>
              Trip Duration:{" "}
              {Math.ceil(
                (endDate.getTime() - startDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              ) + 1}{" "}
              days
            </Text>
          </View>
        </View>

        {/* Tagged Friends Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Share with Friends</Text>

          <TouchableOpacity
            style={styles.tagFriendsButton}
            onPress={() => setShowFriendModal(true)}
          >
            <View style={styles.tagFriendsContent}>
              <Ionicons
                name="people-outline"
                size={24}
                color={theme.colors.forest}
              />
              <View style={styles.tagFriendsInfo}>
                <Text style={styles.tagFriendsLabel}>Tagged Friends</Text>
                <Text style={styles.tagFriendsValue}>
                  {getTaggedFriendNames()}
                </Text>
              </View>
              <View style={styles.tagFriendsBadge}>
                <Text style={styles.tagFriendsBadgeText}>
                  {taggedFriends.length}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.permissionRow}>
            <Text style={styles.permissionText}>
              Allow friends to add items to this trip
            </Text>
            <Switch
              value={allowFriendsToEdit}
              onValueChange={setAllowFriendsToEdit}
              trackColor={{
                false: theme.colors.borderGray,
                true: theme.colors.forest,
              }}
              thumbColor={
                allowFriendsToEdit ? theme.colors.white : theme.colors.lightGray
              }
            />
          </View>

          {taggedFriends.length > 0 && (
            <View style={styles.taggedFriendsList}>
              {acceptedFriends
                .filter((f) => taggedFriends.includes(f.id))
                .map((friend) => (
                  <View key={friend.id} style={styles.taggedFriendChip}>
                    <Text style={styles.taggedFriendName}>
                      {friend.displayName || friend.username}
                    </Text>
                    <TouchableOpacity onPress={() => toggleFriend(friend.id)}>
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={theme.colors.white}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
            </View>
          )}
        </View>

        {/* Trip Info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Trip Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Activities:</Text>
            <Text style={styles.infoValue}>
              {trip.items.filter((item) => item.type === "activity").length}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Saved Spots:</Text>
            <Text style={styles.infoValue}>
              {trip.items.filter((item) => item.type === "spot").length}
            </Text>
          </View>
          {trip.created_by && trip.created_by !== user?.id && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created by:</Text>
              <Text style={styles.infoValue}>Friend</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Auto-generated:</Text>
            <Text style={styles.infoValue}>
              {trip.auto_generated ? "Yes" : "No"}
            </Text>
          </View>
        </View>

        {/* Delete Trip Button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteTrip}
        >
          <Ionicons name="trash-outline" size={20} color="#FF4757" />
          <Text style={styles.deleteButtonText}>Delete Trip</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onStartDateChange}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onEndDateChange}
          minimumDate={startDate}
        />
      )}

      {/* Friend Selection Modal */}
      <FriendSelectionModal
        visible={showFriendModal}
        onClose={() => setShowFriendModal(false)}
        friends={acceptedFriends}
        selectedFriends={taggedFriends}
        onToggleFriend={toggleFriend}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: theme.colors.gray,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  headerButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  saveButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: theme.colors.forest,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  saveButtonTextDisabled: {
    opacity: 0.8,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: "#fff",
    padding: 20,
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 10,
  },
  input: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.navy,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 5,
    textAlign: "right",
  },
  dateButton: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  lastDateButton: {
    marginBottom: 15,
  },
  dateButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  dateLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dateInfo: {
    marginLeft: 12,
  },
  dateLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 16,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  durationInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.forest + "10",
    borderRadius: 8,
  },
  durationText: {
    fontSize: 14,
    color: theme.colors.forest,
    marginLeft: 8,
    fontWeight: "500",
  },
  tagFriendsButton: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.forest + "30",
    marginBottom: 15,
  },
  tagFriendsContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  tagFriendsInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tagFriendsLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginBottom: 2,
  },
  tagFriendsValue: {
    fontSize: 16,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  tagFriendsBadge: {
    backgroundColor: theme.colors.forest,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagFriendsBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  permissionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    marginBottom: 15,
  },
  permissionText: {
    fontSize: 14,
    color: theme.colors.navy,
    flex: 1,
  },
  taggedFriendsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  taggedFriendChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  taggedFriendName: {
    color: "#fff",
    fontSize: 14,
    marginRight: 6,
  },
  infoSection: {
    backgroundColor: "#fff",
    padding: 20,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray + "30",
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    margin: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FF4757",
  },
  deleteButtonText: {
    color: "#FF4757",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
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
  friendsList: {
    padding: 20,
    maxHeight: 400,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.gray,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.lightGray,
    textAlign: "center",
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray + "30",
  },
  friendInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  friendAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
  },
  friendUsername: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
  },
  doneButton: {
    backgroundColor: theme.colors.forest,
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
