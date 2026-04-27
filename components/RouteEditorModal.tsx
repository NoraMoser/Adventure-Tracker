import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import { Modal, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Keyboard } from "react-native";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    Keyboard.dismiss();
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        {
          headers: {
            'User-Agent': 'ExplorAble-App/1.0'
          }
        }
      );
      
      if (!response.ok) {
        console.error("Search failed with status:", response.status);
        setSearching(false);
        return;
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        // Send coordinates to WebView to pan the map
        webViewRef.current?.injectJavaScript(`
          if (window.map) {
            window.map.setView([${lat}, ${lon}], 14);
          }
          true;
        `);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleDone = () => {
    // First, merge any extension points into the existing route
    webViewRef.current?.injectJavaScript(`
      (function() {
        // Merge extension points if any exist
        if (window.extensionPoints && window.extensionPoints.length > 0) {
          window.existingRoute = window.existingRoute.concat(window.extensionPoints);
          window.extensionPoints = [];
        }
        
        // If in redraw mode, finalize the new route
        if (window.isRedrawing && window.newRoutePoints && window.newRoutePoints.length > 0) {
          var pointsToSave = window.newRoutePoints.map(function(point) {
            return { latitude: point[0], longitude: point[1], timestamp: Date.now() };
          });
          var newDistance = window.calculateDistance(window.newRoutePoints);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'routeUpdated',
            route: pointsToSave,
            distance: newDistance
          }));
          return true;
        }
        
        // Send current route state (including merged extensions)
        if (window.existingRoute && window.existingRoute.length > 0) {
          var pointsToSave = window.existingRoute.map(function(point) {
            return { latitude: point[0], longitude: point[1], timestamp: Date.now() };
          });
          var newDistance = window.calculateDistance(window.existingRoute);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'routeUpdated',
            route: pointsToSave,
            distance: newDistance
          }));
          return true;
        }
        
        return false;
      })();
    `);
    
    // Small delay to ensure message is sent before closing
    setTimeout(() => {
      onClose();
    }, 150);
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
          <View style={styles.headerSpacer} />
        </View>
        
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={theme.colors.gray} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search for a location..."
              placeholderTextColor={theme.colors.lightGray}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {searching && <ActivityIndicator size="small" color={theme.colors.forest} />}
            {searchQuery.length > 0 && !searching && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color={theme.colors.gray} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={styles.searchButton} 
            onPress={handleSearch}
            disabled={!searchQuery.trim() || searching}
          >
            <Text style={styles.searchButtonText}>Go</Text>
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

        <TouchableOpacity style={styles.floatingDoneButton} onPress={handleDone}>
          <Text style={styles.floatingDoneButtonText}>Done</Text>
        </TouchableOpacity>
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
  headerSpacer: {
    width: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  floatingDoneButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: theme.colors.forest,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingDoneButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.navy,
  },
  searchButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
  },
  searchButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  webView: {
    flex: 1,
  },
});