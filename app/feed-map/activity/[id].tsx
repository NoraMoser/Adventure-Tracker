// app/feed-map/activity/[id].tsx
import { Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../../../constants/theme";
import { useFriends } from "../../../contexts/FriendsContext";

export default function FeedActivityMapScreen() {
  const { id } = useLocalSearchParams();
  const { feed } = useFriends();
  
  const item = feed.find(item => item.id === id && item.type === 'activity');
  
  // Check both item existence AND route array existence
  if (!item || !item.data.route || item.data.route.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Activity",
            headerStyle: { backgroundColor: theme.colors.forest },
            headerTintColor: "#fff",
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Activity route not found</Text>
        </View>
      </View>
    );
  }

  const generateFullMapHTML = () => {
    const route = item.data.route!; // Safe to use ! here after the check above
    const coords = route.map((p: any) => `[${p.latitude}, ${p.longitude}]`).join(',');
    const center = route[Math.floor(route.length / 2)];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { height: 100vh; width: 100vw; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([${center.latitude}, ${center.longitude}], 14);
          
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 18
          }).addTo(map);
          
          var route = L.polyline([${coords}], {
            color: '#2d5a3d',
            weight: 4,
            opacity: 0.8
          }).addTo(map);
          
          // Add start marker
          L.circleMarker([${route[0].latitude}, ${route[0].longitude}], {
            radius: 8,
            fillColor: '#4CAF50',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(map).bindPopup('<b>Start</b>');
          
          // Add end marker
          L.circleMarker([${route[route.length - 1].latitude}, ${route[route.length - 1].longitude}], {
            radius: 8,
            fillColor: '#FF4757',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(map).bindPopup('<b>Finish</b>');
          
          map.fitBounds(route.getBounds().pad(0.1));
        </script>
      </body>
      </html>
    `;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: item.data.name || "Activity Map",
          headerStyle: { backgroundColor: theme.colors.forest },
          headerTintColor: "#fff",
        }}
      />
      <WebView
        source={{ html: generateFullMapHTML() }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  map: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.gray,
  },
});