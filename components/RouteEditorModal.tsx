import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.navy} />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Route</Text>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done</Text>
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