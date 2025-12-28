import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { DurationInput } from "../components/DurationInput";
import { PhotoPicker } from "../components/PhotoPicker";
import { RouteEditorModal } from "../components/RouteEditorModal";
import { CameraCapture } from "../components/CameraCapture";
import { theme } from "../constants/theme";
import { useActivity } from "../contexts/ActivityContext";
import { useSettings } from "../contexts/SettingsContext";

export default function EditActivityScreen() {
  const { activityId } = useLocalSearchParams();
  const { activities, updateActivity } = useActivity();
  const { formatDistance, settings } = useSettings();
  const router = useRouter();

  const activity = activities.find((a) => a.id === activityId);

  const [name, setName] = useState(activity?.name || "");
  const [notes, setNotes] = useState(activity?.notes || "");
  const [route, setRoute] = useState(activity?.route || []);
  const [distance, setDistance] = useState(activity?.distance || 0);
  const [photos, setPhotos] = useState<string[]>(activity?.photos || []);
  const [showMap, setShowMap] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const [activityDate, setActivityDate] = useState(
    activity?.activityDate
      ? new Date(activity.activityDate)
      : new Date(activity?.startTime || Date.now())
  );
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const [durationHours, setDurationHours] = useState(
    Math.floor((activity?.duration || 0) / 3600).toString()
  );
  const [durationMinutes, setDurationMinutes] = useState(
    Math.floor(((activity?.duration || 0) % 3600) / 60).toString()
  );

  useEffect(() => {
    if (!activity) {
      Alert.alert("Error", "Activity not found", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [activity]);

  const handleSave = async () => {
    if (!activity) return;

    const updatedDuration =
      parseInt(durationHours || "0") * 3600 +
      parseInt(durationMinutes || "0") * 60;

    let averageSpeed = 0;
    if (distance > 0 && updatedDuration > 0) {
      averageSpeed = distance / 1000 / (updatedDuration / 3600);
    }

    const updatedActivity = {
      ...activity,
      name: name.trim(),
      notes: notes.trim(),
      route,
      distance,
      duration: updatedDuration,
      photos,
      averageSpeed,
      activityDate,
    };

    try {
      await updateActivity(activity.id, updatedActivity);
      Alert.alert("Success", "Activity updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to update activity");
    }
  };

  const handleRouteUpdate = (newRoute: any[], newDistance: number) => {
    setRoute(newRoute);
    setDistance(newDistance);
  };

  const handleCameraCapture = (uri: string) => {
    setPhotos((prev) => [...prev, uri]);
  };

  if (!activity) {
    return null;
  }

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={handleCameraCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Edit Activity</Text>
        <Text style={styles.subtitle}>
          {activity.isManualEntry ? "Manual Entry" : "Tracked Activity"}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Activity Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Activity name"
          placeholderTextColor={theme.colors.lightGray}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Duration</Text>
        <DurationInput
          hours={durationHours}
          minutes={durationMinutes}
          onHoursChange={setDurationHours}
          onMinutesChange={setDurationMinutes}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Activity Date</Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setDatePickerVisibility(true)}
        >
          <Ionicons name="calendar" size={20} color={theme.colors.forest} />
          <Text style={styles.dateText}>
            {activityDate.toLocaleDateString("en-US", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Distance: {formatDistance(distance)}</Text>
        <TouchableOpacity
          style={styles.mapButton}
          onPress={() => setShowMap(true)}
        >
          <Ionicons name="map" size={20} color={theme.colors.forest} />
          <Text style={styles.mapButtonText}>
            {route.length > 0 ? "Edit Route on Map" : "Draw Route on Map"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Photos ({photos.length})</Text>
        <PhotoPicker
          photos={photos}
          onPhotosChange={setPhotos}
          onOpenCamera={() => setShowCamera(true)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes..."
          placeholderTextColor={theme.colors.lightGray}
          multiline
          numberOfLines={4}
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Ionicons name="save" size={20} color="white" />
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      <RouteEditorModal
        visible={showMap}
        onClose={() => setShowMap(false)}
        onRouteUpdate={handleRouteUpdate}
        route={route}
        distance={distance}
        distanceUnit={settings.units === "imperial" ? "mi" : "km"}
      />

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={(date) => {
          setActivityDate(date);
          setDatePickerVisibility(false);
        }}
        onCancel={() => setDatePickerVisibility(false)}
        date={activityDate}
        maximumDate={new Date()}
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
  section: {
    padding: 20,
  },
  label: {
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
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  dateText: {
    fontSize: 16,
    color: theme.colors.navy,
    flex: 1,
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.forest,
    borderRadius: 8,
    padding: 14,
  },
  mapButtonText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.forest,
    marginLeft: 10,
    fontWeight: "500",
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