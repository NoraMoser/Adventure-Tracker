import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
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
import { CoverPhotoModal } from "../components/CoverPhotoModal";
import { FriendSelectionModal } from "../components/FriendSelectionModal";
import { theme } from "../constants/theme";
import { useAuth } from "../contexts/AuthContext";
import { useFriends } from "../contexts/FriendsContext";
import { useTrips } from "../contexts/TripContext";
import { normalizeDate } from "../utils/date";

export default function EditTripScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, updateTrip, deleteTrip } = useTrips();
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
  const [datesLocked, setDatesLocked] = useState(false);

  // Cover photo state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [availablePhotos, setAvailablePhotos] = useState<string[]>([]);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [coverPhotoPosition, setCoverPhotoPosition] = useState({ x: 0, y: 0 });

  const acceptedFriends = friends.filter((f) => f.status === "accepted");

  useEffect(() => {
    if (!trip) return;

    setName(trip.name);
    const normalizedStart = normalizeDate(trip.start_date);
    const normalizedEnd = normalizeDate(trip.end_date);
    setStartDate(normalizedStart);
    setEndDate(normalizedEnd);
    setTaggedFriends(trip.tagged_friends || []);
    setDatesLocked(trip.dates_locked || false);
    setCoverPhoto(trip.cover_photo || null);
    setCoverPhotoPosition(trip.cover_photo_position || { x: 0, y: 0 });

    // Auto-adjust dates based on trip items
    if (trip.items && trip.items.length > 0) {
      const itemDates = trip.items
        .map((item) => {
          const itemData = item.data;
          if (item.type === "activity" && itemData) {
            if (itemData.activityDate) return normalizeDate(itemData.activityDate);
            if (itemData.date) return normalizeDate(itemData.date);
          }
          if (item.type === "spot" && itemData) {
            if (itemData.locationDate) return normalizeDate(itemData.locationDate);
            if (itemData.timestamp) return normalizeDate(itemData.timestamp);
          }
          if (item.added_at) return normalizeDate(item.added_at);
          return null;
        })
        .filter((date): date is Date => date !== null);

      if (itemDates.length > 0) {
        const earliestItemDate = new Date(Math.min(...itemDates.map((d) => d.getTime())));
        const latestItemDate = new Date(Math.max(...itemDates.map((d) => d.getTime())));

        if (earliestItemDate < normalizedStart) {
          setStartDate(earliestItemDate);
        }
        if (latestItemDate > normalizedEnd) {
          setEndDate(latestItemDate);
        }
      }
    }
  }, [trip]);

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Trip not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const formatDate = (date: Date) => {
    return normalizeDate(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDurationInDays = () => {
    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return days > 0 ? days : 1;
  };

  const datesAutoAdjusted = () => {
    if (!trip?.items?.length) return false;

    const itemDates = trip.items
      .map((item) => {
        const itemData = item.data;
        if (item.type === "activity" && itemData) {
          if (itemData.activityDate) return new Date(itemData.activityDate);
          if (itemData.date) return new Date(itemData.date);
        }
        if (item.type === "spot" && itemData) {
          if (itemData.locationDate) return new Date(itemData.locationDate);
          if (itemData.timestamp) return new Date(itemData.timestamp);
        }
        if (item.added_at) return new Date(item.added_at);
        return null;
      })
      .filter((date): date is Date => date !== null);

    if (itemDates.length === 0) return false;

    const earliestItemDate = new Date(Math.min(...itemDates.map((d) => d.getTime())));
    const latestItemDate = new Date(Math.max(...itemDates.map((d) => d.getTime())));
    const originalStart = trip.start_date instanceof Date ? trip.start_date : new Date(trip.start_date);
    const originalEnd = trip.end_date instanceof Date ? trip.end_date : new Date(trip.end_date);

    return earliestItemDate < originalStart || latestItemDate > originalEnd;
  };

  const getTaggedFriendNames = () => {
    const tagged = acceptedFriends.filter((f) => taggedFriends.includes(f.id));
    if (tagged.length === 0) return "No friends tagged";
    if (tagged.length === 1) return tagged[0].displayName || tagged[0].username;
    if (tagged.length === 2) {
      return `${tagged[0].displayName || tagged[0].username} and ${tagged[1].displayName || tagged[1].username}`;
    }
    return `${tagged[0].displayName || tagged[0].username} and ${tagged.length - 1} others`;
  };

  const handleSelectCoverPhoto = () => {
    const tripPhotos: string[] = [];
    trip.items.forEach((item) => {
      if (item.data?.photos && Array.isArray(item.data.photos)) {
        tripPhotos.push(...item.data.photos);
      }
    });

    if (tripPhotos.length === 0) {
      Alert.alert("No Photos", "Add photos to your trip items to set a cover photo");
      return;
    }

    setAvailablePhotos(tripPhotos);
    setShowPhotoModal(true);
  };

  const handleCoverPhotoSave = async (photo: string, position: { x: number; y: number }) => {
    setCoverPhoto(photo);
    setCoverPhotoPosition(position);

    try {
      await updateTrip(trip.id, {
        cover_photo: photo,
        cover_photo_position: position,
      });
      Alert.alert("Success", "Cover photo updated!");
    } catch (error) {
      Alert.alert("Error", "Failed to save cover photo");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a trip name");
      return;
    }

    const normalizedStart = normalizeDate(startDate);
    const normalizedEnd = normalizeDate(endDate);

    if (normalizedEnd < normalizedStart) {
      Alert.alert("Error", "End date cannot be before start date");
      return;
    }

    setSaving(true);
    try {
      await updateTrip(trip.id, {
        name: name.trim(),
        start_date: normalizedStart,
        end_date: normalizedEnd,
        tagged_friends: taggedFriends,
        cover_photo: coverPhoto,
        cover_photo_position: coverPhotoPosition,
        dates_locked: datesLocked,
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
    Alert.alert("Discard Changes?", "Are you sure you want to discard your changes?", [
      { text: "Keep Editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => router.back() },
    ]);
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
      const normalized = normalizeDate(selectedDate);
      setStartDate(normalized);
      if (normalized > endDate) {
        setEndDate(normalized);
      }
      setDatesLocked(true);
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      const normalized = normalizeDate(selectedDate);
      if (normalized < startDate) {
        Alert.alert("Invalid Date", "End date cannot be before start date");
      } else {
        setEndDate(normalized);
        setDatesLocked(true);
      }
    }
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
          style={[styles.headerButton, styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveButtonText, saving && styles.saveButtonTextDisabled]}>
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

        {/* Cover Photo */}
        <View style={styles.section}>
          <Text style={styles.label}>Cover Photo</Text>
          {coverPhoto ? (
            <View style={styles.coverPhotoContainer}>
              <View style={styles.coverPhotoPreview}>
                <View
                  style={[
                    styles.coverPhotoImage,
                    {
                      transform: [
                        { translateX: coverPhotoPosition.x },
                        { translateY: coverPhotoPosition.y },
                      ],
                    },
                  ]}
                >
                  <Image source={{ uri: coverPhoto }} style={styles.coverImage} />
                </View>
              </View>
              <TouchableOpacity style={styles.changeCoverButton} onPress={handleSelectCoverPhoto}>
                <Ionicons name="camera" size={20} color="white" />
                <Text style={styles.changeCoverText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addCoverButton} onPress={handleSelectCoverPhoto}>
              <Ionicons name="images-outline" size={32} color={theme.colors.gray} />
              <Text style={styles.addCoverText}>Add Cover Photo</Text>
              <Text style={styles.addCoverHint}>Choose from trip photos</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Date Range */}
        <View style={styles.section}>
          <Text style={styles.label}>Date Range</Text>

          {datesAutoAdjusted() && (
            <View style={styles.autoAdjustNotice}>
              <Ionicons name="information-circle" size={16} color={theme.colors.forest} />
              <Text style={styles.autoAdjustText}>Dates adjusted to include all trip items</Text>
            </View>
          )}

          <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartDatePicker(true)}>
            <View style={styles.dateButtonContent}>
              <View style={styles.dateLeft}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.forest} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <Text style={styles.dateValue}>{formatDate(startDate)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.gray} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateButton, styles.lastDateButton]}
            onPress={() => setShowEndDatePicker(true)}
          >
            <View style={styles.dateButtonContent}>
              <View style={styles.dateLeft}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.burntOrange} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>End Date</Text>
                  <Text style={styles.dateValue}>{formatDate(endDate)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.gray} />
            </View>
          </TouchableOpacity>

          <View style={styles.durationInfo}>
            <Ionicons name="time-outline" size={16} color={theme.colors.gray} />
            <Text style={styles.durationText}>Trip Duration: {getDurationInDays()} days</Text>
          </View>

          <View style={styles.lockToggleContainer}>
            <View style={styles.lockToggleInfo}>
              <Ionicons
                name={datesLocked ? "lock-closed" : "lock-open"}
                size={20}
                color={datesLocked ? theme.colors.forest : theme.colors.gray}
              />
              <View style={styles.lockToggleText}>
                <Text style={styles.lockToggleTitle}>Lock Trip Dates</Text>
                <Text style={styles.lockToggleDescription}>
                  {datesLocked
                    ? "Dates won't auto-adjust when adding items"
                    : "Dates will expand to fit new items"}
                </Text>
              </View>
            </View>
            <Switch
              value={datesLocked}
              onValueChange={setDatesLocked}
              trackColor={{ false: theme.colors.borderGray, true: theme.colors.forest }}
              thumbColor={datesLocked ? theme.colors.white : theme.colors.lightGray}
            />
          </View>
        </View>

        {/* Tagged Friends */}
        <View style={styles.section}>
          <Text style={styles.label}>Share with Friends</Text>

          <TouchableOpacity style={styles.tagFriendsButton} onPress={() => setShowFriendModal(true)}>
            <View style={styles.tagFriendsContent}>
              <Ionicons name="people-outline" size={24} color={theme.colors.forest} />
              <View style={styles.tagFriendsInfo}>
                <Text style={styles.tagFriendsLabel}>Tagged Friends</Text>
                <Text style={styles.tagFriendsValue}>{getTaggedFriendNames()}</Text>
              </View>
              <View style={styles.tagFriendsBadge}>
                <Text style={styles.tagFriendsBadgeText}>{taggedFriends.length}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.permissionRow}>
            <Text style={styles.permissionText}>Allow friends to edit trip</Text>
            <Switch
              value={allowFriendsToEdit}
              onValueChange={setAllowFriendsToEdit}
              trackColor={{ false: theme.colors.borderGray, true: theme.colors.forest }}
              thumbColor={allowFriendsToEdit ? theme.colors.white : theme.colors.lightGray}
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
                      <Ionicons name="close-circle" size={18} color={theme.colors.white} />
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
            <Text style={styles.infoValue}>{trip.auto_generated ? "Yes" : "No"}</Text>
          </View>
        </View>

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTrip}>
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

      {/* Modals */}
      <FriendSelectionModal
        visible={showFriendModal}
        onClose={() => setShowFriendModal(false)}
        friends={acceptedFriends}
        selectedFriends={taggedFriends}
        onToggleFriend={toggleFriend}
      />

      <CoverPhotoModal
        visible={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        photos={availablePhotos}
        onSave={handleCoverPhotoSave}
        initialPosition={coverPhotoPosition}
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
    color: theme.colors.white,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: theme.colors.white,
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
    color: theme.colors.white,
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
    backgroundColor: theme.colors.white,
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
  coverPhotoContainer: {
    position: "relative",
  },
  coverPhotoPreview: {
    height: 200,
    overflow: "hidden",
    borderRadius: 8,
    position: "relative",
  },
  coverPhotoImage: {
    position: "absolute",
    width: 900,
    height: 900,
    left: -300,
    top: -350,
  },
  coverImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  changeCoverButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeCoverText: {
    color: "white",
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "500",
  },
  addCoverButton: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 30,
    alignItems: "center",
  },
  addCoverText: {
    color: theme.colors.navy,
    fontSize: 16,
    fontWeight: "500",
    marginTop: 10,
  },
  addCoverHint: {
    color: theme.colors.lightGray,
    fontSize: 12,
    marginTop: 5,
  },
  autoAdjustNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest + "10",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  autoAdjustText: {
    fontSize: 12,
    color: theme.colors.forest,
    marginLeft: 8,
    flex: 1,
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
  lockToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.offWhite,
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  lockToggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  lockToggleText: {
    marginLeft: 12,
    flex: 1,
  },
  lockToggleTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.navy,
  },
  lockToggleDescription: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
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
    color: theme.colors.white,
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
    color: theme.colors.white,
    fontSize: 14,
    marginRight: 6,
  },
  infoSection: {
    backgroundColor: theme.colors.white,
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
    backgroundColor: theme.colors.white,
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