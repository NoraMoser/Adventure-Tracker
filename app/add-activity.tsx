// add-activity.tsx - Complete version with auto-add to trip
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
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
import { useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext";
import { Camera, CameraView } from "expo-camera";
import { useAutoAddToTrip } from "../hooks/useAutoAddToTrip";

const { width, height } = Dimensions.get("window");

const activityTypes: { type: ActivityType; label: string; icon: string }[] = [
  { type: "bike", label: "Bike", icon: "bicycle" },
  { type: "run", label: "Run", icon: "walk" },
  { type: "walk", label: "Walk", icon: "footsteps" },
  { type: "hike", label: "Hike", icon: "trail-sign" },
  { type: "paddleboard", label: "Paddle", icon: "boat" },
  { type: "climb", label: "Climb", icon: "trending-up" },
  { type: "other", label: "Other", icon: "fitness" },
];

export default function AddActivityScreen() {
  const { addManualActivity } = useActivity();
  const { settings, formatDistance, getDistanceUnit } = useSettings();
  const { location: currentLocation } = useLocation();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const { checkAndAddToTrip } = useAutoAddToTrip();

  // Use default activity type from settings
  const [activityType, setActivityType] = useState<ActivityType>(
    settings.defaultActivityType || "bike"
  );
  const [name, setName] = useState("");
  const [activityDate, setActivityDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration] = useState({ hours: "0", minutes: "0" });
  const [distance, setDistance] = useState("");
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">(
    settings.units === "imperial" ? "mi" : "km"
  );
  const [notes, setNotes] = useState("");
  const [showMapModal, setShowMapModal] = useState(false);
  const [drawnRoute, setDrawnRoute] = useState<any[]>([]);
  const [routeDistance, setRouteDistance] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | null
  >(null);
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(status === "granted");
    })();
  }, []);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert("Error", "Please enter an activity name");
      return;
    }

    const durationInSeconds =
      (parseInt(duration.hours) || 0) * 3600 +
      (parseInt(duration.minutes) || 0) * 60;

    if (durationInSeconds === 0) {
      Alert.alert("Error", "Please enter the activity duration");
      return;
    }

    // Use route distance if available, otherwise use manual distance
    let distanceInMeters = routeDistance; // Route distance is already in meters
    if (!distanceInMeters && distance) {
      const distanceValue = parseFloat(distance);
      distanceInMeters =
        distanceUnit === "km" ? distanceValue * 1000 : distanceValue * 1609.34;
    }

    // Calculate average speed
    const avgSpeed =
      distanceInMeters > 0
        ? distanceInMeters / 1000 / (durationInSeconds / 3600)
        : 0;

    // Combine date and time
    const combinedDateTime = new Date(activityDate);
    combinedDateTime.setHours(startTime.getHours());
    combinedDateTime.setMinutes(startTime.getMinutes());

    // Create activity object
    const activity = {
      type: activityType,
      name: name.trim(),
      activityDate: activityDate,
      startTime: combinedDateTime,
      endTime: new Date(combinedDateTime.getTime() + durationInSeconds * 1000),
      duration: durationInSeconds,
      distance: distanceInMeters,
      route: drawnRoute,
      averageSpeed: avgSpeed,
      maxSpeed: avgSpeed,
      notes: notes.trim(),
      photos: photos,
      isManualEntry: true,
    };

    try {
      // Save the activity and get the returned value
      const savedActivity = await addManualActivity(activity);

      // Determine location for trip checking
      let activityLocation = null;

      if (drawnRoute && drawnRoute.length > 0) {
        activityLocation = {
          latitude: drawnRoute[0].latitude,
          longitude: drawnRoute[0].longitude,
        };
      } else if (currentLocation) {
        activityLocation = currentLocation;
      }

      // Only check for trips if we have a location
      if (activityLocation) {
        const trip = (await checkAndAddToTrip(
          savedActivity,
          "activity",
          savedActivity.name,
          activityLocation,
          true
        )) as { name?: string; id?: string } | null;

        if (trip?.name && trip?.id) {
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

      // Default success message if no trip match or no location
      Alert.alert("Success", "Activity added successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error saving activity:", error);
      Alert.alert("Error", "Failed to save activity");
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleTakePhoto = async () => {
    setShowCamera(true);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        console.log("Taking picture...");

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: true,
        });

        console.log("Photo result:", photo);

        if (photo && photo.uri) {
          setPhotos((prevPhotos) => [...prevPhotos, photo.uri]);
        }

        setTimeout(() => {
          setShowCamera(false);
        }, 100);
      } catch (error) {
        console.error("Camera error:", error);
        Alert.alert("Error", "Failed to take picture");
        setShowCamera(false);
      }
    } else {
      console.error("Camera ref not available");
      setShowCamera(false);
    }
  };

  const handlePickImage = async () => {
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

  const handleMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "routeUpdated") {
        setDrawnRoute(data.route);
        setRouteDistance(data.distance);

        if (data.distance > 0) {
          const displayDistance =
            distanceUnit === "km"
              ? (data.distance / 1000).toFixed(2)
              : (data.distance / 1609.34).toFixed(2);
          setDistance(displayDistance);
        }
      }
    } catch (error) {
      console.error("Error parsing map message:", error);
    }
  };

  const generateMapHTML = () => {
    const centerLat = currentLocation?.latitude || 47.6062;
    const centerLng = currentLocation?.longitude || -122.3321;

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
          .info-panel {
            position: absolute;
            top: 10px;
            right: 10px;
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 1000;
            font-size: 14px;
          }
          .info-title {
            font-weight: bold;
            margin-bottom: 5px;
            color: #1e3a5f;
          }
          .info-distance {
            color: #2d5a3d;
            font-size: 16px;
            font-weight: bold;
          }
          .instructions {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255,255,255,0.95);
            padding: 10px 20px;
            border-radius: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
            font-size: 14px;
            color: #1e3a5f;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div class="info-panel">
          <div class="info-title">Route Distance</div>
          <div class="info-distance" id="distance">0.00 ${distanceUnit}</div>
        </div>
        <div class="instructions" id="instructions">
          Click points on the map to draw your route
        </div>
        <script>
          var map = L.map('map', {
            tap: true,
            zoomControl: true,
            doubleClickZoom: false
          }).setView([${centerLat}, ${centerLng}], 13);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          var routePoints = [];
          var routeLine = null;
          var markers = [];
          var totalDistance = 0;

          function calculateDistance(lat1, lon1, lat2, lon2) {
            var R = 6371000;
            var φ1 = lat1 * Math.PI / 180;
            var φ2 = lat2 * Math.PI / 180;
            var Δφ = (lat2 - lat1) * Math.PI / 180;
            var Δλ = (lon2 - lon1) * Math.PI / 180;
            var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
          }

          function addRoutePoint(lat, lng) {
            routePoints.push([lat, lng]);

            var color = routePoints.length === 1 ? '#2d5a3d' : '#cc5500';
            var markerIcon = L.divIcon({
              className: 'custom-div-icon',
              html: '<div style="background-color: ' + color + '; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            });

            var marker = L.marker([lat, lng], { 
              icon: markerIcon,
              interactive: false
            }).addTo(map);
            markers.push(marker);

            if (routePoints.length >= 2) {
              if (routeLine) {
                map.removeLayer(routeLine);
                routeLine = null;
              }

              routeLine = L.polyline(routePoints, {
                color: '#2d5a3d',
                weight: 4,
                opacity: 0.8
              }).addTo(map);
            }

            updateDistance();

            if (routePoints.length === 1) {
              document.getElementById('instructions').innerText = 'Continue clicking to draw your route';
            } else {
              document.getElementById('instructions').innerText = 'Keep adding points or tap Done to finish';
            }
          }

          function updateDistance() {
            totalDistance = 0;
            
            if (routePoints.length >= 2) {
              for (var i = 1; i < routePoints.length; i++) {
                totalDistance += calculateDistance(
                  routePoints[i-1][0], routePoints[i-1][1],
                  routePoints[i][0], routePoints[i][1]
                );
              }
            }

            var displayDistance = totalDistance;
            var unit = '${distanceUnit}';
            if (unit === 'km') {
              displayDistance = (totalDistance / 1000).toFixed(2);
            } else {
              displayDistance = (totalDistance / 1609.34).toFixed(2);
            }
            document.getElementById('distance').innerText = displayDistance + ' ' + unit;

            if (routePoints.length > 0) {
              var routeData = routePoints.map(function(point) {
                return {
                  latitude: point[0],
                  longitude: point[1],
                  timestamp: Date.now()
                };
              });

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'routeUpdated',
                route: routeData,
                distance: totalDistance
              }));
            }
          }

          map.on('click', function(e) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
            addRoutePoint(e.latlng.lat, e.latlng.lng);
          });

          var clearControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function(map) {
              var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
              var button = L.DomUtil.create('a', '', container);
              button.innerHTML = '🗑️ Clear';
              button.href = '#';
              button.style.width = '80px';
              button.style.textAlign = 'center';
              button.style.fontSize = '14px';
              button.style.padding = '5px';
              
              L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                L.DomEvent.stopPropagation(e);
                
                routePoints = [];
                markers.forEach(function(marker) {
                  map.removeLayer(marker);
                });
                markers = [];
                if (routeLine) {
                  map.removeLayer(routeLine);
                  routeLine = null;
                }
                totalDistance = 0;
                document.getElementById('distance').innerText = '0.00 ${distanceUnit}';
                document.getElementById('instructions').innerText = 'Click points on the map to draw your route';
                
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'routeUpdated',
                  route: [],
                  distance: 0
                }));
                
                return false;
              });
              
              return container;
            }
          });
          
          map.addControl(new clearControl());

          var undoControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function(map) {
              var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
              var button = L.DomUtil.create('a', '', container);
              button.innerHTML = '↩️ Undo';
              button.href = '#';
              button.style.width = '80px';
              button.style.textAlign = 'center';
              button.style.fontSize = '14px';
              button.style.padding = '5px';
              
              L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                L.DomEvent.stopPropagation(e);
                
                if (routePoints.length > 0) {
                  routePoints.pop();
                  
                  if (markers.length > 0) {
                    var lastMarker = markers.pop();
                    map.removeLayer(lastMarker);
                  }
                  
                  if (routeLine) {
                    map.removeLayer(routeLine);
                    routeLine = null;
                  }
                  
                  if (routePoints.length >= 2) {
                    routeLine = L.polyline(routePoints, {
                      color: '#2d5a3d',
                      weight: 4,
                      opacity: 0.8
                    }).addTo(map);
                  }
                  
                  updateDistance();
                  
                  if (routePoints.length === 0) {
                    document.getElementById('instructions').innerText = 'Click points on the map to draw your route';
                  }
                }
                
                return false;
              });
              
              return container;
            }
          });
          
          map.addControl(new undoControl());

          var existingRoute = ${JSON.stringify(drawnRoute)};
          if (existingRoute && existingRoute.length > 0) {
            existingRoute.forEach(function(point, index) {
              routePoints.push([point.latitude, point.longitude]);
              
              var markerIcon = L.divIcon({
                className: 'custom-div-icon',
                html: '<div style="background-color: ' + (index === 0 ? '#2d5a3d' : '#cc5500') + '; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [12, 12],
                iconAnchor: [6, 6]
              });
              
              var marker = L.marker([point.latitude, point.longitude], { icon: markerIcon }).addTo(map);
              markers.push(marker);
            });
            
            if (routePoints.length >= 2) {
              routeLine = L.polyline(routePoints, {
                color: '#2d5a3d',
                weight: 4,
                opacity: 0.8
              }).addTo(map);
            }
            
            updateDistance();
            
            if (routePoints.length > 0) {
              var group = new L.featureGroup(markers);
              map.fitBounds(group.getBounds().pad(0.1));
            }
          }
        </script>
      </body>
      </html>
    `;
  };

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          zoom={zoom}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.zoomControls}>
            <TouchableOpacity
              style={styles.zoomButton}
              onPress={() => setZoom(Math.max(0, zoom - 0.1))}
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
              onPress={() => setZoom(Math.min(1, zoom + 0.1))}
              disabled={zoom >= 1}
            >
              <Ionicons
                name="add-circle"
                size={40}
                color={zoom >= 1 ? "rgba(255,255,255,0.3)" : "white"}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setZoom(0);
              setShowCamera(false);
            }}
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Past Activity</Text>
        <Text style={styles.subtitle}>
          Record an activity you forgot to track
        </Text>
        {settings.defaultActivityType && (
          <Text style={styles.defaultNote}>
            Default:{" "}
            {settings.defaultActivityType.charAt(0).toUpperCase() +
              settings.defaultActivityType.slice(1)}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.activityTypes}>
            {activityTypes.map((activity) => (
              <TouchableOpacity
                key={activity.type}
                style={[
                  styles.activityCard,
                  activityType === activity.type && styles.activityCardSelected,
                ]}
                onPress={() => setActivityType(activity.type)}
              >
                <Ionicons
                  name={activity.icon as any}
                  size={24}
                  color={
                    activityType === activity.type
                      ? theme.colors.white
                      : theme.colors.navy
                  }
                />
                <Text
                  style={[
                    styles.activityLabel,
                    activityType === activity.type &&
                      styles.activityLabelSelected,
                  ]}
                >
                  {activity.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Morning bike ride, Trail run, etc."
          placeholderTextColor={theme.colors.lightGray}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Date & Time</Text>
        <View style={styles.dateTimeContainer}>
          <TouchableOpacity
            style={[styles.dateTimeButton, styles.dateButton]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={theme.colors.navy}
            />
            <View style={styles.dateTimeContent}>
              <Text style={styles.dateTimeLabel}>Date</Text>
              <Text style={styles.dateTimeValue}>
                {formatDate(activityDate)}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Ionicons name="time-outline" size={20} color={theme.colors.navy} />
            <View style={styles.dateTimeContent}>
              <Text style={styles.dateTimeLabel}>Start Time</Text>
              <Text style={styles.dateTimeValue}>{formatTime(startTime)}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={activityDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setActivityDate(selectedDate);
          }}
          maximumDate={new Date()}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) setStartTime(selectedTime);
          }}
        />
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Duration *</Text>
        <View style={styles.durationContainer}>
          <View style={styles.durationInput}>
            <TextInput
              style={styles.numberInput}
              value={duration.hours}
              onChangeText={(text) => setDuration({ ...duration, hours: text })}
              keyboardType="numeric"
              placeholder="0"
              maxLength={2}
            />
            <Text style={styles.durationLabel}>hours</Text>
          </View>
          <View style={styles.durationInput}>
            <TextInput
              style={styles.numberInput}
              value={duration.minutes}
              onChangeText={(text) =>
                setDuration({ ...duration, minutes: text })
              }
              keyboardType="numeric"
              placeholder="0"
              maxLength={2}
            />
            <Text style={styles.durationLabel}>minutes</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route (Optional)</Text>
        <TouchableOpacity
          style={styles.drawRouteButton}
          onPress={() => setShowMapModal(true)}
        >
          <Ionicons name="map" size={20} color={theme.colors.forest} />
          <Text style={styles.drawRouteText}>
            {drawnRoute.length > 0
              ? `Route drawn (${drawnRoute.length} points)`
              : "Draw route on map"}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.colors.forest}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Distance {routeDistance > 0 ? "(from route)" : "(Optional)"}
        </Text>
        <View style={styles.distanceContainer}>
          <TextInput
            style={[styles.input, styles.distanceInput]}
            value={distance}
            onChangeText={setDistance}
            keyboardType="decimal-pad"
            placeholder="0.0"
            editable={!routeDistance}
          />
          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[
                styles.unitButton,
                distanceUnit === "km" && styles.unitButtonActive,
              ]}
              onPress={() => setDistanceUnit("km")}
            >
              <Text
                style={[
                  styles.unitText,
                  distanceUnit === "km" && styles.unitTextActive,
                ]}
              >
                km
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.unitButton,
                distanceUnit === "mi" && styles.unitButtonActive,
              ]}
              onPress={() => setDistanceUnit("mi")}
            >
              <Text
                style={[
                  styles.unitText,
                  distanceUnit === "mi" && styles.unitTextActive,
                ]}
              >
                mi
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes (Optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="How was it? Any details to remember..."
          placeholderTextColor={theme.colors.lightGray}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Photos (Optional)</Text>
        <View style={styles.photoActions}>
          <TouchableOpacity
            style={styles.photoButton}
            onPress={handleTakePhoto}
          >
            <Ionicons name="camera" size={20} color={theme.colors.forest} />
            <Text style={styles.photoButtonText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.photoButton}
            onPress={handlePickImage}
          >
            <Ionicons name="images" size={20} color={theme.colors.forest} />
            <Text style={styles.photoButtonText}>Gallery</Text>
          </TouchableOpacity>
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
                    size={24}
                    color={theme.colors.burntOrange}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Ionicons name="save-outline" size={20} color={theme.colors.white} />
        <Text style={styles.saveButtonText}>Save Activity</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      <Modal
        visible={showMapModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.mapModalContainer}>
          <View style={styles.mapModalHeader}>
            <Text style={styles.mapModalTitle}>Draw Your Route</Text>
            <TouchableOpacity
              style={styles.mapModalClose}
              onPress={() => setShowMapModal(false)}
            >
              <Text style={styles.mapModalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <WebView
            ref={webViewRef}
            style={styles.mapWebView}
            source={{ html: generateMapHTML() }}
            onMessage={handleMapMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
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
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 5,
  },
  defaultNote: {
    fontSize: 12,
    color: theme.colors.forest,
    marginTop: 5,
    fontStyle: "italic",
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 12,
  },
  activityTypes: {
    flexDirection: "row",
  },
  activityCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    alignItems: "center",
    minWidth: 80,
    borderWidth: 2,
    borderColor: theme.colors.borderGray,
  },
  activityCardSelected: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  activityLabel: {
    marginTop: 6,
    fontSize: 12,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  activityLabelSelected: {
    color: theme.colors.white,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.navy,
  },
  dateTimeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    marginHorizontal: 5,
  },
  dateButton: {
    flex: 1.2,
  },
  dateTimeContent: {
    marginLeft: 10,
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 11,
    color: theme.colors.gray,
    marginBottom: 2,
  },
  dateTimeValue: {
    fontSize: 14,
    color: theme.colors.navy,
    fontWeight: "500",
  },
  durationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  durationInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    paddingHorizontal: 12,
    marginHorizontal: 5,
  },
  numberInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.navy,
    padding: 12,
  },
  durationLabel: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  drawRouteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.forest,
    borderRadius: 8,
    padding: 14,
  },
  drawRouteText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.forest,
    marginLeft: 10,
    fontWeight: "500",
  },
  distanceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  distanceInput: {
    flex: 1,
    marginRight: 10,
  },
  unitToggle: {
    flexDirection: "row",
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  unitButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  unitButtonActive: {
    backgroundColor: theme.colors.forest,
    borderRadius: 6,
  },
  unitText: {
    fontSize: 14,
    color: theme.colors.gray,
    fontWeight: "500",
  },
  unitTextActive: {
    color: theme.colors.white,
  },
  notesInput: {
    height: 100,
  },
  saveButton: {
    backgroundColor: theme.colors.forest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
  },
  cancelButton: {
    padding: 16,
    alignItems: "center",
    marginBottom: 30,
  },
  cancelButtonText: {
    color: theme.colors.burntOrange,
    fontSize: 16,
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  mapModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 16,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  mapModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  mapModalClose: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.forest,
    borderRadius: 16,
  },
  mapModalCloseText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  mapWebView: {
    flex: 1,
  },
  photoActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 15,
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.forest,
  },
  photoButtonText: {
    color: theme.colors.forest,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  photoList: {
    marginBottom: 15,
    maxHeight: 110,
  },
  photoContainer: {
    marginRight: 10,
    position: "relative",
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "white",
    borderRadius: 12,
  },
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
    top: 40,
    right: 20,
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
});
