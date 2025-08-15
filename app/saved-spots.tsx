import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocation } from '../contexts/LocationContext';

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
  const { savedSpots, deleteSpot } = useLocation();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedSpot, setSelectedSpot] = useState<any>(null);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

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

  const handleSpotPress = (spot: any) => {
    setSelectedSpot(spot);
    if (spot.photos && spot.photos.length > 0) {
      setSelectedPhotoIndex(0);
      setShowPhotoGallery(true);
    }
  };

  const handleViewPhotos = (spot: any) => {
    setSelectedSpot(spot);
    setSelectedPhotoIndex(0);
    setShowPhotoGallery(true);
  };

  const renderListItem = ({ item }: any) => (
    <TouchableOpacity 
      style={styles.listItem}
      onPress={() => handleSpotPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.listItemContent}>
        <View style={styles.listItemHeader}>
          <Ionicons name="location" size={24} color={theme.colors.forest} />
          <Text style={styles.listItemTitle}>{item.name}</Text>
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
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteSpot(item.id, item.name)}
      >
        <Ionicons name="trash-outline" size={20} color={theme.colors.burntOrange} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Generate Leaflet HTML
  const generateMapHTML = () => {
    if (savedSpots.length === 0) return '';

    const lats = savedSpots.map(spot => spot.location.latitude);
    const lngs = savedSpots.map(spot => spot.location.longitude);
    
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    const markers = savedSpots.map(spot => `
      L.marker([${spot.location.latitude}, ${spot.location.longitude}])
        .addTo(map)
        .bindPopup('<b>${spot.name}</b><br>${spot.description || 'No description'}');
    `).join('\n');

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

          // Fit bounds to show all markers with more padding
          var group = new L.featureGroup([
            ${savedSpots.map(spot => 
              `L.marker([${spot.location.latitude}, ${spot.location.longitude}])`
            ).join(',\n')}
          ]);
          map.fitBounds(group.getBounds().pad(0.3));
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
      {/* View Mode Toggle */}
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
      </View>

      {/* Content based on view mode */}
      {viewMode === 'list' ? (
        <FlatList
          data={savedSpots}
          renderItem={renderListItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <WebView
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
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginLeft: 8,
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
  deleteButton: {
    padding: 10,
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
});