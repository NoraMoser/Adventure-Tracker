import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../constants/theme";
import { generateRouteDrawerHTML } from "../utils/mapHelpers";

interface RouteDrawerModalProps {
  visible: boolean;
  onClose: () => void;
  onRouteUpdate: (route: any[], distance: number) => void;
  centerLat: number;
  centerLng: number;
  distanceUnit: "km" | "mi";
  existingRoute?: any[];
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
  const [webViewReady, setWebViewReady] = useState(false);

  // Delay WebView mount on Android to avoid Modal rendering issues
  useEffect(() => {
    if (visible && Platform.OS === "android") {
      setWebViewReady(false);
      const timer = setTimeout(() => {
        setWebViewReady(true);
      }, 300);
      return () => clearTimeout(timer);
    } else if (visible) {
      setWebViewReady(true);
    } else {
      setWebViewReady(false);
    }
  }, [visible]);

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

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error("WebView error:", nativeEvent);
  };

  // Only generate HTML once when modal becomes visible
  const mapHTML = useMemo(() => {
    if (!visible) return "";
    return generateRouteDrawerHTML({
      centerLat,
      centerLng,
      distanceUnit,
      existingRoute,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, centerLat, centerLng, distanceUnit]); // Intentionally exclude existingRoute

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
        {webViewReady ? (
          <WebView
            ref={webViewRef}
            style={styles.webView}
            source={{ html: mapHTML }}
            onMessage={handleMapMessage}
            onError={handleError}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={["*"]}
            mixedContentMode="always"
            scrollEnabled={true}
            androidLayerType="none"
            setSupportMultipleWindows={false}
            overScrollMode="never"
            startInLoadingState={true}
            cacheEnabled={true}
          />
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.forest} />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}
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
    opacity: 0.99,
    backgroundColor: "transparent",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.gray,
  },
});