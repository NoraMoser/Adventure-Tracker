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
    setFinalDistance(currentDistance);
    setFinalDuration(currentDuration);
    setFinalSpeed(currentDistance > 0 ? (currentDistance / 1000) / (currentDuration / 3600) : 0);
    
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

  // TRACKING VIEW - NO MAP, JUST STATS
  return (
    <View style={styles.container}>
      <View style={styles.trackingContainer}>
        {/* Large Stats Display */}
        <View style={styles.mainStatsContainer}>
          {isPaused && (
            <View style={styles.pausedBanner}>
              <Ionicons name="pause-circle" size={20} color={theme.colors.white} />
              <Text style={styles.pausedBannerText}>PAUSED</Text>
            </View>
          )}
          
          <View style={styles.primaryStat}>
            <Text style={styles.primaryStatLabel}>Distance</Text>
            <Text style={styles.primaryStatValue}>
              {formatDistance(currentDistance)}
            </Text>
          </View>

          <View style={styles.secondaryStats}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>
                {formatDuration(currentDuration)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Current Speed</Text>
              <Text style={styles.statValue}>{formatSpeed(currentSpeed)}</Text>
            </View>
          </View>

          <View style={styles.secondaryStats}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Avg Speed</Text>
              <Text style={styles.statValue}>
                {formatSpeed(
                  currentDistance > 0 && currentDuration > 0
                    ? (currentDistance / 1000) / (currentDuration / 3600)
                    : 0
                )}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>GPS Points</Text>
              <Text style={styles.statValue}>{currentRoute.length}</Text>
            </View>
          </View>

          {/* GPS Status */}
          <View style={styles.gpsStatus}>
            <View style={[styles.gpsIndicator, currentLocation ? styles.gpsActive : styles.gpsSearching]} />
            <Text style={styles.gpsStatusText}>
              {currentLocation 
                ? `GPS Active (±${currentLocation.accuracy?.toFixed(0) || '?'}m)`
                : 'Acquiring GPS...'}
            </Text>
          </View>

          {/* Activity Type Indicator */}
          <View style={styles.activityIndicator}>
            <Ionicons 
              name={activityTypes.find(a => a.type === selectedActivity)?.icon as any} 
              size={32} 
              color={theme.colors.forest} 
            />
            <Text style={styles.activityIndicatorText}>
              {selectedActivity.charAt(0).toUpperCase() + selectedActivity.slice(1)}
            </Text>
          </View>
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
  mainStatsContainer: {
    flex: 1,
    backgroundColor: theme.colors.white,
    padding: 20,
  },
  pausedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.burntOrange,
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  pausedBannerText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
    letterSpacing: 1,
  },
  primaryStat: {
    alignItems: "center",
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  primaryStatLabel: {
    fontSize: 18,
    color: theme.colors.gray,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  primaryStatValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: theme.colors.navy,
  },
  secondaryStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
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
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
  },
  gpsStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  gpsIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  gpsActive: {
    backgroundColor: theme.colors.forest,
  },
  gpsSearching: {
    backgroundColor: theme.colors.burntOrange,
  },
  gpsStatusText: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  activityIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
  },
  activityIndicatorText: {
    fontSize: 20,
    color: theme.colors.forest,
    marginLeft: 10,
    fontWeight: "600",
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
  },
  resumeButton: {
    backgroundColor: theme.colors.forest,
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  stopButton: {
    backgroundColor: theme.colors.navy,
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
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