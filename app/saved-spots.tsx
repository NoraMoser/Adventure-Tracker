// saved-spots.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { categories, categoryList, CategoryType } from '../constants/categories';
import { useLocation } from '../contexts/LocationContext';
import { ShareService } from '../services/shareService';

// Theme colors defined inline
const theme = {
  colors: {
    navy: '#1e3a5f',
    forest: '#2d5a3d',
    offWhite: '#faf8f5',
    burntOrange: '#cc5500',
    white: '#ffffff',
    gray: '#666666',
    lightGray: '#999999',
    borderGray: '#e0e0e0',
  }
};

const { width } = Dimensions.get('window');

export default function SavedSpotsScreen() {
  const { savedSpots, deleteSpot, location, getLocation } = useLocation();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedSpot, setSelectedSpot] = useState<any>(null);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'all'>('all');
  const webViewRef = React.useRef<WebView>(null);
  
  // Search and sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'distance'>('date');
  const [showSearchBar, setShowSearchBar] = useState(false);

  // Get current location on mount for distance calculations
  useEffect(() => {
    if (!location) {
      getLocation();
    }
  }, []);

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Filter and sort spots
  const filteredSpots = useMemo(() => {
    let spots = savedSpots;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      spots = spots.filter(spot => spot.category === selectedCategory);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      spots = spots.filter(spot => 
        spot.name.toLowerCase().includes(query) ||
        (spot.description && spot.description.toLowerCase().includes(query)) ||
        spot.category.toLowerCase().includes(query)
      );
    }
    
    // Sort spots
    const sorted = [...spots].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'distance':
          // Sort by distance from current location if available
          if (location) {
            const distA = calculateDistance(
              location.latitude,
              location.longitude,
              a.location.latitude,
              a.location.longitude
            );
            const distB = calculateDistance(
              location.latitude,
              location.longitude,
              b.location.latitude,
              b.location.longitude
            );
            return distA - distB;
          }
          return 0;
        case 'date':
        default:
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
    });
    
    return sorted;
  }, [savedSpots, selectedCategory, searchQuery, sortBy, location]);

  const handleDeleteSpot = (spotId: string, spotName: string) => {
    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete "${spotName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteSpot(spotId)
        }
      ]
    );
  };

  const handleShareSpot = async (spot: any) => {
    try {
      if (spot.photos && spot.photos.length > 0) {
        await ShareService.shareLocationWithPhotos(spot);
      } else {
        await ShareService.shareLocation(spot);
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share location');
    }
  };

  const handleSpotPress = (spot: any) => {
    setSelectedSpot(spot);
    if (spot.photos && spot.photos.length > 0) {
      setSelectedPhotoIndex(0);
      setShowPhotoGallery(true);
    } else {
      // No photos, show on map instead
      setViewMode('map');
      // Wait for map to render then zoom to location
      setTimeout(() => {
        const js = `
          window.focusLocation(${spot.location.latitude}, ${spot.location.longitude}, 17);
          if (window.markers && window.markers['${spot.id}']) {
            window.markers['${spot.id}'].openPopup();
          }
          true; // Return value for iOS
        `;
        webViewRef.current?.injectJavaScript(js);
      }, 500);
    }
  };

  const handleViewPhotos = (spot: any) => {
    setSelectedSpot(spot);
    setSelectedPhotoIndex(0);
    setShowPhotoGallery(true);
  };

  const handleGetDirections = (spot: any) => {
    const { latitude, longitude } = spot.location;
    const label = encodeURIComponent(spot.name);
    
    // Create URLs for different map apps
    const appleMapsUrl = `maps:0,0?q=${label}@${latitude},${longitude}`;
    const googleMapsUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    
    // Determine which URL to use based on platform
    let url = webUrl; // fallback to web
    
    if (Platform.OS === 'ios') {
      url = appleMapsUrl;
    } else if (Platform.OS === 'android') {
      url = googleMapsUrl;
    }
    
    // Open the URL
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback to web URL if native app isn't available
        Linking.openURL(webUrl);
      }
    }).catch(err => {
      Alert.alert('Error', 'Unable to open maps');
      console.error('Error opening maps:', err);
    });
  };

  const handleEditSpot = (spot: any) => {
    router.push({
      pathname: '/edit-location',
      params: { spotId: spot.id }
    });
  };

  const renderListItem = ({ item }: any) => {
    const category = categories[item.category as CategoryType] || categories.other;
    
    return (
      <TouchableOpacity 
        style={styles.listItem}
        onPress={() => handleSpotPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.listItemContent}>
          <View style={styles.listItemHeader}>
            <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
              <Ionicons name={category.icon} size={20} color={category.color} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.listItemTitle}>{item.name}</Text>
              <Text style={[styles.categoryBadge, { color: category.color }]}>
                {category.label}
              </Text>
            </View>
          </View>
          
          {item.description && (
            <Text style={styles.listItemDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          
          {/* Photo Thumbnails */}
          {item.photos && item.photos.length > 0 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.photoThumbnails}
            >
              {item.photos.slice(0, 5).map((photo: string, index: number) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleViewPhotos(item)}
                >
                  <Image source={{ uri: photo }} style={styles.thumbnail} />
                  {index === 4 && item.photos.length > 5 && (
                    <View style={styles.morePhotosOverlay}>
                      <Text style={styles.morePhotosText}>+{item.photos.length - 5}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          
          <View style={styles.listItemFooter}>
            <Text style={styles.listItemCoords}>
              📍 {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
            </Text>
            <Text style={styles.listItemDate}>
              {new Date(item.timestamp).toLocaleDateString()}
            </Text>
          </View>
          
          {/* Photo count badge */}
          {item.photos && item.photos.length > 0 && (
            <View style={styles.photoBadge}>
              <Ionicons name="camera" size={12} color={theme.colors.white} />
              <Text style={styles.photoBadgeText}>{item.photos.length}</Text>
            </View>
          )}
        </View>
        
        {/* Updated Action Buttons with Share */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={() => handleShareSpot(item)}
          >
            <Ionicons name="share-social-outline" size={20} color={theme.colors.forest} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.directionsButton]}
            onPress={() => handleGetDirections(item)}
          >
            <Ionicons name="navigate-outline" size={20} color={theme.colors.navy} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEditSpot(item)}
          >
            <Ionicons name="create-outline" size={20} color={theme.colors.gray} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteSpot(item.id, item.name)}
          >
            <Ionicons name="trash-outline" size={20} color={theme.colors.burntOrange} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Generate Leaflet HTML
  const generateMapHTML = () => {
    if (filteredSpots.length === 0) return '';

    const lats = filteredSpots.map(spot => spot.location.latitude);
    const lngs = filteredSpots.map(spot => spot.location.longitude);
    
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    const markers = filteredSpots.map(spot => {
      const category = categories[spot.category as CategoryType] || categories.other;
      return `
        var marker${spot.id} = L.circleMarker([${spot.location.latitude}, ${spot.location.longitude}], {
          radius: 10,
          fillColor: '${category.mapColor}',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        })
        .addTo(map)
        .bindPopup('<b style="color: ${category.color}">${category.label}</b><br><b>${spot.name}</b><br>${spot.description || 'No description'}');
      `;
    }).join('\n');

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
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([${centerLat}, ${centerLng}], 13);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          ${markers}

          // Store markers globally for access
          window.markers = {
            ${filteredSpots.map(spot => `'${spot.id}': marker${spot.id}`).join(',\n')}
          };

          // Function to focus on a specific location
          window.focusLocation = function(lat, lng, zoom) {
            map.setView([lat, lng], zoom || 16);
          };

          // Fit bounds to show all markers initially
          var group = new L.featureGroup([
            ${filteredSpots.map(spot => 
              `L.circleMarker([${spot.location.latitude}, ${spot.location.longitude}])`
            ).join(',\n')}
          ]);
          if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds().pad(0.3));
          }
        </script>
      </body>
      </html>
    `;
  };

  if (savedSpots.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="location-outline" size={80} color="#ccc" />
        <Text style={styles.emptyText}>No saved locations yet</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/save-location')}
        >
          <Text style={styles.addButtonText}>Add Your First Location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedCategory === 'all' && styles.filterChipActive
          ]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text style={[
            styles.filterChipText,
            selectedCategory === 'all' && styles.filterChipTextActive
          ]}>
            All ({savedSpots.length})
          </Text>
        </TouchableOpacity>
        {categoryList.map((category) => {
          const count = savedSpots.filter(s => s.category === category.id).length;
          if (count === 0) return null;
          return (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.filterChip,
                selectedCategory === category.id && { backgroundColor: category.color }
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Ionicons 
                name={category.icon} 
                size={16} 
                color={selectedCategory === category.id ? 'white' : category.color} 
              />
              <Text style={[
                styles.filterChipText,
                selectedCategory === category.id && { color: 'white' }
              ]}>
                {category.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* View Mode Toggle with Search */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons 
            name="list" 
            size={20} 
            color={viewMode === 'list' ? 'white' : theme.colors.forest} 
          />
          <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
            List
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
          onPress={() => setViewMode('map')}
        >
          <Ionicons 
            name="map" 
            size={20} 
            color={viewMode === 'map' ? 'white' : theme.colors.forest} 
          />
          <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>
            Map
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.toggleButton, showSearchBar && styles.toggleButtonActive]}
          onPress={() => setShowSearchBar(!showSearchBar)}
        >
          <Ionicons 
            name="search" 
            size={20} 
            color={showSearchBar ? 'white' : theme.colors.forest} 
          />
          <Text style={[styles.toggleText, showSearchBar && styles.toggleTextActive]}>
            Search
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {showSearchBar && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={theme.colors.gray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search locations..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.colors.lightGray}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={theme.colors.gray} />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.sortContainer}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.sortChip, sortBy === 'date' && styles.sortChipActive]}
                onPress={() => setSortBy('date')}
              >
                <Text style={[styles.sortChipText, sortBy === 'date' && styles.sortChipTextActive]}>
                  Most Recent
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortChip, sortBy === 'name' && styles.sortChipActive]}
                onPress={() => setSortBy('name')}
              >
                <Text style={[styles.sortChipText, sortBy === 'name' && styles.sortChipTextActive]}>
                  Name
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortChip, sortBy === 'distance' && styles.sortChipActive]}
                onPress={() => setSortBy('distance')}
              >
                <Text style={[styles.sortChipText, sortBy === 'distance' && styles.sortChipTextActive]}>
                  Nearest
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Search Results Info */}
      {searchQuery && (
        <View style={styles.resultsInfo}>
          <Text style={styles.resultsText}>
            Found {filteredSpots.length} location{filteredSpots.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </Text>
        </View>
      )}

      {/* Content based on view mode */}
      {viewMode === 'list' ? (
        <FlatList
          data={filteredSpots}
          renderItem={renderListItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: generateMapHTML() }}
          scrollEnabled={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
        />
      )}

      {/* Floating Add Button */}
      <TouchableOpacity 
        style={styles.floatingAddButton}
        onPress={() => router.push('/save-location')}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      {/* Photo Gallery Modal */}
      <Modal
        visible={showPhotoGallery}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoGallery(false)}
      >
        <View style={styles.galleryContainer}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>{selectedSpot?.name}</Text>
            <TouchableOpacity 
              onPress={() => setShowPhotoGallery(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
          
          {selectedSpot?.photos && selectedSpot.photos.length > 0 && (
            <>
              <ScrollView 
                horizontal 
                pagingEnabled 
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
                  setSelectedPhotoIndex(newIndex);
                }}
              >
                {selectedSpot.photos.map((photo: string, index: number) => (
                  <View key={index} style={styles.photoSlide}>
                    <Image 
                      source={{ uri: photo }} 
                      style={styles.fullPhoto}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </ScrollView>
              
              {/* Photo counter */}
              <View style={styles.photoCounter}>
                <Text style={styles.photoCounterText}>
                  {selectedPhotoIndex + 1} / {selectedSpot.photos.length}
                </Text>
              </View>

              {/* Thumbnail strip */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.thumbnailStrip}
              >
                {selectedSpot.photos.map((photo: string, index: number) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedPhotoIndex(index)}
                  >
                    <Image 
                      source={{ uri: photo }} 
                      style={[
                        styles.galleryThumbnail,
                        selectedPhotoIndex === index && styles.selectedThumbnail
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.offWhite,
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: theme.colors.gray,
    marginTop: 20,
    marginBottom: 30,
  },
  addButton: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  viewToggle: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: theme.colors.offWhite,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.forest,
  },
  toggleText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.forest,
  },
  toggleTextActive: {
    color: 'white',
  },
  listContainer: {
    padding: 10,
  },
  listItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 10,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listItemContent: {
    flex: 1,
    position: 'relative',
  },
  listItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  categoryBadge: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  listItemDescription: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 5,
    marginBottom: 10,
  },
  photoThumbnails: {
    marginVertical: 10,
    flexDirection: 'row',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  morePhotosOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  morePhotosText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  photoBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: theme.colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoBadgeText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  listItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listItemCoords: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  listItemDate: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  actionButtons: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    padding: 10,
    marginVertical: 2,
  },
  shareButton: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    marginBottom: 5,
  },
  directionsButton: {
    // Style for directions button
  },
  editButton: {
    // Style for edit button
  },
  deleteButton: {
    // Style for delete button
  },
  map: {
    flex: 1,
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.forest,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  // Gallery styles
  galleryContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  galleryTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  photoSlide: {
    width: width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPhoto: {
    width: width,
    height: '70%',
  },
  photoCounter: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  photoCounterText: {
    color: 'white',
    fontSize: 14,
  },
  thumbnailStrip: {
    position: 'absolute',
    bottom: 20,
    paddingHorizontal: 10,
  },
  galleryThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginHorizontal: 5,
    opacity: 0.7,
  },
  selectedThumbnail: {
    opacity: 1,
    borderWidth: 2,
    borderColor: theme.colors.burntOrange,
  },
  categoryFilter: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 10,
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  filterChipActive: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  filterChipText: {
    fontSize: 13,
    color: theme.colors.gray,
    marginLeft: 4,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: 'white',
  },
  // Search styles
  searchContainer: {
    backgroundColor: theme.colors.white,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
    color: theme.colors.navy,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortLabel: {
    fontSize: 14,
    color: theme.colors.gray,
    marginRight: 10,
    fontWeight: '500',
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  sortChipActive: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  sortChipText: {
    fontSize: 13,
    color: theme.colors.gray,
    fontWeight: '500',
  },
  sortChipTextActive: {
    color: theme.colors.white,
  },
  resultsInfo: {
    padding: 10,
    backgroundColor: theme.colors.offWhite,
  },
  resultsText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: 'center',
  },
});