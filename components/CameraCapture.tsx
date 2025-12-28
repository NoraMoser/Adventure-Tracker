import { Ionicons } from "@expo/vector-icons";
import { Camera, CameraView } from "expo-camera";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface CameraCaptureProps {
  onCapture: (uri: string) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const cameraRef = useRef<CameraView>(null);
  const [zoom, setZoom] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: true,
        });

        if (photo && photo.uri) {
          onCapture(photo.uri);
        }

        setTimeout(() => {
          onClose();
        }, 100);
      } catch (error) {
        console.error("Camera error:", error);
        Alert.alert("Error", "Failed to take picture");
        onClose();
      }
    } else {
      console.error("Camera ref not available");
      onClose();
    }
  };

  const handleClose = () => {
    setZoom(0);
    onClose();
  };

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission denied</Text>
        <TouchableOpacity style={styles.closeButtonAlt} onPress={onClose}>
          <Text style={styles.closeButtonAltText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        zoom={zoom}
      />
      <View style={styles.overlay}>
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setZoom(Math.max(0, zoom - 0.1))}
            disabled={zoom <= 0}
          >
            <Ionicons
              name="remove-circle"
              size={40}
              color={zoom <= 0 ? "rgba(255,255,255,0.3)" : "white"}
            />
          </TouchableOpacity>

          <View style={styles.zoomIndicator}>
            <Text style={styles.zoomText}>
              {zoom === 0 ? "1.0x" : `${(1 + zoom * 4).toFixed(1)}x`}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setZoom(Math.min(1, zoom + 0.1))}
            disabled={zoom >= 1}
          >
            <Ionicons
              name="add-circle"
              size={40}
              color={zoom >= 1 ? "rgba(255,255,255,0.3)" : "white"}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white",
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
  },
  zoomControls: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  zoomButton: {
    padding: 10,
  },
  zoomIndicator: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 20,
    minWidth: 70,
    alignItems: "center",
  },
  zoomText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  permissionText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    marginTop: 100,
  },
  closeButtonAlt: {
    marginTop: 20,
    alignSelf: "center",
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
  },
  closeButtonAltText: {
    color: "white",
    fontSize: 16,
  },
});