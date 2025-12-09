// app/add-activity.tsx

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ActivityTypeSelector } from "../components/ActivityTypeSelector";
import { CameraCapture } from "../components/CameraCapture";
import { DurationInput } from "../components/DurationInput";
import { PhotoPicker } from "../components/PhotoPicker";
import { RouteDrawerModal } from "../components/RouteDrawerModal";
import { theme } from "../constants/theme";
import { ActivityType, useActivity } from "../contexts/ActivityContext";
import { useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext";
import { useAutoAddToTrip } from "../hooks/useAutoAddToTrip";

export default function AddActivityScreen() {
  const { addManualActivity } = useActivity();
  const { settings } = useSettings();
  const { location: currentLocation } = useLocation();
  const router = useRouter();
  const { checkAndAddToTrip } = useAutoAddToTrip();

  // Form state
  const [activityType, setActivityType] = useState<ActivityType>(
    settings.defaultActivityType || "bike"
  );
  const [name, setName] = useState("");
  const [activityDate, setActivityDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration] = useState({ hours: "0", minutes: "0" });
  const [distance, setDistance] = useState("");
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">(
    settings.units === "imperial" ? "mi" : "km"
  );
  const [notes, setNotes] = useState("");
  const [drawnRoute, setDrawnRoute] = useState<any[]>([]);
  const [routeDistance, setRouteDistance] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);

  // Modal state
  const [showMapModal, setShowMapModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter an activity name");
      return;
    }

    const durationInSeconds =
      (parseInt(duration.hours) || 0) * 3600 +
      (parseInt(duration.minutes) || 0) * 60;

    if (durationInSeconds === 0) {
      Alert.alert("Error", "Please enter the activity duration");
      return;
    }

    // Use route distance if available, otherwise use manual distance
    let distanceInMeters = routeDistance;
    if (!distanceInMeters && distance) {
      const distanceValue = parseFloat(distance);
      distanceInMeters =
        distanceUnit === "km" ? distanceValue * 1000 : distanceValue * 1609.34;
    }

    // Calculate average speed
    const avgSpeed =
      distanceInMeters > 0
        ? distanceInMeters / 1000 / (durationInSeconds / 3600)
        : 0;

    // Combine date and time
    const combinedDateTime = new Date(activityDate);
    combinedDateTime.setHours(startTime.getHours());
    combinedDateTime.setMinutes(startTime.getMinutes());

    const activity = {
      type: activityType,
      name: name.trim(),
      activityDate: activityDate,
      startTime: combinedDateTime,
      endTime: new Date(combinedDateTime.getTime() + durationInSeconds * 1000),
      duration: durationInSeconds,
      distance: distanceInMeters,
      route: drawnRoute,
      averageSpeed: avgSpeed,
      maxSpeed: avgSpeed,
      notes: notes.trim(),
      photos: photos,
      isManualEntry: true,
    };

    try {
      const savedActivity = await addManualActivity(activity);

      // Determine location for trip checking
      let activityLocation = null;
      if (drawnRoute && drawnRoute.length > 0) {
        activityLocation = {
          latitude: drawnRoute[0].latitude,
          longitude: drawnRoute[0].longitude,
        };
      } else if (currentLocation) {
        activityLocation = currentLocation;
      }

      // Check for trips if we have a location
      if (activityLocation) {
        const trip = (await checkAndAddToTrip(
          savedActivity,
          "activity",
          savedActivity.name,
          activityLocation,
          true
        )) as { name?: string; id?: string } | null;

        if (trip?.name && trip?.id) {
          Alert.alert(
            "Success!",
            `Activity saved and added to "${trip.name}"!`,
            [
              {
                text: "View Trip",
                onPress: () => router.push(`/trip-detail?tripId=${trip.id}`),
              },
              { text: "OK", onPress: () => router.back() },
            ]
          );
          return;
        }
      }

      Alert.alert("Success", "Activity added successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error saving activity:", error);
      Alert.alert("Error", "Failed to save activity");
    }
  };

  const handleRouteUpdate = (route: any[], distanceMeters: number) => {
    setDrawnRoute(route);
    setRouteDistance(distanceMeters);

    if (distanceMeters > 0) {
      const displayDistance =
        distanceUnit === "km"
          ? (distanceMeters / 1000).toFixed(2)
          : (distanceMeters / 1609.34).toFixed(2);
      setDistance(displayDistance);
    }
  };

  const handlePhotoCapture = (uri: string) => {
    setPhotos((prev) => [...prev, uri]);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Show camera fullscreen
  if (showCamera) {
    return (
      <CameraCapture
        onCapture={handlePhotoCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Past Activity</Text>
        <Text style={styles.subtitle}>
          Record an activity you forgot to track
        </Text>
        {settings.defaultActivityType && (
          <Text style={styles.defaultNote}>
            Default:{" "}
            {settings.defaultActivityType.charAt(0).toUpperCase() +
              settings.defaultActivityType.slice(1)}
          </Text>
        )}
      </View>

      {/* Activity Type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Type</Text>
        <ActivityTypeSelector
          selectedType={activityType}
          onSelectType={setActivityType}
        />
      </View>

      {/* Activity Name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Morning bike ride, Trail run, etc."
          placeholderTextColor={theme.colors.lightGray}
        />
      </View>

      {/* Date & Time */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Date & Time</Text>
        <View style={styles.dateTimeContainer}>
          <TouchableOpacity
            style={[styles.dateTimeButton, styles.dateButton]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={theme.colors.navy}
            />
            <View style={styles.dateTimeContent}>
              <Text style={styles.dateTimeLabel}>Date</Text>
              <Text style={styles.dateTimeValue}>{formatDate(activityDate)}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Ionicons name="time-outline" size={20} color={theme.colors.navy} />
            <View style={styles.dateTimeContent}>
              <Text style={styles.dateTimeLabel}>Start Time</Text>
              <Text style={styles.dateTimeValue}>{formatTime(startTime)}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={activityDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setActivityDate(selectedDate);
          }}
          maximumDate={new Date()}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) setStartTime(selectedTime);
          }}
        />
      )}

      {/* Duration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Duration *</Text>
        <DurationInput
          hours={duration.hours}
          minutes={duration.minutes}
          onHoursChange={(h) => setDuration({ ...duration, hours: h })}
          onMinutesChange={(m) => setDuration({ ...duration, minutes: m })}
        />
      </View>

      {/* Route */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route (Optional)</Text>
        <TouchableOpacity
          style={styles.drawRouteButton}
          onPress={() => setShowMapModal(true)}
        >
          <Ionicons name="map" size={20} color={theme.colors.forest} />
          <Text style={styles.drawRouteText}>
            {drawnRoute.length > 0
              ? `Route drawn (${drawnRoute.length} points)`
              : "Draw route on map"}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.forest} />
        </TouchableOpacity>
      </View>

      {/* Distance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Distance {routeDistance > 0 ? "(from route)" : "(Optional)"}
        </Text>
        <View style={styles.distanceContainer}>
          <TextInput
            style={[styles.input, styles.distanceInput]}
            value={distance}
            onChangeText={setDistance}
            keyboardType="decimal-pad"
            placeholder="0.0"
            editable={!routeDistance}
          />
          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[
                styles.unitButton,
                distanceUnit === "km" && styles.unitButtonActive,
              ]}
              onPress={() => setDistanceUnit("km")}
            >
              <Text
                style={[
                  styles.unitText,
                  distanceUnit === "km" && styles.unitTextActive,
                ]}
              >
                km
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.unitButton,
                distanceUnit === "mi" && styles.unitButtonActive,
              ]}
              onPress={() => setDistanceUnit("mi")}
            >
              <Text
                style={[
                  styles.unitText,
                  distanceUnit === "mi" && styles.unitTextActive,
                ]}
              >
                mi
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes (Optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="How was it? Any details to remember..."
          placeholderTextColor={theme.colors.lightGray}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Photos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Photos (Optional)</Text>
        <PhotoPicker
          photos={photos}
          onPhotosChange={setPhotos}
          onOpenCamera={() => setShowCamera(true)}
        />
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Ionicons name="save-outline" size={20} color={theme.colors.white} />
        <Text style={styles.saveButtonText}>Save Activity</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      {/* Route Drawer Modal */}
      <RouteDrawerModal
        visible={showMapModal}
        onClose={() => setShowMapModal(false)}
        onRouteUpdate={handleRouteUpdate}
        centerLat={currentLocation?.latitude || 47.6062}
        centerLng={currentLocation?.longitude || -122.3321}
        distanceUnit={distanceUnit}
        existingRoute={drawnRoute}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  header: {
    padding: 20,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 5,
  },
  defaultNote: {
    fontSize: 12,
    color: theme.colors.forest,
    marginTop: 5,
    fontStyle: "italic",
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 12,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.navy,
  },
  dateTimeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    marginHorizontal: 5,
  },
  dateButton: {
    flex: 1.2,
  },
  dateTimeContent: {
    marginLeft: 10,
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 11,
    color: theme.colors.gray,
    marginBottom: 2,
  },
  dateTimeValue: {
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  drawRouteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.forest,
    borderRadius: 8,
    padding: 14,
  },
  drawRouteText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.forest,
    marginLeft: 10,
    fontWeight: "500",
  },
  distanceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  distanceInput: {
    flex: 1,
    marginRight: 10,
  },
  unitToggle: {
    flexDirection: "row",
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  unitButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  unitButtonActive: {
    backgroundColor: theme.colors.forest,
    borderRadius: 6,
  },
  unitText: {
    fontSize: 14,
    color: theme.colors.gray,
    fontWeight: "500",
  },
  unitTextActive: {
    color: theme.colors.white,
  },
  notesInput: {
    height: 100,
  },
  saveButton: {
    backgroundColor: theme.colors.forest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
  },
  cancelButton: {
    padding: 16,
    alignItems: "center",
    marginBottom: 30,
  },
  cancelButtonText: {
    color: theme.colors.burntOrange,
    fontSize: 16,
  },
});