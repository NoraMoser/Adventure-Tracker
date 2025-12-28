import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../constants/theme";
import { RoutePoint } from "../types/activity";

interface RouteMapProps {
  route: RoutePoint[];
  height?: number;
  title?: string;
}

const generateRouteMapHTML = (route: RoutePoint[]): string => {
  if (!route || route.length === 0) return "";

  const coordinates = route
    .map((p) => `[${p.latitude}, ${p.longitude}]`)
    .join(",");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100%; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap'
        }).addTo(map);
        
        var coordinates = [${coordinates}];
        var polyline = L.polyline(coordinates, {
          color: '#2d5a3d',
          weight: 3
        }).addTo(map);
        
        L.marker(coordinates[0]).addTo(map).bindPopup('Start');
        L.marker(coordinates[coordinates.length - 1]).addTo(map).bindPopup('End');
        
        map.fitBounds(polyline.getBounds().pad(0.1));
      </script>
    </body>
    </html>
  `;
};

export function RouteMap({ route, height = 200, title = "Route" }: RouteMapProps) {
  if (!route || route.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <WebView
        style={[styles.map, { height }]}
        source={{ html: generateRouteMapHTML(route) }}
        scrollEnabled={false}
        scalesPageToFit={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  map: {
    borderRadius: 8,
  },
});