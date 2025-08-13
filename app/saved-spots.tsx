import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocation } from '../contexts/LocationContext';

export default function SavedSpotsScreen() {
  const { savedSpots, deleteSpot } = useLocation();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

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

  const renderListItem = ({ item }: any) => (
    <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
      <View style={styles.listItemContent}>
        <View style={styles.listItemHeader}>
          <Ionicons name="location" size={24} color="#007AFF" />
          <Text style={styles.listItemTitle}>{item.name}</Text>
        </View>
        {item.description && (
          <Text style={styles.listItemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.listItemFooter}>
          <Text style={styles.listItemCoords}>
            📍 {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
          </Text>
          <Text style={styles.listItemDate}>
            {new Date(item.timestamp).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteSpot(item.id, item.name)}
      >
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
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
            color={viewMode === 'list' ? 'white' : '#007AFF'} 
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
            color={viewMode === 'map' ? 'white' : '#007AFF'} 
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 20,
    marginBottom: 30,
  },
  addButton: {
    backgroundColor: '#007AFF',
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
    borderBottomColor: '#e0e0e0',
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
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
  },
  listItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  listItemDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    marginBottom: 10,
  },
  listItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listItemCoords: {
    fontSize: 12,
    color: '#999',
  },
  listItemDate: {
    fontSize: 12,
    color: '#999',
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
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});