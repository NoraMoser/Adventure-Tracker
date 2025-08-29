// app/track-activity.tsx - Complete version
import { Ionicons } from "@expo/vector-icons";
import * as Location from 'expo-location';
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { theme } from "../constants/theme";
import { useActivity } from "../contexts/ActivityContext";
import { useSettings } from "../contexts/SettingsContext";

type ActivityType = 'bike' | 'run' | 'walk' | 'hike' | 'paddleboard' | 'climb' | 'other';

const ACTIVITY_TYPES = [
  { type: 'bike' as ActivityType, label: 'Bike', icon: 'bicycle' },
  { type: 'run' as ActivityType, label: 'Run', icon: 'walk' },
  { type: 'walk' as ActivityType, label: 'Walk', icon: 'footsteps' },
  { type: 'hike' as ActivityType, label: 'Hike', icon: 'trail-sign' },
  { type: 'paddleboard' as ActivityType, label: 'Paddle', icon: 'boat' },
  { type: 'climb' as ActivityType, label: 'Climb', icon: 'trending-up' },
  { type: 'other' as ActivityType, label: 'Other', icon: 'fitness' },
];

export default function TrackActivityScreen() {
  const router = useRouter();
  const { formatDistance, formatSpeed, settings } = useSettings();
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

  const [selectedActivity, setSelectedActivity] = useState<ActivityType>(
    settings.defaultActivityType || 'bike'
  );
  const [activityName, setActivityName] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPermissionScreen, setShowPermissionScreen] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store final values when stopping
  const [finalDistance, setFinalDistance] = useState(0);
  const [finalDuration, setFinalDuration] = useState(0);
  const [finalSpeed, setFinalSpeed] = useState(0);

  // Set up loading timeout
  useEffect(() => {
    if (loading || manualLoading) {
      loadingTimeoutRef.current = setTimeout(() => {
        setLoadingTimeout(true);
      }, 8000); // 8 second timeout
    } else {
      setLoadingTimeout(false);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [loading, manualLoading]);

  useEffect(() => {
    if (error) {
      setManualLoading(false);
      Alert.alert("Error", error);
    }
  }, [error]);

  const handleStart = async () => {
    try {
      setManualLoading(true);
      setLoadingTimeout(false);
      
      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setManualLoading(false);
        Alert.alert(
          'Location Services Off',
          'ExplorAble needs location services to track your activities. Please enable them in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      // Check permission status
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setManualLoading(false);
        setShowPermissionScreen(true);
      } else {
        // Add a small delay to prevent race conditions
        setTimeout(async () => {
          try {
            await startTracking(selectedActivity);
          } finally {
            setManualLoading(false);
          }
        }, 100);
      }
    } catch (err) {
      setManualLoading(false);
      console.error('Error starting activity:', err);
      Alert.alert('Error', 'Failed to start tracking. Please try again.');
    }
  };

  const handleRequestPermission = async () => {
    setShowPermissionScreen(false);
    setManualLoading(true);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        // Add delay here too
        setTimeout(async () => {
          try {
            await startTracking(selectedActivity);
          } finally {
            setManualLoading(false);
          }
        }, 100);
      } else {
        setManualLoading(false);
        Alert.alert(
          'Permission Required',
          'Location permission is required to track activities. You can enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (err) {
      setManualLoading(false);
      console.error('Permission error:', err);
    }
  };

  const handleRetry = () => {
    setLoadingTimeout(false);
    setManualLoading(false);
    // Force a small delay before retrying
    setTimeout(() => {
      handleStart();
    }, 500);
  };

  const handleCancelLoading = () => {
    setLoadingTimeout(false);
    setManualLoading(false);
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
      "Are you sure you want to discard this activity?",
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

  // Permission Screen
  if (showPermissionScreen) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionContent}>
          <View style={styles.permissionIconContainer}>
            <Ionicons name="location" size={60} color={theme.colors.forest} />
          </View>
          
          <Text style={styles.permissionTitle}>Enable Location Access</Text>
          
          <Text style={styles.permissionDescription}>
            ExplorAble needs to access your location to:
          </Text>
          
          <View style={styles.permissionList}>
            <View style={styles.permissionItem}>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.forest} />
              <Text style={styles.permissionItemText}>Track your activities in real-time</Text>
            </View>
            <View style={styles.permissionItem}>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.forest} />
              <Text style={styles.permissionItemText}>Calculate distance and speed</Text>
            </View>
            <View style={styles.permissionItem}>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.forest} />
              <Text style={styles.permissionItemText}>Map your adventure routes</Text>
            </View>
          </View>
          
          <Text style={styles.permissionNote}>
            Your location data is only used during activities and is never shared without your permission.
          </Text>
          
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={handleRequestPermission}
          >
            <Text style={styles.permissionButtonText}>Continue</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.permissionSkipButton}
            onPress={() => {
              setShowPermissionScreen(false);
              router.back();
            }}
          >
            <Text style={styles.permissionSkipText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading Screen with timeout handling
  if (loading || manualLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.forest} />
        <Text style={styles.loadingText}>Starting activity tracking...</Text>
        <Text style={styles.loadingSubtext}>
          Acquiring GPS signal...
        </Text>
        
        {loadingTimeout && (
          <View style={styles.timeoutContainer}>
            <Text style={styles.timeoutText}>
              This is taking longer than expected
            </Text>
            <View style={styles.timeoutButtons}>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={handleRetry}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  handleCancelLoading();
                  router.back();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Save Dialog
  if (showSaveDialog) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.saveDialog}>
          <Text style={styles.saveTitle}>Save Activity</Text>
          
          <View style={styles.activityTypeIndicator}>
            <Ionicons 
              name={ACTIVITY_TYPES.find(a => a.type === selectedActivity)?.icon as any} 
              size={24} 
              color={theme.colors.forest} 
            />
            <Text style={styles.activityTypeText}>
              {selectedActivity.charAt(0).toUpperCase() + selectedActivity.slice(1)} Activity
            </Text>
          </View>

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

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveActivity}
          >
            <Ionicons name="save" size={20} color="white" />
            <Text style={styles.saveButtonText}>Save Activity</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.continueButton} 
            onPress={() => {
              resumeTracking();
              setShowSaveDialog(false);
            }}
          >
            <Text style={styles.continueButtonText}>Continue Recording</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.discardButton} 
            onPress={handleDiscardActivity}
          >
            <Text style={styles.discardButtonText}>Discard Activity</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Tracking View
  if (isTracking) {
    return (
      <View style={styles.container}>
        <View style={styles.trackingContainer}>
          {isPaused && (
            <View style={styles.pausedBanner}>
              <Ionicons name="pause-circle" size={20} color="white" />
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
              <Text style={styles.statLabel}>Speed</Text>
              <Text style={styles.statValue}>{formatSpeed(currentSpeed)}</Text>
            </View>
          </View>

          <View style={styles.gpsStatus}>
            <View style={[styles.gpsIndicator, currentLocation ? styles.gpsActive : styles.gpsSearching]} />
            <Text style={styles.gpsStatusText}>
              {currentLocation 
                ? `GPS Active (±${currentLocation.accuracy?.toFixed(0) || '?'}m)`
                : 'Acquiring GPS...'}
            </Text>
          </View>

          <View style={styles.controlsContainer}>
            {!isPaused ? (
              <TouchableOpacity style={styles.pauseButton} onPress={handlePause}>
                <Ionicons name="pause" size={32} color="white" />
                <Text style={styles.controlButtonText}>Pause</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.resumeButton} onPress={handleResume}>
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

  // Activity Selection View (default)
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Activity Type</Text>
      </View>

      <View style={styles.activityGrid}>
        {ACTIVITY_TYPES.map((activity) => (
          <TouchableOpacity
            key={activity.type}
            style={[
              styles.activityCard,
              selectedActivity === activity.type && styles.activityCardSelected,
            ]}
            onPress={() => setSelectedActivity(activity.type)}
          >
            <Ionicons
              name={activity.icon as any}
              size={32}
              color={
                selectedActivity === activity.type
                  ? "white"
                  : theme.colors.forest
              }
            />
            <Text
              style={[
                styles.activityLabel,
                selectedActivity === activity.type && styles.activityLabelSelected,
              ]}
            >
              {activity.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity 
        style={styles.startButton} 
        onPress={handleStart}
        disabled={manualLoading}
      >
        <Ionicons name="play" size={24} color="white" />
        <Text style={styles.startButtonText}>Start Tracking</Text>
      </TouchableOpacity>
    </ScrollView>
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
  
  // Permission Screen Styles
  permissionContainer: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
    justifyContent: 'center',
    padding: 20,
  },
  permissionContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  permissionIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.forest + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.navy,
    marginBottom: 15,
  },
  permissionDescription: {
    fontSize: 16,
    color: theme.colors.gray,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionList: {
    width: '100%',
    marginBottom: 20,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  permissionItemText: {
    fontSize: 14,
    color: theme.colors.navy,
    marginLeft: 10,
    flex: 1,
  },
  permissionNote: {
    fontSize: 12,
    color: theme.colors.lightGray,
    textAlign: 'center',
    marginBottom: 25,
    fontStyle: 'italic',
  },
  permissionButton: {
    backgroundColor: theme.colors.forest,
    paddingVertical: 14,
    paddingHorizontal: 50,
    borderRadius: 8,
    marginBottom: 15,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  permissionSkipButton: {
    padding: 10,
  },
  permissionSkipText: {
    color: theme.colors.gray,
    fontSize: 14,
  },
  permissionDeniedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.burntOrange + '15',
    padding: 15,
    margin: 20,
    marginTop: 0,
    borderRadius: 8,
  },
  permissionDeniedText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: theme.colors.navy,
    lineHeight: 20,
  },
  
  // Activity Selection Styles
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
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
    backgroundColor: 'white',
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
    color: 'white',
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
    color: 'white',
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  
  // Tracking View Styles
  trackingContainer: {
    flex: 1,
    backgroundColor: 'white',
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
    color: 'white',
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
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
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
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
  
  // Save Dialog Styles
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
    backgroundColor: 'white',
    borderRadius: 8,
  },
  activityTypeText: {
    fontSize: 16,
    color: theme.colors.forest,
    marginLeft: 8,
    fontWeight: "500",
  },
  summaryCard: {
    backgroundColor: 'white',
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
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
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
    color: 'white',
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  continueButton: {
    padding: 16,
    borderWidth: 2,
    borderColor: theme.colors.forest,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: 'white',
  },
  continueButtonText: {
    color: theme.colors.forest,
    fontSize: 16,
    fontWeight: "600",
    textAlign: 'center',
  },
  discardButton: {
    padding: 16,
  },
  discardButtonText: {
    color: theme.colors.burntOrange,
    fontSize: 16,
    fontWeight: "500",
    textAlign: 'center',
  },
    timeoutContainer: {
      marginTop: 30,
      alignItems: 'center',
    },
    timeoutText: {
      fontSize: 14,
      color: theme.colors.burntOrange,
      marginBottom: 20,
    },
    timeoutButtons: {
      flexDirection: 'row',
      gap: 15,
    },
    retryButton: {
      backgroundColor: theme.colors.forest,
      paddingHorizontal: 30,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButton: {
      backgroundColor: theme.colors.gray,
      paddingHorizontal: 30,
      paddingVertical: 12,
      borderRadius: 8,
    },
    cancelButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
});