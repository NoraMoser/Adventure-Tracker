// app/edit-activity.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { WebView } from "react-native-webview";
import { theme } from "../constants/theme";
import { useActivity } from "../contexts/ActivityContext";
import { useSettings } from "../contexts/SettingsContext";

export default function EditActivityScreen() {
  const { activityId } = useLocalSearchParams();
  const { activities, updateActivity } = useActivity();
  const { formatDistance, formatSpeed, settings } = useSettings();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);

  const activity = activities.find((a) => a.id === activityId);

  const [name, setName] = useState(activity?.name || "");
  const [notes, setNotes] = useState(activity?.notes || "");
  const [route, setRoute] = useState(activity?.route || []);
  const [distance, setDistance] = useState(activity?.distance || 0);
  const [duration, setDuration] = useState(activity?.duration || 0);
  const [photos, setPhotos] = useState<string[]>(activity?.photos || []);
  const [showMap, setShowMap] = useState(false);
  
  // Add date state
  const [activityDate, setActivityDate] = useState(
    activity?.activityDate 
      ? new Date(activity.activityDate) 
      : new Date(activity?.startTime || Date.now())
  );
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const [durationHours, setDurationHours] = useState(
    Math.floor((activity?.duration || 0) / 3600).toString()
  );
  const [durationMinutes, setDurationMinutes] = useState(
    Math.floor(((activity?.duration || 0) % 3600) / 60).toString()
  );

  useEffect(() => {
    if (!activity) {
      Alert.alert("Error", "Activity not found", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [activity]);

  const handleSave = async () => {
    if (!activity) return;

    const updatedDuration =
      parseInt(durationHours || "0") * 3600 +
      parseInt(durationMinutes || "0") * 60;

    // Calculate average speed safely
    let averageSpeed = 0;
    if (distance > 0 && updatedDuration > 0) {
      averageSpeed = distance / 1000 / (updatedDuration / 3600);
    }

    const updatedActivity = {
      ...activity,
      name: name.trim(),
      notes: notes.trim(),
      route,
      distance,
      duration: updatedDuration,
      photos,
      averageSpeed: averageSpeed,
      activityDate: activityDate, // Use the Date object directly
    };

    try {
      await updateActivity(activity.id, updatedActivity);
      Alert.alert("Success", "Activity updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to update activity");
    }
  };

  const handleMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "routeUpdated") {
        setRoute(data.route);
        setDistance(data.distance);
      }
    } catch (error) {
      console.error("Error parsing map message:", error);
    }
  };

  const handleAddPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Media library permission is required");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhotos = result.assets.map((asset) => asset.uri);
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const generateMapHTML = () => {
    const routeCoords = route
      .map((point: any) => `[${point.latitude}, ${point.longitude}]`)
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
          .info-panel {
            position: absolute;
            top: 10px;
            right: 10px;
            background: white;
            padding: 10px 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 1000;
            font-size: 14px;
          }
          .control-panel {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 8px;
            border-radius: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
            display: flex;
            gap: 5px;
          }
          .control-button {
            display: inline-block;
            padding: 10px 20px;
            background: #2d5a3d;
            color: white;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            transition: all 0.3s;
          }
          .control-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          }
          .control-button:active {
            transform: translateY(0);
          }
          .drawing-mode {
            background: #cc5500 !important;
          }
          .instructions {
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(255,255,255,0.95);
            padding: 10px 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 1000;
            font-size: 14px;
            color: #2d5a3d;
            display: none;
          }
          .instructions.active {
            display: block;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div class="info-panel">
          <strong>Distance:</strong> <span id="distance">0</span> ${
            settings.units === "imperial" ? "mi" : "km"
          }
        </div>
        <div id="instructions" class="instructions">
          📍 Click on the map to add points to your route
        </div>
        <div class="control-panel">
          <span id="continueBtn" class="control-button" onclick="continueRoute()">Continue Route</span>
          <span class="control-button" onclick="undoLastPoint()">Undo Last</span>
          <span class="control-button" onclick="clearExtension()">Clear Extension</span>
        </div>
        <script>
          var map = L.map('map');
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);

          var existingRoute = [${routeCoords}];
          var extensionPoints = [];
          var existingLine = null;
          var extensionLine = null;
          var totalDistance = ${distance};
          var isDrawing = false;
          var extensionMarkers = [];

          // Draw existing route
          if (existingRoute.length > 0) {
            existingLine = L.polyline(existingRoute, {
              color: '#2d5a3d',
              weight: 4,
              opacity: 0.8
            }).addTo(map);

            // Add start marker
            L.marker(existingRoute[0], {
              icon: L.divIcon({
                html: '<div style="background: #2d5a3d; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [24, 24],
                className: 'custom-div-icon'
              })
            }).addTo(map).bindPopup('Start');

            // Add end marker that will move
            var endMarker = L.marker(existingRoute[existingRoute.length - 1], {
              icon: L.divIcon({
                html: '<div style="background: #cc5500; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [24, 24],
                className: 'custom-div-icon'
              })
            }).addTo(map).bindPopup('Current End');

            map.fitBounds(existingLine.getBounds().pad(0.1));
          } else {
            // If no existing route, center on a default location
            map.setView([47.6062, -122.3321], 13);
          }

          function continueRoute() {
            isDrawing = !isDrawing;
            var btn = document.getElementById('continueBtn');
            var instructions = document.getElementById('instructions');
            
            if (isDrawing) {
              btn.innerText = 'Stop Drawing';
              btn.classList.add('drawing-mode');
              instructions.classList.add('active');
              map.getContainer().style.cursor = 'crosshair';
            } else {
              btn.innerText = 'Continue Route';
              btn.classList.remove('drawing-mode');
              instructions.classList.remove('active');
              map.getContainer().style.cursor = '';
            }
          }

          function undoLastPoint() {
            if (extensionPoints.length > 0) {
              extensionPoints.pop();
              
              // Remove last marker
              if (extensionMarkers.length > 0) {
                var lastMarker = extensionMarkers.pop();
                map.removeLayer(lastMarker);
              }
              
              // Redraw extension line
              if (extensionLine) {
                map.removeLayer(extensionLine);
                extensionLine = null;
              }
              
              if (extensionPoints.length > 0) {
                // Connect to existing route if needed
                var lineToDraw = extensionPoints;
                if (existingRoute.length > 0) {
                  lineToDraw = [existingRoute[existingRoute.length - 1]].concat(extensionPoints);
                }
                
                extensionLine = L.polyline(lineToDraw, {
                  color: '#cc5500',
                  weight: 4,
                  opacity: 0.8,
                  dashArray: '10, 5'
                }).addTo(map);
              }
              
              updateRoute();
            }
          }

          function clearExtension() {
            extensionPoints = [];
            
            // Remove all extension markers
            extensionMarkers.forEach(function(marker) {
              map.removeLayer(marker);
            });
            extensionMarkers = [];
            
            if (extensionLine) {
              map.removeLayer(extensionLine);
              extensionLine = null;
            }
            
            updateRoute();
            
            if (isDrawing) {
              continueRoute(); // Turn off drawing mode
            }
          }

          map.on('click', function(e) {
            if (!isDrawing) return;
            
            var newPoint = [e.latlng.lat, e.latlng.lng];
            extensionPoints.push(newPoint);
            
            // Add a marker for the new point
            var marker = L.circleMarker(newPoint, {
              radius: 5,
              fillColor: '#cc5500',
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map);
            extensionMarkers.push(marker);
            
            // Draw/update extension line
            if (extensionLine) {
              map.removeLayer(extensionLine);
            }
            
            // Connect to the existing route if this is the first extension point
            var lineToDraw = extensionPoints;
            if (existingRoute.length > 0) {
              lineToDraw = [existingRoute[existingRoute.length - 1]].concat(extensionPoints);
            }
            
            extensionLine = L.polyline(lineToDraw, {
              color: '#cc5500',
              weight: 4,
              opacity: 0.8,
              dashArray: '10, 5'
            }).addTo(map);
            
            updateRoute();
          });

          function calculateDistance(points) {
            var distance = 0;
            for (var i = 1; i < points.length; i++) {
              var lat1 = points[i-1][0] * Math.PI / 180;
              var lat2 = points[i][0] * Math.PI / 180;
              var deltaLat = (points[i][0] - points[i-1][0]) * Math.PI / 180;
              var deltaLon = (points[i][1] - points[i-1][1]) * Math.PI / 180;

              var a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                      Math.cos(lat1) * Math.cos(lat2) *
                      Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
              var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              distance += 6371000 * c; // Distance in meters
            }
            return distance;
          }

          function updateRoute() {
            var allPoints = existingRoute.concat(extensionPoints);
            var newDistance = calculateDistance(allPoints);
            
            var displayDistance = newDistance;
            var unit = '${settings.units === "imperial" ? "mi" : "km"}';
            if (unit === 'km') {
              displayDistance = (newDistance / 1000).toFixed(2);
            } else {
              displayDistance = (newDistance / 1609.34).toFixed(2);
            }
            document.getElementById('distance').innerText = displayDistance;

            // Send updated route back
            var routeData = allPoints.map(function(point) {
              return {
                latitude: point[0],
                longitude: point[1],
                timestamp: Date.now()
              };
            });

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'routeUpdated',
              route: routeData,
              distance: newDistance
            }));
          }
        </script>
      </body>
      </html>
    `;
  };

  if (!activity) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Edit Activity</Text>
        <Text style={styles.subtitle}>
          {activity.isManualEntry ? "Manual Entry" : "Tracked Activity"}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Activity Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Activity name"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Duration</Text>
        <View style={styles.durationContainer}>
          <View style={styles.durationInput}>
            <TextInput
              style={styles.numberInput}
              value={durationHours}
              onChangeText={setDurationHours}
              keyboardType="numeric"
              placeholder="0"
            />
            <Text style={styles.durationLabel}>hours</Text>
          </View>
          <View style={styles.durationInput}>
            <TextInput
              style={styles.numberInput}
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              keyboardType="numeric"
              placeholder="0"
            />
            <Text style={styles.durationLabel}>minutes</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Activity Date</Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setDatePickerVisibility(true)}
        >
          <Ionicons name="calendar" size={20} color={theme.colors.forest} />
          <Text style={styles.dateText}>
            {activityDate.toLocaleDateString('en-US', { 
              weekday: 'short', 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Distance: {formatDistance(distance)}</Text>
        <TouchableOpacity
          style={styles.mapButton}
          onPress={() => setShowMap(true)}
        >
          <Ionicons name="map" size={20} color={theme.colors.forest} />
          <Text style={styles.mapButtonText}>
            {route.length > 0 ? "Edit Route on Map" : "Draw Route on Map"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Photos ({photos.length})</Text>
        <TouchableOpacity
          style={styles.addPhotoButton}
          onPress={handleAddPhotos}
        >
          <Ionicons name="images" size={20} color={theme.colors.forest} />
          <Text style={styles.addPhotoText}>Add Photos</Text>
        </TouchableOpacity>

        {photos.length > 0 && (
          <ScrollView horizontal style={styles.photoList}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image source={{ uri: photo }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => handleRemovePhoto(index)}
                >
                  <Ionicons name="close-circle" size={24} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes..."
          multiline
          numberOfLines={4}
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Ionicons name="save" size={20} color="white" />
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      {showMap && (
        <View style={styles.mapModal}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>Edit Route</Text>
            <TouchableOpacity onPress={() => setShowMap(false)}>
              <Text style={styles.doneButton}>Done</Text>
            </TouchableOpacity>
          </View>
          <WebView
            ref={webViewRef}
            style={styles.map}
            source={{ html: generateMapHTML() }}
            onMessage={handleMapMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>
      )}

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={(date) => {
          setActivityDate(date);
          setDatePickerVisibility(false);
        }}
        onCancel={() => setDatePickerVisibility(false)}
        date={activityDate}
        maximumDate={new Date()} // Can't pick future dates
      />
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
  section: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 12,
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
  textArea: {
    height: 100,
    textAlignVertical: "top",
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
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  dateText: {
    fontSize: 16,
    color: theme.colors.navy,
    flex: 1,
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.forest,
    borderRadius: 8,
    padding: 14,
  },
  mapButtonText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.forest,
    marginLeft: 10,
    fontWeight: "500",
  },
  addPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.forest,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  addPhotoText: {
    color: theme.colors.forest,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  photoList: {
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
    backgroundColor: theme.colors.burntOrange,
    borderRadius: 12,
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
  mapModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.white,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 50,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
  },
  doneButton: {
    color: theme.colors.forest,
    fontSize: 16,
    fontWeight: "600",
  },
  map: {
    flex: 1,
  },
});