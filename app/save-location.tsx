import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useLocation } from '../contexts/LocationContext';

export default function SaveLocationScreen() {
  const { location, savedSpots, getLocation, saveCurrentLocation, loading, error } = useLocation();
  const router = useRouter();
  const [locationName, setLocationName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    // Get current location when screen loads
    if (!location) {
      getLocation();
    }
  }, []);

  useEffect(() => {
    // Show error if any
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);

  const handleTakePhoto = async () => {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos');
      return;
    }

    // Launch camera
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
    // Request media library permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library permission is required to select photos');
      return;
    }

    // Launch image picker
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

    if (!location) {
      Alert.alert('Error', 'No location available. Please try getting your location first.');
      return;
    }

    try {
      // Save location with photos
      await saveCurrentLocation(locationName, locationDescription, photos);
      
      // Clear form and navigate back
      setLocationName('');
      setLocationDescription('');
      setPhotos([]);
      
      // Show success and go back
      Alert.alert(
        'Success',
        'Location saved successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to save location');
    }
  };

  const handleGetLocation = () => {
    getLocation();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Location Display Section */}
      <View style={styles.locationCard}>
        {location ? (
          <View style={styles.locationInfo}>
            <View style={styles.locationHeader}>
              <Ionicons name="location" size={24} color="#34C759" />
              <Text style={styles.locationTitle}>Location Captured!</Text>
              <TouchableOpacity 
            style={styles.manualLocationButton}
            onPress={() => router.replace('/add-location')}
          >
            <Ionicons name="map-outline" size={18} color={theme.colors.burntOrange} />
            <Text style={styles.manualLocationText}>Choose on Map Instead</Text>
          </TouchableOpacity>
        </View>
            <View style={styles.coordinatesBox}>
              <View style={styles.coordRow}>
                <Text style={styles.coordLabel}>Latitude:</Text>
                <Text style={styles.coordValue}>{location.latitude.toFixed(6)}</Text>
              </View>
              <View style={styles.coordRow}>
                <Text style={styles.coordLabel}>Longitude:</Text>
                <Text style={styles.coordValue}>{location.longitude.toFixed(6)}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.updateLocationButton} onPress={handleGetLocation}>
              <Ionicons name="refresh" size={18} color="#007AFF" />
              <Text style={styles.updateLocationText}>Update Location</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noLocationContainer}>
            <Ionicons name="location-outline" size={50} color="#999" />
            <Text style={styles.noLocationText}>No location captured yet</Text>
            <TouchableOpacity style={styles.getLocationButton} onPress={handleGetLocation}>
              <Ionicons name="navigate" size={20} color="white" />
              <Text style={styles.getLocationButtonText}>Get My Location</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Photo Section */}
      <View style={styles.photoSection}>
        <Text style={styles.sectionTitle}>Photos</Text>
        <View style={styles.photoActions}>
          <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
            <Ionicons name="camera" size={24} color="#007AFF" />
            <Text style={styles.photoButtonText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={handlePickImage}>
            <Ionicons name="images" size={24} color="#007AFF" />
            <Text style={styles.photoButtonText}>Choose Photo</Text>
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
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Form Section */}
      <View style={styles.formContainer}>
        <Text style={styles.label}>Location Name *</Text>
        <TextInput
          style={styles.input}
          value={locationName}
          onChangeText={setLocationName}
          placeholder="e.g., Secret Beach Spot"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Description (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={locationDescription}
          onChangeText={setLocationDescription}
          placeholder="Add notes about this location..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.saveButton, !location && styles.saveButtonDisabled]}
          onPress={handleSaveLocation}
          disabled={!location}
        >
          <Ionicons name="save" size={20} color="white" />
          <Text style={styles.saveButtonText}>Save Location</Text>
        </TouchableOpacity>
      </View>

      {savedSpots.length > 0 && (
        <View style={styles.savedSpotsInfo}>
          <Text style={styles.savedSpotsText}>
            You have {savedSpots.length} saved {savedSpots.length === 1 ? 'spot' : 'spots'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  contentContainer: {
    paddingBottom: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.offWhite,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.gray,
  },
  locationCard: {
    backgroundColor: theme.colors.white,
    margin: 15,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationInfo: {
    alignItems: 'center',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.navy,
    marginLeft: 8,
  },
  coordinatesBox: {
    backgroundColor: theme.colors.offWhite,
    padding: 15,
    borderRadius: 8,
    width: '100%',
  },
  coordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  coordLabel: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  coordValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.navy,
    fontFamily: 'monospace',
  },
  updateLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    padding: 8,
  },
  updateLocationText: {
    color: theme.colors.forest,
    marginLeft: 5,
    fontSize: 14,
  },
  noLocationContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noLocationText: {
    fontSize: 16,
    color: theme.colors.gray,
    marginTop: 10,
    marginBottom: 20,
  },
  getLocationButton: {
    backgroundColor: theme.colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  getLocationButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  photoSection: {
    backgroundColor: theme.colors.white,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 15,
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
    marginTop: 10,
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
  formContainer: {
    paddingHorizontal: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 8,
    marginLeft: 5,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  saveButton: {
    backgroundColor: theme.colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.lightGray,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  savedSpotsInfo: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  savedSpotsText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: 'center',
  },
  manualLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    padding: 10,
  },
  manualLocationText: {
    color: theme.colors.burntOrange,
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '600',
  },
});