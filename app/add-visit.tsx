import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraCapture } from "../components/CameraCapture";
import { theme } from "../constants/theme";
import { useLocation } from "../contexts/LocationContext";
import * as ImagePicker from "expo-image-picker";
import { useAutoAddToTrip } from "../hooks/useAutoAddToTrip";
import { useTrips } from "../contexts/TripContext";


export default function AddVisitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ spotId: string; spotName: string }>();
  const { addVisitToSpot, savedSpots } = useLocation();
  const { checkAndAddToTrip } = useAutoAddToTrip();
  const [visitDate, setVisitDate] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const { refreshTrips } = useTrips();


  const handleSave = async () => {
    if (!params.spotId) {
      Alert.alert("Error", "Missing spot information");
      return;
    }

    setSaving(true);
    try {
      console.log("💾 Starting visit save...");
      
      // Get the updated spot directly from addVisitToSpot
      const updatedSpot = await addVisitToSpot(
        params.spotId,
        visitDate,
        photos,
        notes || undefined,
      );

      // Wait for database sync to complete before refreshing trips
      // This ensures the trip_items updates have time to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await refreshTrips();

      if (updatedSpot) {
        // Check if they want to add to a trip
        const trip = (await checkAndAddToTrip(
          updatedSpot,
          "spot",
          updatedSpot.name,
          updatedSpot.location,
          true, // Ask user
        )) as { name?: string; id?: string } | null;

        if (trip?.name && trip?.id) {
          Alert.alert("Success!", `Visit logged and added to "${trip.name}"!`, [
            { text: "OK", onPress: () => router.back() },
          ]);
        } else {
          Alert.alert("Success", "Visit logged successfully!", [
            { text: "OK", onPress: () => router.back() },
          ]);
        }
      } else {
        Alert.alert("Success", "Visit logged successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to log visit");
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Media library permission is required");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhotos = result.assets.map((asset) => asset.uri);
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const adjustDate = (days: number) => {
    const newDate = new Date(visitDate);
    newDate.setDate(newDate.getDate() + days);
    setVisitDate(newDate);
  };

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={(uri) => {
          setPhotos((prev) => [...prev, uri]);
        }}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.navy} />
          </TouchableOpacity>
          <Text style={styles.title}>Add Visit</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.spotInfo}>
            <Ionicons name="location" size={20} color={theme.colors.forest} />
            <Text style={styles.spotName}>{params.spotName}</Text>
          </View>

          <View style={styles.form}>
            {/* Date Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Visit Date</Text>
              <View style={styles.dateContainer}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => adjustDate(-1)}
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={theme.colors.navy}
                  />
                </TouchableOpacity>

                <View style={styles.dateDisplay}>
                  <Text style={styles.dateText}>{formatDate(visitDate)}</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.dateButton,
                    visitDate >= new Date() && styles.dateButtonDisabled,
                  ]}
                  onPress={() => adjustDate(1)}
                  disabled={visitDate >= new Date()}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={
                      visitDate >= new Date()
                        ? theme.colors.lightGray
                        : theme.colors.navy
                    }
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.quickDateButtons}>
                <TouchableOpacity
                  style={styles.quickDateButton}
                  onPress={() => setVisitDate(new Date())}
                >
                  <Text style={styles.quickDateButtonText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickDateButton}
                  onPress={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    setVisitDate(yesterday);
                  }}
                >
                  <Text style={styles.quickDateButtonText}>Yesterday</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickDateButton}
                  onPress={() => {
                    const lastWeek = new Date();
                    lastWeek.setDate(lastWeek.getDate() - 7);
                    setVisitDate(lastWeek);
                  }}
                >
                  <Text style={styles.quickDateButtonText}>Last Week</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Photos */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Photos (Optional)</Text>
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => setShowCamera(true)}
                >
                  <Ionicons
                    name="camera"
                    size={20}
                    color={theme.colors.forest}
                  />
                  <Text style={styles.photoButtonText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={handlePickImage}
                >
                  <Ionicons
                    name="images"
                    size={20}
                    color={theme.colors.forest}
                  />
                  <Text style={styles.photoButtonText}>Gallery</Text>
                </TouchableOpacity>
              </View>

              {photos.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photoList}
                >
                  {photos.map((photo, index) => (
                    <View key={index} style={styles.photoContainer}>
                      <Image source={{ uri: photo }} style={styles.photo} />
                      <TouchableOpacity
                        style={styles.removePhotoButton}
                        onPress={() => handleRemovePhoto(index)}
                      >
                        <Ionicons
                          name="close-circle"
                          size={24}
                          color={theme.colors.burntOrange}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="How was this visit? Any highlights?"
                placeholderTextColor={theme.colors.lightGray}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text style={styles.saveButtonText}>
                {saving ? "Adding..." : "Add Visit"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  content: {
    flex: 1,
  },
  spotInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest + "10",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.forest + "20",
  },
  spotName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.forest,
    marginLeft: 12,
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    padding: 12,
  },
  dateButton: {
    padding: 8,
  },
  dateButtonDisabled: {
    opacity: 0.3,
  },
  dateDisplay: {
    flex: 1,
    alignItems: "center",
  },
  dateText: {
    fontSize: 16,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  quickDateButtons: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  quickDateButton: {
    flex: 1,
    backgroundColor: "white",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    alignItems: "center",
  },
  quickDateButtonText: {
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "white",
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
  photoActions: {
    flexDirection: "row",
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.forest,
  },
  photoButtonText: {
    color: theme.colors.forest,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  photoList: {
    marginTop: 12,
  },
  photoContainer: {
    marginRight: 10,
    position: "relative",
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "white",
    borderRadius: 12,
  },
  actions: {
    padding: 16,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.forest,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  cancelButton: {
    alignItems: "center",
    padding: 12,
  },
  cancelButtonText: {
    color: theme.colors.burntOrange,
    fontSize: 16,
  },
});