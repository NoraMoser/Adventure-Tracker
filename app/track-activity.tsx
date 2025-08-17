import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../constants/theme";
import { ActivityType, useActivity } from "../contexts/ActivityContext";

const activityTypes: { type: ActivityType; label: string; icon: string }[] = [
  { type: "bike", label: "Bike", icon: "bicycle" },
  { type: "run", label: "Run", icon: "walk" },
  { type: "walk", label: "Walk", icon: "footsteps" },
  { type: "hike", label: "Hike", icon: "trail-sign" },
  { type: "paddleboard", label: "Paddle", icon: "boat" },
  { type: "climb", label: "Climb", icon: "trending-up" },
  { type: "other", label: "Other", icon: "fitness" },
];

export default function TrackActivityScreen() {
  const {
    isTracking,
    isPaused,
    currentDistance,
    currentDuration,
    currentSpeed,
    currentRoute,
    location: currentLocation,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    loading,
    error,
  } = useActivity();

  const router = useRouter();
  const [selectedActivity, setSelectedActivity] =
    useState<ActivityType>("bike");
  const [activityName, setActivityName] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Generate Leaflet HTML for the route
  const generateRouteMapHTML = () => {
    if (currentRoute.length === 0) {
      // Show current location if no route yet
      const center = currentLocation || {
        latitude: 47.6062,
        longitude: -122.3321,
      };
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
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap',
              maxZoom: 19
            }).addTo(map);

            // Add current position marker
            L.circleMarker([${center.latitude}, ${center.longitude}], {
              radius: 8,
              fillColor: '#2d5a3d',
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map);
          </script>
        </body>
        </html>
      `;
    }

    const firstPoint = currentRoute[0];
    const lastPoint = currentRoute[currentRoute.length - 1];
    const routeCoords = currentRoute
      .map((point) => `[${point.latitude}, ${point.longitude}]`)
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
          #map { height: 100vh; width: 100vw; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map');
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
          }).addTo(map);

          // Draw the route with theme color
          var routeCoords = [${routeCoords}];
          if (routeCoords.length > 0) {
            var polyline = L.polyline(routeCoords, {
              color: '#2d5a3d', // forest green
              weight: 5,
              opacity: 0.8
            }).addTo(map);

            // Add start marker with theme color
            L.circleMarker(routeCoords[0], {
              radius: 8,
              fillColor: '#2d5a3d',
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 1
            }).addTo(map).bindPopup('Start');

            // Add current position marker with accent color
            L.circleMarker(routeCoords[routeCoords.length - 1], {
              radius: 10,
              fillColor: '#cc5500',
              color: '#fff',
              weight: 3,
              opacity: 1,
              fillOpacity: 1
            }).addTo(map).bindPopup('Current');

            // Fit map to route with good padding
            map.fitBounds(polyline.getBounds().pad(0.2));
            
            // Don't zoom in too far
            if (map.getZoom() > 16) {
              map.setZoom(16);
            }
          }
        </script>
      </body>
      </html>
    `;
  };

  useEffect(() => {
    if (error) {
      Alert.alert("Error", error);
    }
  }, [error]);

  const handleStart = async () => {
    await startTracking(selectedActivity);
  };

  const handlePause = () => {
    pauseTracking();
  };

  const handleResume = () => {
    resumeTracking();
  };

  const handleStop = () => {
    setShowSaveDialog(true);
  };

  const handleSaveActivity = async () => {
    const name = activityName.trim() || `${selectedActivity} activity`;
    await stopTracking(name, activityNotes);
    setActivityName("");
    setActivityNotes("");
    setShowSaveDialog(false);
    Alert.alert("Success", "Activity saved!", [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  const handleCancel = () => {
    Alert.alert(
      "Discard Activity?",
      "Are you sure you want to discard this activity?",
      [
        { text: "Keep Recording", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            await stopTracking("", "");
            router.back();
          },
        },
      ]
    );
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDistance = (meters: number) => {
    const miles = meters * 0.000621371;
    return `${miles.toFixed(2)} mi`;
  };

  const formatSpeed = (kmh: number) => {
    const mph = kmh * 0.621371;
    return `${mph.toFixed(1)} mph`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Starting activity tracking...</Text>
      </View>
    );
  }

  if (!isTracking && !showSaveDialog) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Activity Type</Text>
        </View>

        <View style={styles.activityGrid}>
          {activityTypes.map((activity) => (
            <TouchableOpacity
              key={activity.type}
              style={[
                styles.activityCard,
                selectedActivity === activity.type &&
                  styles.activityCardSelected,
              ]}
              onPress={() => setSelectedActivity(activity.type)}
            >
              <Ionicons
                name={activity.icon as any}
                size={32}
                color={selectedActivity === activity.type ? "white" : "#007AFF"}
              />
              <Text
                style={[
                  styles.activityLabel,
                  selectedActivity === activity.type &&
                    styles.activityLabelSelected,
                ]}
              >
                {activity.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <Ionicons name="play" size={24} color="white" />
          <Text style={styles.startButtonText}>Start Tracking</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manualButton}
          onPress={() => router.push("/add-activity")}
        >
          <Ionicons name="create-outline" size={20} color={theme.colors.navy} />
          <Text style={styles.manualButtonText}>Add Past Activity</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (showSaveDialog) {
    return (
      <View style={styles.container}>
        <View style={styles.saveDialog}>
          <Text style={styles.saveTitle}>Save Activity</Text>

          <Text style={styles.label}>Activity Name</Text>
          <TextInput
            style={styles.input}
            value={activityName}
            onChangeText={setActivityName}
            placeholder={`${selectedActivity} activity`}
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={activityNotes}
            onChangeText={setActivityNotes}
            placeholder="How was it? Any notes..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
          />

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Activity Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Distance:</Text>
              <Text style={styles.summaryValue}>
                {formatDistance(currentDistance)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration:</Text>
              <Text style={styles.summaryValue}>
                {formatDuration(currentDuration)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Avg Speed:</Text>
              <Text style={styles.summaryValue}>
                {formatSpeed(
                  currentDistance > 0
                    ? currentDistance / 1000 / (currentDuration / 3600)
                    : 0
                )}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveActivity}
          >
            <Text style={styles.saveButtonText}>Save Activity</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.discardButton} onPress={handleCancel}>
            <Text style={styles.discardButtonText}>Discard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.trackingContainer}>
        {/* Stats Cards at Top */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>
              {formatDistance(currentDistance)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>
              {formatDuration(currentDuration)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Speed</Text>
            <Text style={styles.statValue}>{formatSpeed(currentSpeed)}</Text>
          </View>
        </View>

        {/* Map View */}
        <View style={styles.mapContainer}>
          <WebView
            style={styles.map}
            source={{ html: generateRouteMapHTML() }}
            scrollEnabled={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
          {isPaused && (
            <View style={styles.pausedOverlay}>
              <Text style={styles.pausedText}>PAUSED</Text>
            </View>
          )}
        </View>

        {/* Control Buttons */}
        <View style={styles.controlsContainer}>
          {!isPaused ? (
            <TouchableOpacity style={styles.pauseButton} onPress={handlePause}>
              <Ionicons name="pause" size={32} color="white" />
              <Text style={styles.controlButtonText}>Pause</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.resumeButton}
              onPress={handleResume}
            >
              <Ionicons name="play" size={32} color="white" />
              <Text style={styles.controlButtonText}>Resume</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
            <Ionicons name="stop" size={32} color="white" />
            <Text style={styles.controlButtonText}>Finish</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
  },
  activityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 10,
    justifyContent: "space-between",
  },
  activityCard: {
    width: "30%",
    aspectRatio: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    margin: 5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.borderGray,
  },
  activityCardSelected: {
    backgroundColor: theme.colors.forest, // Changed from '#007AFF'
    borderColor: theme.colors.forest, // Changed from '#007AFF'
  },
  activityLabel: {
    marginTop: 8,
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  activityLabelSelected: {
    color: "white",
  },
  startButton: {
    backgroundColor: theme.colors.forest, // Changed from '#34C759'
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: 20,
    padding: 18,
    borderRadius: 12,
  },
  startButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  trackingContainer: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: theme.colors.white,
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  statCard: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  pausedOverlay: {
    position: "absolute",
    top: 20,
    alignSelf: "center",
    backgroundColor: theme.colors.burntOrange,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pausedText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: theme.colors.white,
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  pauseButton: {
    backgroundColor: theme.colors.burntOrange,
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  resumeButton: {
    backgroundColor: theme.colors.forest,
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  stopButton: {
    backgroundColor: theme.colors.navy,
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  controlButtonText: {
    color: "white",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
  saveDialog: {
    padding: 20,
  },
  saveTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  summaryCard: {
    backgroundColor: "#f8f8f8",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    color: "#333",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  saveButton: {
    backgroundColor: theme.colors.forest,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  saveButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  discardButton: {
    padding: 16,
    alignItems: "center",
  },
  discardButtonText: {
    color: theme.colors.burntOrange,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  viewMapButton: {
    backgroundColor: "#007AFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  viewMapButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  mapToggleButton: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "#007AFF",
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  mapToggleText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 5,
  },
  manualButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: 20,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.forest,
    backgroundColor: "transparent",
  },
  manualButtonText: {
    color: theme.colors.navy,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
