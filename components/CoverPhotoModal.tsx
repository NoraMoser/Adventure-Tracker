// components/CoverPhotoModal.tsx

import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Image,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../constants/theme";

interface CoverPhotoModalProps {
  visible: boolean;
  onClose: () => void;
  photos: string[];
  onSave: (photo: string, position: { x: number; y: number }) => void;
  initialPosition?: { x: number; y: number };
}

export function CoverPhotoModal({
  visible,
  onClose,
  photos,
  onSave,
  initialPosition = { x: 0, y: 0 },
}: CoverPhotoModalProps) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [photoPosition, setPhotoPosition] = useState(initialPosition);
  const startPosition = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startPosition.current = photoPosition;
      },
      onPanResponderMove: (evt, gesture) => {
        setPhotoPosition({
          x: startPosition.current.x + gesture.dx,
          y: startPosition.current.y + gesture.dy,
        });
      },
    })
  ).current;

  const handleSelectPhoto = (index: number) => {
    setSelectedPhotoIndex(index);
    setPhotoPosition({ x: 0, y: 0 });
  };

  const handleSave = () => {
    if (selectedPhotoIndex !== null) {
      onSave(photos[selectedPhotoIndex], photoPosition);
      setSelectedPhotoIndex(null);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedPhotoIndex(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {selectedPhotoIndex !== null
                ? "Adjust Photo Position"
                : "Choose Cover Photo"}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          {selectedPhotoIndex === null ? (
            <ScrollView style={styles.photoGrid}>
              <View style={styles.photoGridContainer}>
                {photos.map((photo, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.photoGridItem}
                    onPress={() => handleSelectPhoto(index)}
                  >
                    <Image
                      source={{ uri: photo }}
                      style={styles.photoThumbnail}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.positionEditor}>
              <Text style={styles.dragHint}>Drag to adjust position</Text>
              
              <View style={styles.previewContainer}>
                <View
                  {...panResponder.panHandlers}
                  style={[
                    styles.draggableImage,
                    {
                      transform: [
                        { translateX: photoPosition.x },
                        { translateY: photoPosition.y },
                      ],
                    },
                  ]}
                >
                  <Image
                    source={{ uri: photos[selectedPhotoIndex] }}
                    style={styles.fullImage}
                  />
                </View>
              </View>
              
              <Text style={styles.positionText}>
                Position: X={photoPosition.x.toFixed(0)}, Y={photoPosition.y.toFixed(0)}
              </Text>
              
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Use This Photo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
  },
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    maxHeight: "70%",
    marginHorizontal: 20,
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
  photoGrid: {
    padding: 10,
    maxHeight: 400,
  },
  photoGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  photoGridItem: {
    width: "31%",
    aspectRatio: 1,
    marginBottom: 10,
  },
  photoThumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  positionEditor: {
    padding: 20,
  },
  dragHint: {
    textAlign: "center",
    marginBottom: 10,
    color: theme.colors.gray,
  },
  previewContainer: {
    width: "100%",
    height: 200,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: theme.colors.offWhite,
    borderWidth: 2,
    borderColor: theme.colors.forest,
  },
  draggableImage: {
    position: "absolute",
    width: 900,
    height: 900,
    left: -300,
    top: -350,
  },
  fullImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  positionText: {
    textAlign: "center",
    marginTop: 10,
    fontSize: 12,
    color: theme.colors.gray,
  },
  saveButton: {
    backgroundColor: theme.colors.forest,
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    alignItems: "center",
  },
  saveButtonText: {
    color: theme.colors.white,
    fontWeight: "600",
  },
});