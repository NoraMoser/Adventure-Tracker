// components/AddToTripButton.tsx - Updated with loading states
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../constants/theme";
import { Activity } from "../contexts/ActivityContext";
import { SavedSpot } from "../contexts/LocationContext";
import { useTrips } from "../contexts/TripContext";

interface AddToTripButtonProps {
  item: Activity | SavedSpot;
  type: "activity" | "spot";
  style?: any;
  iconSize?: number;
}

const AddToTripButton: React.FC<AddToTripButtonProps> = ({
  item,
  type,
  style,
  iconSize = 28,
}) => {
  const { trips, addToTrip, createTrip, currentUserId } = useTrips();
  const [showTripSelector, setShowTripSelector] = useState(false);
  const [loadingTripId, setLoadingTripId] = useState<string | null>(null);
  const [creatingNewTrip, setCreatingNewTrip] = useState(false);
  const router = useRouter();

  // Check if item is already in any trip
  const isInTrip = (tripId: string) => {
    const trip = trips.find((t) => t.id === tripId);
    return trip?.items.some(
      (tripItem) => tripItem.data.id === item.id && tripItem.type === type
    );
  };

  const handleAddToTrip = async (tripId: string) => {
    setLoadingTripId(tripId);
    try {
      await addToTrip(tripId, item, type);
      setShowTripSelector(false);

      const trip = trips.find((t) => t.id === tripId);
      Alert.alert("Success!", `Added to "${trip?.name}"`);
    } catch (error) {
      console.error("Error adding to trip:", error);
      Alert.alert("Error", "Failed to add to trip. Please try again.");
    } finally {
      setLoadingTripId(null);
    }
  };

  const handleCreateNewTrip = async () => {
    setCreatingNewTrip(true);

    // Generate default trip dates based on the item
    const itemDate = new Date(
      type === "activity"
        ? (item as Activity).startTime
        : (item as SavedSpot).timestamp
    );

    const startDate = new Date(itemDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(itemDate);
    endDate.setHours(23, 59, 59, 999);

    try {
      // Create a new trip with the item's date
      const newTrip = await createTrip({
        name: `Trip - ${itemDate.toLocaleDateString()}`,
        start_date: startDate,
        end_date: endDate,
        created_by: currentUserId,
        tagged_friends: [],
        auto_generated: true,
      });

      // Add the item to the newly created trip
      await addToTrip(newTrip.id, item, type);

      setShowTripSelector(false);

      Alert.alert(
        "Trip Created!",
        `Created "${newTrip.name}" and added the ${type}`,
        [
          {
            text: "View Trip",
            onPress: () => router.push(`/trip-detail?tripId=${newTrip.id}`),
          },
          { text: "OK", style: "cancel" },
        ]
      );
    } catch (error) {
      console.error("Error creating trip:", error);
      Alert.alert("Error", "Failed to create trip");
    } finally {
      setCreatingNewTrip(false);
    }
  };

  // Format date for display
  const formatTripDates = (
    startDate: Date | string,
    endDate: Date | string
  ) => {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    const startStr = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endStr = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (startStr === endStr) {
      return endStr;
    }
    return `${startStr} - ${endStr}`;
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.button, style]}
        onPress={() => setShowTripSelector(true)}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name="airplane"
            size={iconSize}
            color={theme.colors.burntOrange}
          />
          <View style={styles.plusBadge}>
            <Ionicons
              name="add"
              size={iconSize * 0.5}
              color={theme.colors.white}
            />
          </View>
        </View>
      </TouchableOpacity>

      <Modal
        visible={showTripSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTripSelector(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Trip</Text>
              <TouchableOpacity
                onPress={() => setShowTripSelector(false)}
                style={styles.closeButton}
                disabled={loadingTripId !== null || creatingNewTrip}
              >
                <Ionicons name="close" size={24} color={theme.colors.gray} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.newTripOption,
                creatingNewTrip && styles.newTripOptionLoading,
              ]}
              onPress={handleCreateNewTrip}
              disabled={creatingNewTrip || loadingTripId !== null}
            >
              {creatingNewTrip ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.burntOrange}
                  />
                  <Text style={styles.newTripText}>Creating Trip...</Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="add-circle"
                    size={24}
                    color={theme.colors.burntOrange}
                  />
                  <Text style={styles.newTripText}>Create New Trip</Text>
                </>
              )}
            </TouchableOpacity>

            {trips.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Your Trips</Text>
                <FlatList
                  data={trips}
                  keyExtractor={(trip) => trip.id}
                  style={styles.tripList}
                  renderItem={({ item: trip }) => {
                    const alreadyInTrip = isInTrip(trip.id);
                    const isLoading = loadingTripId === trip.id;
                    const isDisabled =
                      alreadyInTrip ||
                      isLoading ||
                      loadingTripId !== null ||
                      creatingNewTrip;

                    return (
                      <TouchableOpacity
                        style={[
                          styles.tripOption,
                          (alreadyInTrip || isLoading) &&
                            styles.tripOptionDisabled,
                        ]}
                        onPress={() => !isDisabled && handleAddToTrip(trip.id)}
                        disabled={isDisabled}
                      >
                        <View style={styles.tripInfo}>
                          <Text
                            style={[
                              styles.tripName,
                              (alreadyInTrip || isLoading) &&
                                styles.tripNameDisabled,
                            ]}
                          >
                            {trip.name}
                          </Text>
                          <Text
                            style={[
                              styles.tripDate,
                              (alreadyInTrip || isLoading) &&
                                styles.tripDateDisabled,
                            ]}
                          >
                            {formatTripDates(trip.start_date, trip.end_date)}
                          </Text>
                          <View style={styles.tripStats}>
                            <View style={styles.tripStat}>
                              <Ionicons
                                name="fitness"
                                size={12}
                                color={
                                  alreadyInTrip || isLoading
                                    ? theme.colors.lightGray
                                    : theme.colors.forest
                                }
                              />
                              <Text style={styles.tripStatText}>
                                {
                                  trip.items.filter(
                                    (i) => i.type === "activity"
                                  ).length
                                }
                              </Text>
                            </View>
                            <View style={styles.tripStat}>
                              <Ionicons
                                name="location"
                                size={12}
                                color={
                                  alreadyInTrip || isLoading
                                    ? theme.colors.lightGray
                                    : theme.colors.burntOrange
                                }
                              />
                              <Text style={styles.tripStatText}>
                                {
                                  trip.items.filter((i) => i.type === "spot")
                                    .length
                                }
                              </Text>
                            </View>
                          </View>
                        </View>
                        {isLoading ? (
                          <ActivityIndicator
                            size="small"
                            color={theme.colors.forest}
                          />
                        ) : alreadyInTrip ? (
                          <View style={styles.addedBadge}>
                            <Ionicons
                              name="checkmark-circle"
                              size={20}
                              color={theme.colors.forest}
                            />
                            <Text style={styles.addedText}>Added</Text>
                          </View>
                        ) : (
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={theme.colors.gray}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            )}

            {trips.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No trips yet</Text>
                <Text style={styles.emptySubtext}>
                  Create a new trip to organize your adventures
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 5,
  },
  iconContainer: {
    position: "relative",
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  plusBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.forest,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: theme.colors.white,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: "70%",
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
    fontWeight: "bold",
    color: theme.colors.navy,
  },
  closeButton: {
    padding: 5,
  },
  newTripOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: theme.colors.offWhite,
  },
  newTripOptionLoading: {
    opacity: 0.7,
  },
  newTripText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.burntOrange,
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderGray,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.gray,
    padding: 15,
    paddingBottom: 10,
  },
  tripList: {
    maxHeight: 400,
  },
  tripOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray + "30",
  },
  tripOptionDisabled: {
    backgroundColor: theme.colors.offWhite + "50",
  },
  tripInfo: {
    flex: 1,
  },
  tripName: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.navy,
    marginBottom: 4,
  },
  tripNameDisabled: {
    color: theme.colors.lightGray,
  },
  tripDate: {
    fontSize: 12,
    color: theme.colors.gray,
    marginBottom: 6,
  },
  tripDateDisabled: {
    color: theme.colors.lightGray,
  },
  tripStats: {
    flexDirection: "row",
    gap: 12,
  },
  tripStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tripStatText: {
    fontSize: 11,
    color: theme.colors.gray,
  },
  addedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addedText: {
    fontSize: 12,
    color: theme.colors.forest,
    fontWeight: "500",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
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
});

export default AddToTripButton;