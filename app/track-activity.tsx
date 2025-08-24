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
import { useSettings } from "../contexts/SettingsContext";

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
  const { formatDistance, formatSpeed, settings } = useSettings();

  const [selectedActivity, setSelectedActivity] = useState<ActivityType>(
    settings.defaultActivityType || "bike"
  );
  const [activityName, setActivityName] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  // Store final values when stopping
  const [finalDistance, setFinalDistance] = useState(0);
  const [finalDuration, setFinalDuration] = useState(0);
  const [finalSpeed, setFinalSpeed] = useState(0);

  useEffect(() => {
    if (!isTracking && settings.defaultActivityType) {
      setSelectedActivity(settings.defaultActivityType);
    }
  }, [settings.defaultActivityType, isTracking]);

  useEffect(() => {
    if (error) {
      Alert.alert("Error", error);
    }
  }, [error]);

  // Auto-save on app background (protection against crashes)
  useEffect(() => {
    const saveEmergencyActivity = async () => {
      if (isTracking && currentDistance > 100) { // Only if tracked > 100m
        console.log("Emergency save triggered");
        const emergencyName = `Auto-saved ${selectedActivity} activity`;
        await stopTracking(emergencyName, "Activity auto-saved due to app interruption");
      }
    };

    // Set up emergency save handler
    const handleEmergency = () => {
      if (isTracking && !showSaveDialog) {
        saveEmergencyActivity();
      }
    };

    // This will trigger on app termination
    return () => {
      handleEmergency();
    };
  }, [isTracking, currentDistance, selectedActivity, showSaveDialog]);

  const generateRouteMapHTML = () => {
    if (currentRoute.length === 0) {
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
            .accuracy-circle {
              fill: #4285F4;
              fill-opacity: 0.2;
              stroke: #4285F4;
              stroke-width: 2;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            var map = L.map('map').setView([${center.latitude}, ${center.longitude}], 15);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap',
              maxZoom: 19
            }).addTo(map);

            // Add current position marker with pulse animation
            var pulseIcon = L.divIcon({
              className: 'pulse-icon',
              html: '<div style="width: 16px; height: 16px; border-radius: 50%; background: #4285F4; box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.7); animation: pulse 2s infinite;"></div>',
              iconSize: [16, 16]
            });
            
            L.marker([${center.latitude}, ${center.longitude}], {icon: pulseIcon}).addTo(map);
            
            // Add CSS animation
            var style = document.createElement('style');
            style.innerHTML = '@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.7); } 70% { box-shadow: 0 0 0 20px rgba(66, 133, 244, 0); } 100% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0); } }';
            document.head.appendChild(style);
          </script>
        </body>
        </html>
      `;
    }

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

          var routeCoords = [${routeCoords}];
          if (routeCoords.length > 0) {
            // Draw the route
            var polyline = L.polyline(routeCoords, {
              color: '#2d5a3d',
              weight: 4,
              opacity: 0.8,
              smoothFactor: 1
            }).addTo(map);

            // Add start marker
            L.circleMarker(routeCoords[0], {
              radius: 8,
              fillColor: '#2d5a3d',
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 1
            }).addTo(map).bindPopup('Start');

            // Add current position marker
            var pulseIcon = L.divIcon({
              className: 'pulse-icon',
              html: '<div style="width: 12px; height: 12px; border-radius: 50%; background: #cc5500; box-shadow: 0 0 0 0 rgba(204, 85, 0, 0.7); animation: pulse 2s infinite;"></div>',
              iconSize: [12, 12]
            });
            
            L.marker(routeCoords[routeCoords.length - 1], {icon: pulseIcon}).addTo(map);

            // Fit map to route
            map.fitBounds(polyline.getBounds().pad(0.1));
            
            // Don't zoom in too far
            if (map.getZoom() > 17) {
              map.setZoom(17);
            }
            
            // Add CSS animation
            var style = document.createElement('style');
            style.innerHTML = '@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(204, 85, 0, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(204, 85, 0, 0); } 100% { box-shadow: 0 0 0 0 rgba(204, 85, 0, 0); } }';
            document.head.appendChild(style);
          }
        </script>
      </body>
      </html>
    `;
  };

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
    // Store final values
    setFinalDistance(currentDistance);
    setFinalDuration(currentDuration);
    setFinalSpeed(currentDistance > 0 ? (currentDistance / 1000) / (currentDuration / 3600) : 0);
    
    // Pause tracking while showing save dialog
    if (!isPaused) {
      pauseTracking();
    }
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

  const handleDiscardActivity = () => {
    Alert.alert(
      "Discard Activity?",
      "Are you sure you want to discard this activity? This cannot be undone.",
      [
        {
          text: "Keep Recording",
          style: "cancel",
          onPress: () => {
            resumeTracking();
            setShowSaveDialog(false);
          },
        },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            await stopTracking("", "DISCARD_ACTIVITY");
            setShowSaveDialog(false);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.forest} />
        <Text style={styles.loadingText}>Starting activity tracking...</Text>
        <Text style={styles.loadingSubtext}>
          Please ensure location services are enabled
        </Text>
      </View>
    );
  }

  if (!isTracking && !showSaveDialog) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Activity Type</Text>
          {settings.defaultActivityType && (
            <Text style={styles.subtitle}>
              Default: {settings.defaultActivityType.charAt(0).toUpperCase() + 
                settings.defaultActivityType.slice(1)}
            </Text>
          )}
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
                color={
                  selectedActivity === activity.type
                    ? theme.colors.white
                    : theme.colors.forest
                }
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
      <ScrollView style={styles.container}>
        <View style={styles.saveDialog}>
          <Text style={styles.saveTitle}>Save Activity</Text>
          
          <View style={styles.activityTypeIndicator}>
            <Ionicons 
              name={activityTypes.find(a => a.type === selectedActivity)?.icon as any} 
              size={24} 
              color={theme.colors.forest} 
            />
            <Text style={styles.activityTypeText}>
              {selectedActivity.charAt(0).toUpperCase() + selectedActivity.slice(1)} Activity
            </Text>
          </View>

          <View style={styles.pausedIndicator}>
            <Ionicons name="pause-circle" size={20} color={theme.colors.burntOrange} />
            <Text style={styles.pausedIndicatorText}>Recording Paused</Text>
          </View>

          <Text style={styles.label}>Activity Name</Text>
          <TextInput
            style={styles.input}
            value={activityName}
            onChangeText={setActivityName}
            placeholder={`${selectedActivity} activity`}
            placeholderTextColor={theme.colors.lightGray}
          />

          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={activityNotes}
            onChangeText={setActivityNotes}
            placeholder="How was it? Any notes..."
            placeholderTextColor={theme.colors.lightGray}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Activity Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Distance:</Text>
              <Text style={styles.summaryValue}>
                {formatDistance(finalDistance)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration:</Text>
              <Text style={styles.summaryValue}>
                {formatDuration(finalDuration)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Avg Speed:</Text>
              <Text style={styles.summaryValue}>
                {formatSpeed(finalSpeed)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveActivity}
          >
            <Ionicons name="save" size={20} color={theme.colors.white} />
            <Text style={styles.saveButtonText}>Save Activity</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.continueButton} 
            onPress={() => {
              resumeTracking();
              setShowSaveDialog(false);
            }}
          >
            <Ionicons name="arrow-back" size={20} color={theme.colors.forest} />
            <Text style={styles.continueButtonText}>Continue Recording</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.discardButton} 
            onPress={handleDiscardActivity}
          >
            <Ionicons name="trash-outline" size={20} color={theme.colors.burntOrange} />
            <Text style={styles.discardButtonText}>Discard Activity</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.trackingContainer}>
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
          {currentRoute.length === 0 && (
            <View style={styles.gpsStatus}>
              <ActivityIndicator size="small" color={theme.colors.forest} />
              <Text style={styles.gpsStatusText}>Acquiring GPS signal...</Text>
            </View>
          )}
        </View>

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
    backgroundColor: theme.colors.offWhite,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: theme.colors.navy,
    fontWeight: "600",
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.gray,
  },
  header: {
    padding: 20,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: "center",
    marginTop: 5,
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
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 15,
    margin: 5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.borderGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityCardSelected: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  activityLabel: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "600",
  },
  activityLabelSelected: {
    color: theme.colors.white,
  },
  startButton: {
    backgroundColor: theme.colors.forest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: 20,
    padding: 18,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  startButtonText: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pausedText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  gpsStatus: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gpsStatusText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.navy,
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
    color: theme.colors.white,
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
    color: theme.colors.navy,
    marginBottom: 20,
  },
  activityTypeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
    padding: 10,
    backgroundColor: theme.colors.white,
    borderRadius: 8,
  },
  activityTypeText: {
    fontSize: 16,
    color: theme.colors.forest,
    marginLeft: 8,
    fontWeight: "500",
  },
  pausedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.burntOrange + "20",
    padding: 8,
    borderRadius: 8,
    marginBottom: 20,
  },
  pausedIndicatorText: {
    color: theme.colors.burntOrange,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    color: theme.colors.navy,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  summaryCard: {
    backgroundColor: theme.colors.white,
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    color: theme.colors.navy,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  saveButton: {
    backgroundColor: theme.colors.forest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderWidth: 2,
    borderColor: theme.colors.forest,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: theme.colors.white,
  },
  continueButtonText: {
    color: theme.colors.forest,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  discardButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  discardButtonText: {
    color: theme.colors.burntOrange,
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
});