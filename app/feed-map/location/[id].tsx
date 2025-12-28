import { Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../../../constants/theme";
import { useFriends } from "../../../contexts/FriendsContext";

export default function FeedLocationMapScreen() {
  const { id } = useLocalSearchParams();
  const { feed } = useFriends();
  
  const item = feed.find(item => item.id === id && item.type === 'location');
  
  // Check both item existence AND location property existence
  if (!item || !item.data.location) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Location",
            headerStyle: { backgroundColor: theme.colors.forest },
            headerTintColor: "#fff",
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Location not found</Text>
        </View>
      </View>
    );
  }

  const generateFullMapHTML = () => {
    const location = item.data.location!; // Safe to use ! here after the check above
    const name = item.data.name || "Location";
    const description = item.data.description || "";

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
          var map = L.map('map').setView([${location.latitude}, ${location.longitude}], 15);
          
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 18
          }).addTo(map);
          
          L.marker([${location.latitude}, ${location.longitude}])
            .addTo(map)
            .bindPopup('<b>${name.replace(/'/g, "\\'")}</b>${description ? '<br>' + description.replace(/'/g, "\\'") : ''}')
            .openPopup();
        </script>
      </body>
      </html>
    `;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: item.data.name || "Location Map",
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