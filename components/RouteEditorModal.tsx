// components/RouteEditorModal.tsx

import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../constants/theme";
import { generateRouteEditorHTML } from "../utils/mapHelpers";

interface RouteEditorModalProps {
  visible: boolean;
  onClose: () => void;
  onRouteUpdate: (route: any[], distance: number) => void;
  route: any[];
  distance: number;
  distanceUnit: "km" | "mi";
}

export function RouteEditorModal({
  visible,
  onClose,
  onRouteUpdate,
  route,
  distance,
  distanceUnit,
}: RouteEditorModalProps) {
  const webViewRef = useRef<WebView>(null);

  const handleMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "routeUpdated") {
        onRouteUpdate(data.route || [], data.distance || 0);
      }
    } catch (error) {
      console.error("Error parsing map message:", error);
    }
  };

  const handleDone = () => {
    webViewRef.current?.injectJavaScript(`
      (function() {
        if (window.routeWasRedrawn && window.savedRedrawRoute) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'routeUpdated',
            route: window.savedRedrawRoute.route,
            distance: window.savedRedrawRoute.distance
          }));
          return true;
        }
        return false;
      })();
    `);
    setTimeout(() => {
      onClose();
    }, 100);
  };

  const injectedJavaScript = `
    (function() {
      const originalPostMessage = window.ReactNativeWebView.postMessage;
      window.ReactNativeWebView.postMessage = function(data) {
        originalPostMessage.call(window.ReactNativeWebView, data);
      };
      true;
    })();
  `;

  const mapHTML = generateRouteEditorHTML({
    route,
    distance,
    distanceUnit,
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.navy} />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Route</Text>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
        <WebView
          ref={webViewRef}
          style={styles.webView}
          source={{ html: mapHTML }}
          onMessage={handleMapMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={false}
          scrollEnabled={true}
          bounces={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled={true}
          mixedContentMode="compatibility"
          injectedJavaScript={injectedJavaScript}
          onError={(syntheticEvent) => {
            console.error("WebView error:", syntheticEvent.nativeEvent);
          }}
        />
      </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  doneButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  doneButtonText: {
    color: theme.colors.forest,
    fontSize: 16,
    fontWeight: "600",
  },
  webView: {
    flex: 1,
  },
});