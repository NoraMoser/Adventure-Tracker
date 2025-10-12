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
  ActivityIndicator,
  Modal,
  Platform,
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
  const [routeWasRedrawn, setRouteWasRedrawn] = useState(false);

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
  const injectedJavaScript = `
  (function() {
    const originalPostMessage = window.ReactNativeWebView.postMessage;
    window.ReactNativeWebView.postMessage = function(data) {
      originalPostMessage.call(window.ReactNativeWebView, data);
    };
    true; // Required for iOS
  })();
`;

  const handleMapMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "routeUpdated") {
   
        // Update both route and distance
        setRoute(data.route || []);
        setDistance(data.distance || 0);
      }
    } catch (error) {
      console.error("Error parsing map message:", error);
      console.error("Raw message data:", event.nativeEvent.data);
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

  // Replace your entire generateMapHTML function with this complete version:

  const generateMapHTML = () => {
    const routeCoords = route
      .map((point: any) => `[${point.latitude}, ${point.longitude}]`)
      .join(",");

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
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
          flex-wrap: wrap;
          max-width: 90%;
          justify-content: center;
        }
        .control-button {
          display: inline-block;
          padding: 10px 15px;
          background: #2d5a3d;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 13px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: all 0.3s;
        }
        .control-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        .zoom-controls {
          position: absolute;
          top: 70px;
          left: 10px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          z-index: 1000;
          overflow: hidden;
        }
        .zoom-button {
          display: block;
          width: 40px;
          height: 40px;
          border: none;
          background: white;
          cursor: pointer;
          font-size: 20px;
          line-height: 40px;
          text-align: center;
          transition: background 0.3s;
        }
        .zoom-button:hover {
          background: #f0f0f0;
        }
        .zoom-button:not(:last-child) {
          border-bottom: 1px solid #ddd;
        }
        .location-button {
          position: absolute;
          top: 70px;
          right: 10px;
          width: 40px;
          height: 40px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          z-index: 1000;
          border: none;
          cursor: pointer;
          font-size: 20px;
          transition: all 0.3s;
        }
        .location-button:hover {
          transform: scale(1.1);
        }
        .drawing-mode {
          background: #cc5500 !important;
        }
        .danger-button {
          background: #dc3545 !important;
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
          max-width: 250px;
        }
        .instructions.active {
          display: block;
        }
        .redraw-mode {
          color: #dc3545;
        }
        .confirm-dialog {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 2000;
          text-align: center;
          display: none;
        }
        .confirm-dialog.active {
          display: block;
        }
        .confirm-dialog h3 {
          margin-top: 0;
          color: #dc3545;
        }
        .confirm-dialog p {
          margin: 15px 0;
          color: #333;
        }
        .confirm-buttons {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 20px;
        }
        .confirm-button {
          padding: 10px 20px;
          border-radius: 6px;
          border: none;
          font-weight: bold;
          cursor: pointer;
          transition: opacity 0.3s;
        }
        .confirm-button:hover {
          opacity: 0.8;
        }
        .confirm-yes {
          background: #dc3545;
          color: white;
        }
        .confirm-no {
          background: #6c757d;
          color: white;
        }
        .redraw-notice {
          position: absolute;
          top: 60px;
          left: 50%;
          transform: translateX(-50%);
          background: #dc3545;
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          z-index: 1001;
          font-weight: bold;
          display: none;
        }
        .redraw-notice.active {
          display: block;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div class="info-panel">
        <strong>Distance:</strong> <span id="distance">0</span> ${settings.units === "imperial" ? "mi" : "km"
      }
      </div>
      <div class="zoom-controls">
        <button class="zoom-button" onclick="map.zoomIn()">+</button>
        <button class="zoom-button" onclick="map.zoomOut()">−</button>
      </div>
      <button class="location-button" onclick="fitToRoute()">📍</button>
      <div id="instructions" class="instructions">
        <span id="instructionText">📍 Click on the map to add points to your route</span>
      </div>
      <div class="control-panel">
        <span id="continueBtn" class="control-button" onclick="continueRoute()">Continue Route</span>
        <span id="redrawBtn" class="control-button danger-button" onclick="toggleRedraw()">Redraw Entire Route</span>
        <span class="control-button" onclick="undoLastPoint()">Undo Last</span>
        <span class="control-button" onclick="clearChanges()">Clear Changes</span>
      </div>
      
      <div id="redrawNotice" class="redraw-notice">
        ⚠️ Drawing new route - Click "Save New Route" when done!
      </div>
      <div id="confirmDialog" class="confirm-dialog">
        <h3>Redraw Entire Route?</h3>
        <p>This will delete the existing route and let you draw a completely new one. This action cannot be undone.</p>
        <div class="confirm-buttons">
          <button class="confirm-button confirm-yes" onclick="confirmRedraw()">Yes, Redraw</button>
          <button class="confirm-button confirm-no" onclick="cancelRedraw()">Cancel</button>
        </div>
      </div>
      
      <script>
        // Initialize map
        var map = L.map('map', {
          zoomControl: true,
          touchZoom: true,
          doubleClickZoom: true,
          scrollWheelZoom: true,
          boxZoom: true,
          keyboard: true,
          tap: true,
          tapTolerance: 15,
          bounceAtZoomLimits: false
        });
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          minZoom: 3
        }).addTo(map);
        
        map.zoomControl.setPosition('topleft');

        // Global variables
        var existingRoute = [${routeCoords}];
        var originalRoute = [...existingRoute];
        var extensionPoints = [];
        var newRoutePoints = [];
        var existingLine = null;
        var extensionLine = null;
        var newRouteLine = null;
        var totalDistance = ${distance};
        var isDrawing = false;
        var isRedrawing = false;
        var extensionMarkers = [];
        var newRouteMarkers = [];
        var startMarker = null;
        var endMarker = null;

        // Draw existing route function
        function drawExistingRoute() {
          if (existingRoute.length > 0) {
            if (existingLine) {
              map.removeLayer(existingLine);
            }
            
            existingLine = L.polyline(existingRoute, {
              color: '#2d5a3d',
              weight: 4,
              opacity: 0.8
            }).addTo(map);

            if (startMarker) {
              map.removeLayer(startMarker);
            }
            startMarker = L.marker(existingRoute[0], {
              icon: L.divIcon({
                html: '<div style="background: #2d5a3d; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [24, 24],
                className: 'custom-div-icon'
              })
            }).addTo(map).bindPopup('Start');

            if (endMarker) {
              map.removeLayer(endMarker);
            }
            endMarker = L.marker(existingRoute[existingRoute.length - 1], {
              icon: L.divIcon({
                html: '<div style="background: #cc5500; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [24, 24],
                className: 'custom-div-icon'
              })
            }).addTo(map).bindPopup('End');

            map.fitBounds(existingLine.getBounds().pad(0.1));
          } else {
            map.setView([47.6062, -122.3321], 13);
          }
        }
        
        // Initialize with existing route
        drawExistingRoute();

        // Continue route function
        function continueRoute() {
          if (isRedrawing) {
            alert('Please finish or cancel the route redraw first');
            return;
          }
          
          isDrawing = !isDrawing;
          var btn = document.getElementById('continueBtn');
          var instructions = document.getElementById('instructions');
          
          if (isDrawing) {
            btn.innerText = 'Stop Drawing';
            btn.classList.add('drawing-mode');
            instructions.classList.add('active');
            document.getElementById('instructionText').innerText = '📍 Click on the map to add points to your route';
            map.getContainer().style.cursor = 'crosshair';
          } else {
            btn.innerText = 'Continue Route';
            btn.classList.remove('drawing-mode');
            instructions.classList.remove('active');
            map.getContainer().style.cursor = '';
          }
        }
        
        // Start redraw function
        function startRedraw() {
          if (isDrawing) {
            continueRoute();
          }
          document.getElementById('confirmDialog').classList.add('active');
        }
        
        // Confirm redraw function
        function confirmRedraw() {
          document.getElementById('confirmDialog').classList.remove('active');
          
          if (existingLine) {
            map.removeLayer(existingLine);
            existingLine = null;
          }
          if (startMarker) {
            map.removeLayer(startMarker);
            startMarker = null;
          }
          if (endMarker) {
            map.removeLayer(endMarker);
            endMarker = null;
          }
          
          clearExtensionPoints();
          
          isRedrawing = true;
          isDrawing = false;
          newRoutePoints = [];
          
          var btn = document.getElementById('redrawBtn');
          btn.innerText = 'Save New Route';
          btn.classList.add('drawing-mode');
          
          var instructions = document.getElementById('instructions');
          instructions.classList.add('active');
          document.getElementById('instructionText').innerHTML = '<span class="redraw-mode">🔴 REDRAW MODE: Click to draw your new route. Click "Save New Route" when done.</span>';
          
          document.getElementById('redrawNotice').classList.add('active');
          map.getContainer().style.cursor = 'crosshair';
        }
        
        // Toggle redraw function
        function toggleRedraw() {
          if (isRedrawing) {
            stopRedrawing();
          } else {
            startRedraw();
          }
        }
        
        // Cancel redraw function
        function cancelRedraw() {
          document.getElementById('confirmDialog').classList.remove('active');
        }
        
        function stopRedrawing() {
  
  if (newRoutePoints.length === 0) {
    isRedrawing = false;
    var btn = document.getElementById('redrawBtn');
    btn.innerText = 'Redraw Entire Route';
    btn.classList.remove('drawing-mode');
    var instructions = document.getElementById('instructions');
    instructions.classList.remove('active');
    document.getElementById('redrawNotice').classList.remove('active');
    map.getContainer().style.cursor = '';
    return;
  }
  
  var btn = document.getElementById('redrawBtn');
  btn.innerText = 'Processing...';
  btn.disabled = true;
  
  // Copy points
  var pointsToSave = [];
  for (var i = 0; i < newRoutePoints.length; i++) {
    pointsToSave.push([newRoutePoints[i][0], newRoutePoints[i][1]]);
  }
  
  // CRITICAL: Replace the existing route directly
  existingRoute = pointsToSave;
  extensionPoints = []; // Clear any extensions
  originalRoute = [...pointsToSave]; // Update the original too
  
  // Calculate and update distance display immediately
  var newDistance = calculateDistance(existingRoute);
  var displayDistance = newDistance;
  var unit = '${settings.units === "imperial" ? "mi" : "km"}';
  if (unit === 'km') {
    displayDistance = (newDistance / 1000).toFixed(2);
  } else {
    displayDistance = (newDistance / 1609.34).toFixed(2);
  }
  document.getElementById('distance').innerText = displayDistance;
  
  // Store the new route in a global variable that persists
  window.savedRedrawRoute = {
    route: existingRoute.map(function(point, index) {
      return {
        latitude: point[0],
        longitude: point[1],
        timestamp: Date.now() + index
      };
    }),
    distance: newDistance
  };
  
  // Set a flag that route was redrawn
  window.routeWasRedrawn = true;
    
  // Clean up visuals
  newRouteMarkers.forEach(function(marker) {
    map.removeLayer(marker);
  });
  newRouteMarkers = [];
  newRoutePoints = [];
  
  if (newRouteLine) {
    map.removeLayer(newRouteLine);
    newRouteLine = null;
  }
  
  // Redraw as existing route
  drawExistingRoute();
  
  // Reset UI
  isRedrawing = false;
  btn.innerText = 'Redraw Entire Route';
  btn.classList.remove('drawing-mode');
  btn.disabled = false;
  
  var instructions = document.getElementById('instructions');
  instructions.classList.remove('active');
  document.getElementById('redrawNotice').classList.remove('active');
  map.getContainer().style.cursor = '';
  
  // Show success with instruction
  var successDiv = document.createElement('div');
  successDiv.style.cssText = 'position:absolute;top:100px;left:50%;transform:translateX(-50%);background:#28a745;color:white;padding:15px 25px;border-radius:8px;z-index:9999;font-weight:bold;text-align:center;box-shadow:0 4px 8px rgba(0,0,0,0.3);';
  successDiv.innerHTML = '✓ Route Updated!<br><small style="font-weight:normal;">Click "Done" to apply changes</small>';
  document.body.appendChild(successDiv);
}

        // Undo last point function
        function undoLastPoint() {
          if (isRedrawing && newRoutePoints.length > 0) {
            newRoutePoints.pop();
            
            if (newRouteMarkers.length > 0) {
              var lastMarker = newRouteMarkers.pop();
              map.removeLayer(lastMarker);
            }
            
            if (newRouteLine) {
              map.removeLayer(newRouteLine);
              newRouteLine = null;
            }
            
            if (newRoutePoints.length > 0) {
              newRouteLine = L.polyline(newRoutePoints, {
                color: '#dc3545',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 5'
              }).addTo(map);
            }
            
            updateRouteForRedraw();
            
          } else if (extensionPoints.length > 0) {
            extensionPoints.pop();
            
            if (extensionMarkers.length > 0) {
              var lastMarker = extensionMarkers.pop();
              map.removeLayer(lastMarker);
            }
            
            if (extensionLine) {
              map.removeLayer(extensionLine);
              extensionLine = null;
            }
            
            if (extensionPoints.length > 0) {
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
        
        // Clear extension points function
        function clearExtensionPoints() {
          extensionPoints = [];
          extensionMarkers.forEach(function(marker) {
            map.removeLayer(marker);
          });
          extensionMarkers = [];
          
          if (extensionLine) {
            map.removeLayer(extensionLine);
            extensionLine = null;
          }
        }

        // Clear changes function
        function clearChanges() {
          if (isRedrawing) {
            isRedrawing = false;
            
            var btn = document.getElementById('redrawBtn');
            btn.innerText = 'Redraw Entire Route';
            btn.classList.remove('drawing-mode');
            
            var instructions = document.getElementById('instructions');
            instructions.classList.remove('active');
            document.getElementById('redrawNotice').classList.remove('active');
            map.getContainer().style.cursor = '';
            
            newRoutePoints = [];
            newRouteMarkers.forEach(function(marker) {
              map.removeLayer(marker);
            });
            newRouteMarkers = [];
            
            if (newRouteLine) {
              map.removeLayer(newRouteLine);
              newRouteLine = null;
            }
            
            existingRoute = [...originalRoute];
            drawExistingRoute();
            
          } else {
            clearExtensionPoints();
          }
          
          updateRoute();
          
          if (isDrawing) {
            continueRoute();
          }
        }

        // Map click handler
        map.on('click', function(e) {
          if (!isDrawing && !isRedrawing) return;
          
          var newPoint = [e.latlng.lat, e.latlng.lng];
          
          if (isRedrawing) {
            newRoutePoints.push(newPoint);
            
            var marker = L.circleMarker(newPoint, {
              radius: 5,
              fillColor: '#dc3545',
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map);
            newRouteMarkers.push(marker);
            
            if (newRouteLine) {
              map.removeLayer(newRouteLine);
            }
            
            newRouteLine = L.polyline(newRoutePoints, {
              color: '#dc3545',
              weight: 4,
              opacity: 0.8,
              dashArray: '10, 5'
            }).addTo(map);
            
            updateRouteForRedraw();
            
          } else if (isDrawing) {
            extensionPoints.push(newPoint);
            
            var marker = L.circleMarker(newPoint, {
              radius: 5,
              fillColor: '#cc5500',
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map);
            extensionMarkers.push(marker);
            
            if (extensionLine) {
              map.removeLayer(extensionLine);
            }
            
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
          }
        });

        // Calculate distance function
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
            distance += 6371000 * c;
          }
          return distance;
        }
        
        // Update route for redraw function
        function updateRouteForRedraw() {
          var newDistance = calculateDistance(newRoutePoints);
          
          var displayDistance = newDistance;
          var unit = '${settings.units === "imperial" ? "mi" : "km"}';
          if (unit === 'km') {
            displayDistance = (newDistance / 1000).toFixed(2);
          } else {
            displayDistance = (newDistance / 1609.34).toFixed(2);
          }
          document.getElementById('distance').innerText = displayDistance;
        }

        // Update route function
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
        
        // Fit to route function
        function fitToRoute() {
          var bounds = null;
          
          if (existingRoute.length > 0 || extensionPoints.length > 0 || newRoutePoints.length > 0) {
            var allPoints = [];
            
            if (isRedrawing && newRoutePoints.length > 0) {
              allPoints = newRoutePoints;
            } else {
              allPoints = existingRoute.concat(extensionPoints);
            }
            
            if (allPoints.length > 0) {
              bounds = L.latLngBounds(allPoints);
              map.fitBounds(bounds.pad(0.1));
            }
          } else {
            map.setView([47.6062, -122.3321], 13);
          }
        }
        
        // Touch event handling
        var touchStartTime;
        var touchStartPoint;
        
        map.on('touchstart', function(e) {
          touchStartTime = new Date().getTime();
          touchStartPoint = e.latlng;
        });
        
        map.on('touchend', function(e) {
          var touchEndTime = new Date().getTime();
          var touchDuration = touchEndTime - touchStartTime;
          
          if (touchDuration < 200 && touchStartPoint) {
            var distance = map.distance(touchStartPoint, e.latlng);
            if (distance < 50) {
              map.fire('click', {
                latlng: e.latlng,
                containerPoint: e.containerPoint,
                originalEvent: e.originalEvent
              });
            }
          }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' && isRedrawing) {
            stopRedrawing();
          }
          if (e.key === 'Escape') {
            if (isRedrawing || isDrawing) {
              clearChanges();
            }
          }
        });
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
            {activityDate.toLocaleDateString("en-US", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
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
                <Image source={{ uri: photo }} />
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
        <Modal
          visible={showMap}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowMap(false)}
        >
          <View style={styles.mapModal}>
            <View style={styles.mapHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowMap(false)}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={theme.colors.navy}
                />
              </TouchableOpacity>
              <Text style={styles.mapTitle}>Edit Route</Text>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => {
                  // Check if route was redrawn by injecting JavaScript
                  webViewRef.current?.injectJavaScript(`
      (function() {
        if (window.routeWasRedrawn && window.savedRedrawRoute) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'routeUpdated',
            route: window.savedRedrawRoute.route,
            distance: window.savedRedrawRoute.distance
          }));
          return true;
        }
        return false;
      })();
    `);

                  // Small delay to let message process, then close
                  setTimeout(() => {
                    setShowMap(false);
                  }, 100);
                }}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
            <WebView
              ref={webViewRef}
              style={styles.mapWebView}
              source={{ html: generateMapHTML() }}
              onMessage={handleMapMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scalesPageToFit={false}
              scrollEnabled={true}
              bounces={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled={true}
              mixedContentMode="compatibility"
              injectedJavaScript={injectedJavaScript}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error("WebView error:", nativeEvent);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error("WebView HTTP error:", nativeEvent);
              }}
              onLoad={() => {
                console.log("WebView loaded successfully");
              }}
            />
          </View>
        </Modal>
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
  mapLoading: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: "center",
  },
  mapLoadingText: {
    marginTop: 10,
    fontSize: 14,
    color: theme.colors.gray,
  },
  mapModal: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
  },
  doneButtonText: {
    color: theme.colors.forest,
    fontSize: 16,
    fontWeight: "600",
  },
  mapWebView: {
    flex: 1,
  },
});
