// components/PhotoPicker.tsx

import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../constants/theme";

interface PhotoPickerProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onOpenCamera: () => void;
}

export function PhotoPicker({
  photos,
  onPhotosChange,
  onOpenCamera,
}: PhotoPickerProps) {
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Media library permission is required to select photos"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhotos = result.assets.map((asset) => asset.uri);
      onPhotosChange([...photos, ...newPhotos]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  return (
    <View>
      <View style={styles.photoActions}>
        <TouchableOpacity style={styles.photoButton} onPress={onOpenCamera}>
          <Ionicons name="camera" size={20} color={theme.colors.forest} />
          <Text style={styles.photoButtonText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoButton} onPress={handlePickImage}>
          <Ionicons name="images" size={20} color={theme.colors.forest} />
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
  );
}

const styles = StyleSheet.create({
  photoActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 15,
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    paddingHorizontal: 20,
    paddingVertical: 10,
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
    marginBottom: 15,
    maxHeight: 110,
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
});