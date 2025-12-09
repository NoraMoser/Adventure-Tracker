// components/RouteDrawerModal.tsx

import React, { useRef } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../constants/theme";
import { RoutePoint } from "../types/activity";
import { generateRouteDrawerHTML } from "../utils/mapHelpers";

interface RouteDrawerModalProps {
  visible: boolean;
  onClose: () => void;
  onRouteUpdate: (route: RoutePoint[], distance: number) => void;
  centerLat: number;
  centerLng: number;
  distanceUnit: "km" | "mi";
  existingRoute?: RoutePoint[];
}

export function RouteDrawerModal({
  visible,
  onClose,
  onRouteUpdate,
  centerLat,
  centerLng,
  distanceUnit,
  existingRoute = [],
}: RouteDrawerModalProps) {
  const webViewRef = useRef<WebView>(null);

  const handleMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "routeUpdated") {
        onRouteUpdate(data.route, data.distance);
      }
    } catch (error) {
      console.error("Error parsing map message:", error);
    }
  };

  const mapHTML = generateRouteDrawerHTML({
    centerLat,
    centerLng,
    distanceUnit,
    existingRoute,
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Draw Your Route</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
        <WebView
          ref={webViewRef}
          style={styles.webView}
          source={{ html: mapHTML }}
          onMessage={handleMapMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 16,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.forest,
    borderRadius: 16,
  },
  closeButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  webView: {
    flex: 1,
  },
});