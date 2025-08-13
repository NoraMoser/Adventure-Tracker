import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { SavedSpot } from '../types';

export interface MapRef {
  setLocation: (lat: number, lng: number) => void;
  addSavedSpot: (spot: SavedSpot) => void;
}

interface MapProps {
  style?: any;
}

const Map = forwardRef<MapRef, MapProps>(({ style }, ref) => {
  const webViewRef = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    setLocation: (lat: number, lng: number) => {
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'setLocation',
          lat,
          lng
        }));
      }
    },
    addSavedSpot: (spot: SavedSpot) => {
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'addSavedSpot',
          spot
        }));
      }
    }
  }));

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
        <style>
            body { margin: 0; padding: 0; }
            #map { height: 100vh; width: 100vw; }
        </style>
    </head>
    <body>
        <div id="map"></div>
        <script>
            // Initialize map (South Hill, WA area)
            var map = L.map('map').setView([47.1379, -122.4783], 13);
            
            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            
            var currentMarker = null;
            var savedSpots = [];
            
            // Listen for messages from React Native
            window.addEventListener('message', function(event) {
                var data = JSON.parse(event.data);
                if (data.type === 'setLocation') {
                    // Remove old marker
                    if (currentMarker) {
                        map.removeLayer(currentMarker);
                    }
                    
                    // Add new marker and center map
                    currentMarker = L.marker([data.lat, data.lng]).addTo(map);
                    map.setView([data.lat, data.lng], 15);
                } else if (data.type === 'addSavedSpot') {
                    // Add permanent marker for saved spot
                    var marker = L.marker([data.spot.lat, data.spot.lng])
                        .addTo(map)
                        .bindPopup('<b>' + data.spot.name + '</b><br>' + data.spot.date);
                    savedSpots.push(marker);
                }
            });
        </script>
    </body>
    </html>
  `;

  return (
    <WebView
      ref={webViewRef}
      style={[styles.map, style]}
      source={{ html: mapHtml }}
      javaScriptEnabled={true}
      domStorageEnabled={true}
    />
  );
});

// Add display name for React DevTools and ESLint
Map.displayName = 'Map';

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

export default Map;