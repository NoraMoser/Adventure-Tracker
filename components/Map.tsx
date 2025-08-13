import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { SavedSpot } from '../types';

export interface MapRef {
  setLocation: (lat: number, lng: number) => void;
  addSavedSpot: (spot: SavedSpot) => void;
  updateSpotWithPhoto: (spotId: string, photos: string[]) => void;
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
    },
    updateSpotWithPhoto: (spotId: string, photos: string[]) => {
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'updateSpotWithPhoto',
          spotId,
          photos
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
            document.addEventListener('message', function(event) {
                handleMessage(event.data);
            });
            
            window.addEventListener('message', function(event) {
                handleMessage(event.data);
            });
            
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.onMessage = function(event) {
                    handleMessage(event.data);
                };
            }
            
            function handleMessage(messageData) {
                try {
                    var data = JSON.parse(messageData);
                    
                    if (data.type === 'setLocation') {
                        if (currentMarker) {
                            map.removeLayer(currentMarker);
                        }
                        currentMarker = L.marker([data.lat, data.lng]).addTo(map);
                        map.setView([data.lat, data.lng], 15);
                    } else if (data.type === 'addSavedSpot') {
                        var marker = L.marker([data.spot.lat, data.spot.lng])
                            .addTo(map)
                            .bindPopup(createPopupContent(data.spot));
                        savedSpots.push({marker: marker, spot: data.spot});
                    } else if (data.type === 'updateSpotWithPhoto') {
                        var spotIndex = savedSpots.findIndex(s => s.spot.id === data.spotId);
                        if (spotIndex !== -1) {
                            savedSpots[spotIndex].spot.photos = data.photos;
                            savedSpots[spotIndex].marker.setPopupContent(createPopupContent(savedSpots[spotIndex].spot));
                        }
                    }
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            }
            
            function createPopupContent(spot) {
                var content = '<div style="text-align: center;">';
                content += '<b>' + spot.name + '</b><br>';
                content += '<small>' + spot.date + '</small>';
                
                if (spot.photos && spot.photos.length > 0) {
                    content += '<br><br>';
                    for (var i = 0; i < Math.min(spot.photos.length, 3); i++) {
                        content += '<img src="' + spot.photos[i] + '" style="width: 60px; height: 60px; object-fit: cover; margin: 2px; border-radius: 4px;">';
                    }
                    if (spot.photos.length > 3) {
                        content += '<br><small>+' + (spot.photos.length - 3) + ' more photos</small>';
                    }
                }
                
                content += '</div>';
                return content;
            }
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

Map.displayName = 'Map';

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

export default Map;