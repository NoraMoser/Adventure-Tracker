// app/save-location.tsx - Example implementation with auto-add to trips
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
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
import { categories, CategoryType } from "../constants/categories";
import { theme } from "../constants/theme";
import { useLocation } from "../contexts/LocationContext";
import { useAutoAddToTrip } from "../hooks/useAutoAddToTrip";

export default function SaveLocationScreen() {
  const router = useRouter();
  const { location, saveCurrentLocation } = useLocation();
  const { checkAndAddToTrip } = useAutoAddToTrip(); // Add the hook

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryType>("other");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a location name");
      return;
    }

    if (!location) {
      Alert.alert(
        "Error",
        "Location not available. Please enable location services."
      );
      return;
    }

    setSaving(true);
    try {
      // Save the location
      await saveCurrentLocation(
        name.trim(),
        description.trim(),
        [], // photos can be added later
        category,
        new Date()
      );

      // Create the spot object manually since saveCurrentLocation returns void
      const savedSpot: any = {
        id: Date.now().toString(),
        name: name.trim(),
        description: description.trim(),
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        category: category,
        photos: [],
        timestamp: new Date().toISOString(),
        locationDate: new Date().toISOString(),
      };

      // Auto-add to trip if applicable
      const trip: any = await checkAndAddToTrip(
        savedSpot,
        "spot",
        savedSpot.name,
        {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        true // prompt user
      );

      if (trip && trip.name && trip.id) {
        Alert.alert("Success!", `Location saved and added to "${trip.name}"!`, [
          {
            text: "View Trip",
            onPress: () => router.push(`/trip-detail?tripId=${trip.id}`),
          },
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      } else {
        Alert.alert("Success", "Location saved successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error("Error saving location:", error);
      Alert.alert("Error", "Failed to save location");
    } finally {
      setSaving(false);
    }
  };

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
          <Text style={styles.title}>Save Current Location</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {location && (
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={20} color={theme.colors.forest} />
              <View style={styles.locationDetails}>
                <Text style={styles.locationText}>Current Location</Text>
                <Text style={styles.coordinates}>
                  {location.latitude.toFixed(4)},{" "}
                  {location.longitude.toFixed(4)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Favorite Coffee Shop"
                placeholderTextColor={theme.colors.lightGray}
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="What makes this place special?"
                placeholderTextColor={theme.colors.lightGray}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {Object.entries(categories)
                  .filter(([key]) => key !== "all")
                  .map(([key, cat]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.categoryItem,
                        category === key && styles.categoryItemSelected,
                      ]}
                      onPress={() => setCategory(key as CategoryType)}
                    >
                      <View
                        style={[
                          styles.categoryIcon,
                          { backgroundColor: cat.color + "20" },
                        ]}
                      >
                        <Ionicons
                          name={cat.icon as any}
                          size={20}
                          color={cat.color}
                        />
                      </View>
                      <Text
                        style={[
                          styles.categoryLabel,
                          category === key && styles.categoryLabelSelected,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving || !name.trim()}
            >
              <Ionicons name="save" size={20} color="white" />
              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Save Location"}
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
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.forest + "10",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.forest + "20",
  },
  locationDetails: {
    marginLeft: 12,
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.forest,
  },
  coordinates: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 8,
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
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryItemSelected: {
    borderColor: theme.colors.forest,
    borderWidth: 2,
  },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  categoryLabel: {
    fontSize: 14,
    color: theme.colors.navy,
  },
  categoryLabelSelected: {
    fontWeight: "600",
    color: theme.colors.forest,
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
