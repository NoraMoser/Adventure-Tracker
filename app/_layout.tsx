import * as Location from 'expo-location';
import React, { useRef, useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function RootLayout() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const webViewRef = useRef<WebView>(null);

  const getLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      
      // Send location to map
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'setLocation',
          lat: currentLocation.coords.latitude,
          lng: currentLocation.coords.longitude
        }));
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get location');
    }
  };

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
                }
            });
        </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Adventure Tracker</Text>
        <Button title="Get My Location" onPress={getLocation} />
      </View>
      
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html: mapHtml }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
      
      {location && (
        <View style={styles.locationInfo}>
          <Text>Lat: {location.coords.latitude.toFixed(6)}</Text>
          <Text>Lng: {location.coords.longitude.toFixed(6)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  map: {
    flex: 1,
  },
  locationInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
});