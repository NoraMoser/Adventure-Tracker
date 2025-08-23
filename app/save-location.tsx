// save-location.tsx - Complete fixed version with better keyboard handling
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { categoryList, CategoryType } from '../constants/categories';
import { theme } from '../constants/theme';
import { useLocation } from '../contexts/LocationContext';
import { LocationService, PlaceSuggestion } from '../services/locationService';

export default function SaveLocationScreen() {
  const { location, savedSpots, getLocation, saveCurrentLocation, loading, error } = useLocation();
  const router = useRouter();
  
  // Form state
  const [locationName, setLocationName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('other');
  const [isSaving, setIsSaving] = useState(false);
  
  // Smart location state
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Ref for the location name input
  const locationNameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Get current location when screen loads
    if (!location) {
      getLocation();
    } else {
      // When we have a location, get smart suggestions
      fetchLocationSuggestions();
    }
  }, [location]);

  useEffect(() => {
    // Show error if any
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);

  const fetchLocationSuggestions = async () => {
    if (!location) return;
    
    setLoadingSuggestions(true);
    try {
      const suggestions = await LocationService.getLocationSuggestions(
        location.latitude,
        location.longitude
      );
      setSuggestions(suggestions);
      
      // Auto-select the first suggestion if available
      if (suggestions.length > 0) {
        const firstSuggestion = suggestions[0];
        setSelectedSuggestion(firstSuggestion);
        setLocationName(firstSuggestion.name);
        
        // Auto-categorize based on suggestion
        autoSelectCategory(firstSuggestion);
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const autoSelectCategory = (suggestion: PlaceSuggestion) => {
    // Use the suggested category type if available
    if (suggestion.suggestedCategoryType) {
      setSelectedCategory(suggestion.suggestedCategoryType);
      return;
    }
    
    // Otherwise try to detect from the name
    const name = suggestion.name.toLowerCase();
    
    // Direct mapping to valid CategoryType values
    if (name.includes('beach')) {
      setSelectedCategory('beach');
    } else if (name.includes('trail') || name.includes('hike')) {
      setSelectedCategory('trail');
    } else if (name.includes('restaurant') || name.includes('cafe') || name.includes('coffee')) {
      setSelectedCategory('restaurant');
    } else if (name.includes('viewpoint') || name.includes('vista') || name.includes('lookout')) {
      setSelectedCategory('viewpoint');
    } else if (name.includes('camp')) {
      setSelectedCategory('camping');
    } else if (name.includes('lake') || name.includes('river') || name.includes('marina')) {
      setSelectedCategory('water');
    } else if (name.includes('climb') || name.includes('boulder')) {
      setSelectedCategory('climbing');
    } else if (name.includes('museum') || name.includes('historic')) {
      setSelectedCategory('historic');
    } else if (name.includes('shop') || name.includes('store') || name.includes('mall')) {
      setSelectedCategory('shopping');
    }
  };

  const handleSelectSuggestion = (suggestion: PlaceSuggestion) => {
    setSelectedSuggestion(suggestion);
    setLocationName(suggestion.name);
    setShowSuggestions(false);
    
    // Add address to description if available
    if (suggestion.address && !locationDescription) {
      setLocationDescription(`📍 ${suggestion.address}`);
    }
    
    // Auto-categorize
    autoSelectCategory(suggestion);
  };

  const handleManualEntry = () => {
    setSelectedSuggestion(null);
    setLocationName('');
    setLocationDescription('');
    setShowSuggestions(false);
    
    // Focus the input
    setTimeout(() => {
      locationNameInputRef.current?.focus();
    }, 100);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
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
      mediaTypes: ['images'],
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
    if (isSaving) return; // Prevent double-tap
    
    Keyboard.dismiss();
    
    if (!locationName.trim()) {
      Alert.alert('Error', 'Please enter a name for this location');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'No location available. Please try getting your location first.');
      return;
    }

    setIsSaving(true);

    try {
      // Pass photos directly - LocationContext will handle upload
      await saveCurrentLocation(
        locationName.trim(), 
        locationDescription.trim(), 
        photos, // Pass local URIs - context will upload them
        selectedCategory
      );
      
      // Clear form and navigate back
      setLocationName('');
      setLocationDescription('');
      setPhotos([]);
      setSelectedCategory('other');
      
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
      console.error('Error saving location:', err);
      Alert.alert('Error', 'Failed to save location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGetLocation = () => {
    getLocation();
    // Reset suggestions when getting new location
    setSelectedSuggestion(null);
    setSuggestions([]);
  };

  if (loading && !location) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.forest} />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Location Display Section */}
        <View style={styles.locationCard}>
          {location ? (
            <View style={styles.locationInfo}>
              <View style={styles.locationHeader}>
                <Ionicons name="location" size={24} color="#34C759" />
                <Text style={styles.locationTitle}>Location Captured!</Text>
              </View>
              
              {/* Smart Suggestions */}
              {loadingSuggestions ? (
                <View style={styles.suggestionsLoading}>
                  <ActivityIndicator size="small" color={theme.colors.forest} />
                  <Text style={styles.suggestionsLoadingText}>Finding nearby places...</Text>
                </View>
              ) : suggestions.length > 0 ? (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>Detected nearby places:</Text>
                  
                  {selectedSuggestion && (
                    <View style={styles.selectedSuggestion}>
                      <Ionicons 
                        name={selectedSuggestion.type === 'business' ? 'business' : 'pin'} 
                        size={20} 
                        color={theme.colors.forest} 
                      />
                      <View style={styles.selectedSuggestionText}>
                        <Text style={styles.selectedSuggestionName}>{selectedSuggestion.name}</Text>
                        {selectedSuggestion.address && (
                          <Text style={styles.selectedSuggestionAddress}>{selectedSuggestion.address}</Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => setShowSuggestions(true)}>
                        <Ionicons name="chevron-down" size={20} color={theme.colors.gray} />
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.changeSuggestionButton}
                    onPress={() => setShowSuggestions(true)}
                  >
                    <Text style={styles.changeSuggestionText}>Choose different place</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.manualEntryButton}
                    onPress={handleManualEntry}
                  >
                    <Ionicons name="create-outline" size={16} color={theme.colors.burntOrange} />
                    <Text style={styles.manualEntryText}>Clear and enter manually</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              
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
                <Ionicons name="refresh" size={18} color={theme.colors.forest} />
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
            <TouchableOpacity 
              style={[styles.photoButton, isSaving && styles.disabledButton]} 
              onPress={handleTakePhoto}
              disabled={isSaving}
            >
              <Ionicons name="camera" size={24} color={theme.colors.forest} />
              <Text style={styles.photoButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.photoButton, isSaving && styles.disabledButton]} 
              onPress={handlePickImage}
              disabled={isSaving}
            >
              <Ionicons name="images" size={24} color={theme.colors.forest} />
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
                    disabled={isSaving}
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
          <Text style={styles.label}>Category</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.categoryScroll}
          >
            {categoryList.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id && { backgroundColor: category.color }
                ]}
                onPress={() => setSelectedCategory(category.id)}
                disabled={isSaving}
              >
                <Ionicons 
                  name={category.icon} 
                  size={20} 
                  color={selectedCategory === category.id ? 'white' : category.color} 
                />
                <Text 
                  style={[
                    styles.categoryChipText,
                    selectedCategory === category.id && { color: 'white' }
                  ]}
                >
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>
            Location Name *
            {selectedSuggestion && (
              <Text style={styles.labelHint}> (you can edit this)</Text>
            )}
          </Text>
          <TextInput
            ref={locationNameInputRef}
            style={styles.input}
            value={locationName}
            onChangeText={setLocationName}
            placeholder="e.g., Secret Beach Spot"
            placeholderTextColor="#999"
            editable={!isSaving}
            keyboardType="default"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={locationDescription}
            onChangeText={setLocationDescription}
            placeholder="Add notes about this location..."
            placeholderTextColor="#999"
            editable={!isSaving}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.saveButton, (!location || isSaving) && styles.saveButtonDisabled]}
            onPress={handleSaveLocation}
            disabled={!location || isSaving}
          >
            {isSaving ? (
              <>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.saveButtonText}>Saving...</Text>
              </>
            ) : (
              <>
                <Ionicons name="save" size={20} color="white" />
                <Text style={styles.saveButtonText}>Save Location</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Suggestions Modal */}
        <Modal
          visible={showSuggestions}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowSuggestions(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose Location</Text>
                <TouchableOpacity onPress={() => setShowSuggestions(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.gray} />
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => handleSelectSuggestion(item)}
                  >
                    <Ionicons 
                      name={
                        item.type === 'business' ? 'business' :
                        item.type === 'landmark' ? 'flag' :
                        item.type === 'poi' ? 'pin' : 'location'
                      } 
                      size={20} 
                      color={theme.colors.forest} 
                    />
                    <View style={styles.suggestionTextContainer}>
                      <Text style={styles.suggestionName}>{item.name}</Text>
                      {item.address && (
                        <Text style={styles.suggestionAddress}>{item.address}</Text>
                      )}
                      {item.distance && (
                        <Text style={styles.suggestionDistance}>
                          {item.distance < 1000 
                            ? `${item.distance.toFixed(0)}m away`
                            : `${(item.distance / 1000).toFixed(1)}km away`
                          }
                        </Text>
                      )}
                    </View>
                    {selectedSuggestion?.id === item.id && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.forest} />
                    )}
                  </TouchableOpacity>
                )}
                ListFooterComponent={
                  <TouchableOpacity
                    style={[styles.suggestionItem, styles.manualOption]}
                    onPress={() => {
                      setShowSuggestions(false);
                      handleManualEntry();
                    }}
                  >
                    <Ionicons name="create" size={20} color={theme.colors.burntOrange} />
                    <Text style={styles.manualOptionText}>Clear and enter manually</Text>
                  </TouchableOpacity>
                }
              />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
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
  suggestionsContainer: {
    width: '100%',
    marginBottom: 15,
  },
  suggestionsTitle: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: 10,
    textAlign: 'center',
  },
  suggestionsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  suggestionsLoadingText: {
    marginLeft: 8,
    color: theme.colors.gray,
    fontSize: 14,
  },
  selectedSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.offWhite,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedSuggestionText: {
    flex: 1,
    marginLeft: 10,
  },
  selectedSuggestionName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  selectedSuggestionAddress: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  changeSuggestionButton: {
    alignItems: 'center',
    padding: 8,
  },
  changeSuggestionText: {
    color: theme.colors.forest,
    fontSize: 14,
    fontWeight: '500',
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  manualEntryText: {
    color: theme.colors.burntOrange,
    fontSize: 14,
    marginLeft: 4,
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
  disabledButton: {
    opacity: 0.5,
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
  labelHint: {
    fontSize: 12,
    color: theme.colors.gray,
    fontWeight: 'normal',
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
    color: theme.colors.navy,
    minHeight: 48,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
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
    opacity: 0.7,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  categoryScroll: {
    marginBottom: 20,
    maxHeight: 50,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  categoryChipText: {
    marginLeft: 6,
    fontSize: 14,
    color: theme.colors.gray,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  suggestionTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.navy,
  },
  suggestionAddress: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  suggestionDistance: {
    fontSize: 11,
    color: theme.colors.lightGray,
    marginTop: 2,
  },
  manualOption: {
    backgroundColor: theme.colors.offWhite,
  },
  manualOptionText: {
    fontSize: 16,
    color: theme.colors.burntOrange,
    marginLeft: 12,
    fontWeight: '500',
  },
});