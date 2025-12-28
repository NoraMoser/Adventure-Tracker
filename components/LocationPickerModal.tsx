import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../constants/theme";

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (latitude: number, longitude: number) => void;
  initialLatitude?: number;
  initialLongitude?: number;
}

export function LocationPickerModal({
  visible,
  onClose,
  onLocationSelect,
  initialLatitude = 47.6062,
  initialLongitude = -122.3321,
}: LocationPickerModalProps) {
  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
        .info-box {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(255,255,255,0.95);
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          border: 2px solid #2d5a3d;
          z-index: 1000;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div class="info-box">📍 Tap to select location</div>
      <script>
        var map = L.map('map').setView([${initialLatitude}, ${initialLongitude}], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        var marker = L.marker([${initialLatitude}, ${initialLongitude}]).addTo(map);
        
        map.on('click', function(e) {
          marker.setLatLng(e.latlng);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            latitude: e.latlng.lat,
            longitude: e.latlng.lng
          }));
        });
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      onLocationSelect(data.latitude, data.longitude);
    } catch (error) {
      console.error("Error parsing location:", error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Location</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.navy} />
          </TouchableOpacity>
        </View>

        <WebView
          source={{ html: mapHTML }}
          style={styles.map}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />

        <TouchableOpacity style={styles.doneButton} onPress={onClose}>
          <Text style={styles.doneButtonText}>Done</Text>
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
    padding: 16,
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
    padding: 4,
  },
  map: {
    flex: 1,
  },
  doneButton: {
    backgroundColor: theme.colors.forest,
    padding: 16,
    alignItems: "center",
  },
  doneButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});