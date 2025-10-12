// app/track-activity.tsx - Updated with expo-camera
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { theme } from "../constants/theme";
import { useActivity } from "../contexts/ActivityContext";
import { useSettings } from "../contexts/SettingsContext";
import { Camera, CameraView } from "expo-camera";
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  State,
} from "react-native-gesture-handler";
import Animated, { useSharedValue, runOnJS } from "react-native-reanimated";
import { useAutoAddToTrip } from "../hooks/useAutoAddToTrip"; // Add this import

type ActivityType =
  | "bike"
  | "run"
  | "walk"
  | "hike"
  | "paddleboard"
  | "climb"
  | "other";

const ACTIVITY_TYPES = [
  { type: "bike" as ActivityType, label: "Bike", icon: "bicycle" },
  { type: "run" as ActivityType, label: "Run", icon: "walk" },
  { type: "walk" as ActivityType, label: "Walk", icon: "footsteps" },
  { type: "hike" as ActivityType, label: "Hike", icon: "trail-sign" },
  { type: "paddleboard" as ActivityType, label: "Paddle", icon: "boat" },
  { type: "climb" as ActivityType, label: "Climb", icon: "trending-up" },
  { type: "other" as ActivityType, label: "Other", icon: "fitness" },
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
    gpsStatus,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    loading,
    error,
  } = useActivity();

  const [selectedActivity, setSelectedActivity] = useState<ActivityType>(
    settings.defaultActivityType || "bike"
  );
  const [activityName, setActivityName] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPermissionScreen, setShowPermissionScreen] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Add date state
  const [activityDate, setActivityDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [finalDistance, setFinalDistance] = useState(0);
  const [finalDuration, setFinalDuration] = useState(0);
  const [finalSpeed, setFinalSpeed] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [zoom, setZoom] = useState(0);
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">("back");
  const { checkAndAddToTrip } = useAutoAddToTrip();

  useEffect(() => {
    if (loading || manualLoading) {
      loadingTimeoutRef.current = setTimeout(() => {
        setLoadingTimeout(true);
      }, 15000);
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
      const { status: existingStatus } =
        await Location.getForegroundPermissionsAsync();

      if (existingStatus !== "granted") {
        // Show the permission screen instead of directly requesting
        setShowPermissionScreen(true);
        setManualLoading(false);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      await startTracking(selectedActivity);
    } catch (err) {
      setManualLoading(false);
      console.error("Error starting activity:", err);
      Alert.alert("Error", "Failed to start tracking. Please try again.");
    } finally {
      setManualLoading(false); // Only need it once here
    }
  };

  const handlePinchGesture = (event: any) => {
    "worklet";
    scale.value = baseScale.value * event.nativeEvent.scale;
    const zoomValue = Math.min(Math.max(scale.value - 1, 0), 1);
    runOnJS(setZoom)(zoomValue);
  };

  const handlePinchStateChange = (event: any) => {
    "worklet";
    if (event.nativeEvent.oldState === State.ACTIVE) {
      if (scale.value < 1) {
        scale.value = 1;
        runOnJS(setZoom)(0);
      }
      baseScale.value = scale.value;
    } else if (event.nativeEvent.state === State.BEGAN) {
      baseScale.value = scale.value;
    }
  };

  const handleRequestPermission = async () => {
    setShowPermissionScreen(false);
    setManualLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === "granted") {
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
          "Permission Required",
          "Location permission is required to track activities. You can enable it in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (err) {
      setManualLoading(false);
      console.error("Permission error:", err);
    }
  };

  const handleRetry = () => {
    setLoadingTimeout(false);
    setManualLoading(false);
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
    setFinalSpeed(
      currentDistance > 0
        ? currentDistance / 1000 / (currentDuration / 3600)
        : 0
    );

    if (!isPaused) {
      pauseTracking();
    }
    setShowSaveDialog(true);
  };

  const handleSaveActivity = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const name = activityName.trim() || `${selectedActivity} activity`;

      // Get the saved activity from stopTracking
      const savedActivity = await stopTracking(name, activityNotes, photos);

      // Check for auto-add to trip if we have a saved activity and route
      if (savedActivity && currentRoute && currentRoute.length > 0) {

        const trip = (await checkAndAddToTrip(
          savedActivity,
          "activity",
          savedActivity.name,
          {
            latitude: currentRoute[0].latitude,
            longitude: currentRoute[0].longitude,
          },
          true
        )) as { name?: string; id?: string } | null;

        if (trip?.name && trip?.id) {
          setActivityName("");
          setActivityNotes("");
          setPhotos([]);
          setShowSaveDialog(false);
          setIsSaving(false);
          setActivityDate(new Date());

          Alert.alert(
            "Success!",
            `Activity saved and added to "${trip.name}"!`,
            [
              {
                text: "View Trip",
                onPress: () => router.push(`/trip-detail?tripId=${trip.id}`),
              },
              {
                text: "OK",
                onPress: () => router.back(),
              },
            ]
          );
          return;
        }
      }

      // Default success if no trip match
      setActivityName("");
      setActivityNotes("");
      setPhotos([]);
      setShowSaveDialog(false);
      setIsSaving(false);
      setActivityDate(new Date());

      Alert.alert("Success", "Activity saved successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Save error:", error);
      setIsSaving(false);

      Alert.alert(
        "Save Failed",
        "There was an error saving your activity. Would you like to try again?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Try Again", onPress: handleSaveActivity },
        ]
      );
    }
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

  const handleTakePhoto = async () => {
    if (!isTracking) {
      Alert.alert("Not Tracking", "Start tracking to add photos");
      return;
    }
    setShowCamera(true);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: true,
        });

        if (photo && photo.uri) {
          setPhotos((prevPhotos) => [...prevPhotos, photo.uri]);

          setCameraKey((prev) => prev + 1);

          setTimeout(() => {
            setShowCamera(false);
          }, 200);
        }
      } catch (error) {
        console.error("Camera error:", error);
        Alert.alert("Error", "Failed to take picture");
        setShowCamera(false);
      }
    }
  };

  const handlePickImage = async () => {
    if (!isTracking) {
      Alert.alert("Not Tracking", "Start tracking to add photos");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Media library permission is required to select photos"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhotos = result.assets.map((asset) => asset.uri);
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  if (showCamera) {
    return (
      <GestureHandlerRootView style={styles.cameraContainer}>
        <PinchGestureHandler
          onGestureEvent={handlePinchGesture}
          onHandlerStateChange={handlePinchStateChange}
        >
          <Animated.View style={styles.cameraContainer}>
            <CameraView
              key={cameraKey}
              ref={cameraRef}
              style={styles.camera}
              facing={cameraFacing} // Changed from hardcoded "back"
              zoom={zoom}
            />
            <View style={styles.cameraOverlay}>
              {/* Add flip button */}
              <TouchableOpacity
                style={styles.flipButton}
                onPress={() => {
                  setCameraFacing((current) =>
                    current === "back" ? "front" : "back"
                  );
                  // Reset zoom when flipping
                  setZoom(0);
                  scale.value = 1;
                  baseScale.value = 1;
                }}
              >
                <Ionicons name="camera-reverse" size={30} color="white" />
              </TouchableOpacity>

              {/* Keep the zoom controls as backup/visual indicator */}
              <View style={styles.zoomControls}>
                <TouchableOpacity
                  style={styles.zoomButton}
                  onPress={() => {
                    const newZoom = Math.max(0, zoom - 0.1);
                    setZoom(newZoom);
                    scale.value = 1 + newZoom;
                  }}
                  disabled={zoom <= 0}
                >
                  <Ionicons
                    name="remove-circle"
                    size={40}
                    color={zoom <= 0 ? "rgba(255,255,255,0.3)" : "white"}
                  />
                </TouchableOpacity>

                <View style={styles.zoomIndicator}>
                  <Text style={styles.zoomText}>
                    {zoom === 0 ? "1.0x" : `${(1 + zoom * 4).toFixed(1)}x`}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.zoomButton}
                  onPress={() => {
                    const newZoom = Math.min(1, zoom + 0.1);
                    setZoom(newZoom);
                    scale.value = 1 + newZoom;
                  }}
                  disabled={zoom >= 1}
                >
                  <Ionicons
                    name="add-circle"
                    size={40}
                    color={zoom >= 1 ? "rgba(255,255,255,0.3)" : "white"}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePicture}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setCameraKey((prev) => prev + 1);
                  setZoom(0);
                  scale.value = 1;
                  baseScale.value = 1;
                  setShowCamera(false);
                }}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </PinchGestureHandler>
      </GestureHandlerRootView>
    );
  }

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
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={theme.colors.forest}
              />
              <Text style={styles.permissionItemText}>
                Track your activities in real-time
              </Text>
            </View>
            <View style={styles.permissionItem}>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={theme.colors.forest}
              />
              <Text style={styles.permissionItemText}>
                Calculate distance and speed
              </Text>
            </View>
            <View style={styles.permissionItem}>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={theme.colors.forest}
              />
              <Text style={styles.permissionItemText}>
                Map your adventure routes
              </Text>
            </View>
          </View>

          <Text style={styles.permissionNote}>
            Your location data is only used during activities and is never
            shared without your permission.
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

  if (loading || manualLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.forest} />
        <Text style={styles.loadingText}>Starting activity tracking...</Text>
        <Text style={styles.loadingSubtext}>Acquiring GPS signal...</Text>

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

  if (showSaveDialog) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.saveDialog}>
          <Text style={styles.saveTitle}>Save Activity</Text>

          <View style={styles.activityTypeIndicator}>
            <Ionicons
              name={
                ACTIVITY_TYPES.find((a) => a.type === selectedActivity)
                  ?.icon as any
              }
              size={24}
              color={theme.colors.forest}
            />
            <Text style={styles.activityTypeText}>
              {selectedActivity.charAt(0).toUpperCase() +
                selectedActivity.slice(1)}{" "}
              Activity
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
              <Text style={styles.summaryValue}>{formatSpeed(finalSpeed)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>GPS Points:</Text>
              <Text style={styles.summaryValue}>{currentRoute.length}</Text>
            </View>
          </View>

          {saveError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color="#FF4757" />
              <Text style={styles.errorText}>{saveError}</Text>
            </View>
          )}

          <Text style={styles.label}>Activity Name</Text>
          <TextInput
            style={styles.input}
            value={activityName}
            onChangeText={setActivityName}
            placeholder={`${selectedActivity} activity`}
            placeholderTextColor={theme.colors.lightGray}
            editable={!isSaving}
          />

          <Text style={styles.label}>Activity Date</Text>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setDatePickerVisibility(true)}
            disabled={isSaving}
          >
            <Ionicons name="calendar" size={20} color={theme.colors.forest} />
            <Text style={styles.dateText}>
              {activityDate.toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </TouchableOpacity>

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
            editable={!isSaving}
          />

          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSaveActivity}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.saveButtonText}>Saving...</Text>
              </>
            ) : (
              <>
                <Ionicons name="save" size={20} color="white" />
                <Text style={styles.saveButtonText}>Save Activity</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.continueButton, isSaving && styles.buttonDisabled]}
            onPress={() => {
              resumeTracking();
              setShowSaveDialog(false);
            }}
            disabled={isSaving}
          >
            <Text style={styles.continueButtonText}>Continue Recording</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.discardButton, isSaving && styles.buttonDisabled]}
            onPress={handleDiscardActivity}
            disabled={isSaving}
          >
            <Text style={styles.discardButtonText}>Discard Activity</Text>
          </TouchableOpacity>
        </View>

        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={(date) => {
            setActivityDate(date);
            setDatePickerVisibility(false);
          }}
          onCancel={() => setDatePickerVisibility(false)}
          date={activityDate}
          maximumDate={new Date()}
        />
      </ScrollView>
    );
  }

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
              {formatDistance
                ? formatDistance(currentDistance || 0)
                : `0 ${settings.units === "imperial" ? "mi" : "km"}`}
            </Text>
          </View>

          <View style={styles.secondaryStats}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>
                {formatDuration(currentDuration || 0)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Speed</Text>
              <Text style={styles.statValue}>
                {formatSpeed
                  ? formatSpeed(currentSpeed || 0)
                  : `0 ${settings.units === "imperial" ? "mph" : "km/h"}`}
              </Text>
            </View>
          </View>

          <View style={styles.photoSection}>
            <View style={styles.photoHeader}>
              <Text style={styles.photoTitle}>
                Activity Photos ({photos.length})
              </Text>
              <View style={styles.photoButtons}>
                <TouchableOpacity
                  style={styles.photoActionButton}
                  onPress={handleTakePhoto}
                >
                  <Ionicons
                    name="camera"
                    size={22}
                    color={theme.colors.white}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoActionButton}
                  onPress={handlePickImage}
                >
                  <Ionicons
                    name="images"
                    size={22}
                    color={theme.colors.white}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {photos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photoList}
              >
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoContainer}>
                    <Image source={{ uri: photo }} style={styles.photo} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={theme.colors.white}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.gpsStatus}>
            <View
              style={[
                styles.gpsIndicator,
                gpsStatus === "active" && styles.gpsActive,
                gpsStatus === "searching" && styles.gpsSearching,
                gpsStatus === "stale" && styles.gpsStale,
                gpsStatus === "error" && styles.gpsError,
              ]}
            />
            <Text style={styles.gpsStatusText}>
              {gpsStatus === "active" &&
                `GPS Active${
                  currentLocation?.accuracy
                    ? ` (±${currentLocation.accuracy.toFixed(0)}m)`
                    : ""
                }`}
              {gpsStatus === "searching" && "Searching for GPS..."}
              {gpsStatus === "stale" && "GPS signal lost - move to open area"}
              {gpsStatus === "error" && "GPS error - check settings"}
            </Text>
          </View>

          {gpsStatus === "stale" && (
            <TouchableOpacity
              style={styles.gpsRetryButton}
              onPress={() => resumeTracking()}
            >
              <Ionicons name="refresh" size={20} color={theme.colors.forest} />
              <Text style={styles.gpsRetryText}>Retry GPS</Text>
            </TouchableOpacity>
          )}

          <View style={styles.controlsContainer}>
            {!isPaused ? (
              <TouchableOpacity
                style={styles.pauseButton}
                onPress={handlePause}
              >
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
                selectedActivity === activity.type &&
                  styles.activityLabelSelected,
              ]}
            >
              {activity.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.disclaimerContainer}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={theme.colors.gray}
        />
        <Text style={styles.disclaimerText}>
          This tracker provides general location and distance estimates for your
          outdoor activities. GPS accuracy can vary based on weather, terrain,
          and device conditions. For precision tracking needs, consider using
          dedicated GPS devices.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.startButton}
        onPress={handleStart}
        disabled={manualLoading}
      >
        <Ionicons name="play" size={24} color="white" />
        <Text style={styles.startButtonText}>Start Tracking</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.manualEntryButton}
        onPress={() => router.push("/add-activity")}
      >
        <Ionicons name="create-outline" size={24} color={theme.colors.forest} />
        <Text style={styles.manualEntryText}>Add Past Activity</Text>
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
  manualEntryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.forest,
  },
  manualEntryText: {
    color: theme.colors.forest,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
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
  permissionContainer: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
    justifyContent: "center",
    padding: 20,
  },
  permissionContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  permissionIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.forest + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
    marginBottom: 15,
  },
  permissionDescription: {
    fontSize: 16,
    color: theme.colors.gray,
    textAlign: "center",
    marginBottom: 20,
  },
  permissionList: {
    width: "100%",
    marginBottom: 20,
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
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
    textAlign: "center",
    marginBottom: 25,
    fontStyle: "italic",
  },
  permissionButton: {
    backgroundColor: theme.colors.forest,
    paddingVertical: 14,
    paddingHorizontal: 50,
    borderRadius: 8,
    marginBottom: 15,
  },
  permissionButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  permissionSkipButton: {
    padding: 10,
  },
  permissionSkipText: {
    color: theme.colors.gray,
    fontSize: 14,
  },
  header: {
    padding: 20,
    backgroundColor: "white",
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
    color: "white",
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
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  trackingContainer: {
    flex: 1,
    backgroundColor: "white",
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
    color: "white",
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
  gpsStale: {
    backgroundColor: theme.colors.burntOrange,
  },
  gpsError: {
    backgroundColor: "#FF4757",
  },
  gpsStatusText: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  gpsRetryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: theme.colors.forest + "20",
    borderRadius: 8,
    marginTop: 10,
  },
  gpsRetryText: {
    marginLeft: 8,
    color: theme.colors.forest,
    fontWeight: "600",
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
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
    color: theme.colors.navy,
    marginBottom: 20,
  },
  activityTypeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
    padding: 10,
    backgroundColor: "white",
    borderRadius: 8,
  },
  activityTypeText: {
    fontSize: 16,
    color: theme.colors.forest,
    marginLeft: 8,
    fontWeight: "500",
  },
  summaryCard: {
    backgroundColor: "white",
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
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF4757" + "20",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: {
    color: "#FF4757",
    marginLeft: 8,
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    color: theme.colors.navy,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  dateText: {
    fontSize: 16,
    color: theme.colors.navy,
    flex: 1,
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
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "white",
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
    backgroundColor: "white",
  },
  continueButtonText: {
    color: theme.colors.forest,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  discardButton: {
    padding: 16,
  },
  discardButtonText: {
    color: theme.colors.burntOrange,
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  timeoutContainer: {
    marginTop: 30,
    alignItems: "center",
  },
  timeoutText: {
    fontSize: 14,
    color: theme.colors.burntOrange,
    marginBottom: 20,
  },
  timeoutButtons: {
    flexDirection: "row",
    gap: 15,
  },
  retryButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: theme.colors.gray,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  disclaimerContainer: {
    flexDirection: "row",
    backgroundColor: theme.colors.lightGray + "20",
    margin: 20,
    marginTop: 10,
    marginBottom: 10,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.gray,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.gray,
    lineHeight: 18,
    marginLeft: 10,
  },
  photoSection: {
    backgroundColor: theme.colors.forest + "10",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  photoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  photoTitle: {
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "600",
  },
  photoButtons: {
    flexDirection: "row",
    gap: 10,
  },
  photoActionButton: {
    backgroundColor: theme.colors.forest,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  photoList: {
    marginTop: 10,
  },
  photoContainer: {
    marginRight: 10,
    position: "relative",
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 10,
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 25,
    zIndex: 1,
  },
  zoomControls: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  zoomButton: {
    padding: 10,
  },
  zoomIndicator: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 20,
    minWidth: 70,
    alignItems: "center",
  },
  zoomText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  flipButton: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 25,
    zIndex: 1,
  },
});
