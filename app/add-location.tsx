import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '../constants/theme';
import { useLocation } from '../contexts/LocationContext';

export default function AddLocationScreen() {
  const { saveManualLocation, location: currentLocation } = useLocation();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  
  const [selectedLocation, setSelectedLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);

  // Use current location as default center, or fall back to a default
  const defaultCenter = currentLocation || { latitude: 47.6062, longitude: -122.3321 }; // Seattle default

  useEffect(() => {
    // Get current location if we don't have it
    if (!currentLocation) {
      getCurrentLocation();
    }
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        // Update map center to current location
        const js = `
          if (typeof map !== 'undefined') {
            map.setView([${location.coords.latitude}, ${location.coords.longitude}], 13);
          }
        `;
        webViewRef.current?.injectJavaScript(js);
      }
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      // Geocode the search query
      const results = await Location.geocodeAsync(searchQuery);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        
        // Update map and place marker
        const js = `
          if (typeof map !== 'undefined') {
            // Clear existing marker
            if (window.currentMarker) {
              map.removeLayer(window.currentMarker);
            }
            
            // Move map to location
            map.setView([${latitude}, ${longitude}], 15);
            
            // Add marker
            window.currentMarker = L.marker([${latitude}, ${longitude}])
              .addTo(map)
              .bindPopup('${searchQuery}')
              .openPopup();
              
            // Send location back
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'locationSelected',
              latitude: ${latitude},
              longitude: ${longitude}
            }));
          }
        `;
        webViewRef.current?.injectJavaScript(js);
        
        setSelectedLocation({ latitude, longitude });
        setShowForm(true);
      } else {
        Alert.alert('Not Found', 'Could not find that location. Try a different search.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to search for location');
    } finally {
      setIsSearching(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library permission is required to select photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
  };

  const handleSaveLocation = async () => {
    if (!locationName.trim()) {
      Alert.alert('Error', 'Please enter a name for this location');
      return;
    }

    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location on the map');
      return;
    }

    try {
      // Save the location with the selected coordinates and photos
      await saveManualLocation(locationName, selectedLocation, locationDescription, photos);
      
      Alert.alert(
        'Success',
        'Location saved successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to save location');
    }
  };

  const generateMapHTML = () => {
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
          .custom-popup { font-size: 14px; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          // Initialize map
          var map = L.map('map').setView([${defaultCenter.latitude}, ${defaultCenter.longitude}], 13);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          // Store current marker reference
          window.currentMarker = null;

          // Handle map clicks
          map.on('click', function(e) {
            // Remove existing marker
            if (window.currentMarker) {
              map.removeLayer(window.currentMarker);
            }
            
            // Add new marker
            window.currentMarker = L.marker([e.latlng.lat, e.latlng.lng])
              .addTo(map)
              .bindPopup('Selected location')
              .openPopup();
            
            // Send location back to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'locationSelected',
              latitude: e.latlng.lat,
              longitude: e.latlng.lng
            }));
          });

          // Add instructions overlay
          var info = L.control();
          info.onAdd = function (map) {
            this._div = L.DomUtil.create('div', 'info');
            this._div.style.background = 'rgba(255,255,255,0.9)';
            this._div.style.padding = '10px';
            this._div.style.borderRadius = '8px';
            this._div.style.fontSize = '14px';
            this._div.innerHTML = '<b>Tap on the map to select a location</b>';
            return this._div;
          };
          info.addTo(map);

          // Remove instructions after first click
          map.once('click', function() {
            info.remove();
          });
        </script>
      </body>
      </html>
    `;
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'locationSelected') {
        setSelectedLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
        setShowForm(true);
      }
    } catch (error) {
      console.log('Error parsing message:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.colors.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a place..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            placeholderTextColor={theme.colors.lightGray}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.gray} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={isSearching}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: generateMapHTML() }}
          onMessage={handleWebViewMessage}
          scrollEnabled={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
        
        {/* Current Location Button */}
        <TouchableOpacity 
          style={styles.currentLocationButton}
          onPress={getCurrentLocation}
        >
          <Ionicons name="locate" size={24} color={theme.colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Location Form */}
      {showForm && selectedLocation && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.formContainer}
        >
          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <Text style={styles.formTitle}>Save This Location</Text>
            
            <View style={styles.coordinatesDisplay}>
              <Ionicons name="pin" size={20} color={theme.colors.burntOrange} />
              <Text style={styles.coordinates}>
                {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </Text>
            </View>

            <Text style={styles.label}>Location Name *</Text>
            <TextInput
              style={styles.input}
              value={locationName}
              onChangeText={setLocationName}
              placeholder="e.g., Best Coffee Shop"
              placeholderTextColor={theme.colors.lightGray}
            />

            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={locationDescription}
              onChangeText={setLocationDescription}
              placeholder="What makes this place special?"
              placeholderTextColor={theme.colors.lightGray}
              multiline
              numberOfLines={3}
            />

            {/* Photo Section */}
            <Text style={styles.label}>Photos (Optional)</Text>
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
                <Ionicons name="camera" size={20} color={theme.colors.forest} />
                <Text style={styles.photoButtonText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={handlePickImage}>
                <Ionicons name="images" size={20} color={theme.colors.forest} />
                <Text style={styles.photoButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoContainer}>
                    <Image source={{ uri: photo }} style={styles.photo} />
                    <TouchableOpacity 
                      style={styles.removePhotoButton} 
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={24} color={theme.colors.burntOrange} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowForm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSaveLocation}
              >
                <Ionicons name="save" size={20} color={theme.colors.white} />
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
    color: theme.colors.navy,
  },
  searchButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 8,
  },
  searchButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: theme.colors.white,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  formContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  form: {
    padding: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.navy,
    marginBottom: 15,
  },
  coordinatesDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.offWhite,
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  coordinates: {
    marginLeft: 10,
    fontSize: 14,
    color: theme.colors.gray,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    color: theme.colors.navy,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: theme.colors.offWhite,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  cancelButtonText: {
    color: theme.colors.gray,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: theme.colors.forest,
    marginLeft: 10,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.offWhite,
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
    fontWeight: '500',
  },
  photoList: {
    marginBottom: 15,
    maxHeight: 110,
  },
  photoContainer: {
    marginRight: 10,
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
});