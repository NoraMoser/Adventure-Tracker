import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../constants/theme";
import { generateRouteDrawerHTML } from "../utils/mapHelpers";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

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
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.navy} />
          </TouchableOpacity>
          <Text style={styles.title}>Draw Your Route</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
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
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  closeButtonText: {
    color: theme.colors.forest,
    fontSize: 16,
    fontWeight: "600",
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