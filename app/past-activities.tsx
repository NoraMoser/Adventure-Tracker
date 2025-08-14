import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ActivityType, useActivity } from '../contexts/ActivityContext';

const activityIcons: Record<ActivityType, string> = {
  bike: 'bicycle',
  run: 'walk',
  walk: 'footsteps',
  hike: 'trail-sign',
  paddleboard: 'boat',
  climb: 'trending-up',
  other: 'fitness',
};

export default function PastActivitiesScreen() {
  const { activities, deleteActivity } = useActivity();
  const router = useRouter();
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [showMap, setShowMap] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<ActivityType | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'distance' | 'duration'>('recent');

  // Filter and sort activities
  const filteredActivities = useMemo(() => {
    let filtered = activities;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(activity => 
        activity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (activity.notes && activity.notes.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by activity type
    if (selectedType !== 'all') {
      filtered = filtered.filter(activity => activity.type === selectedType);
    }

    // Sort activities
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          return b.distance - a.distance;
        case 'duration':
          return b.duration - a.duration;
        case 'recent':
        default:
          return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      }
    });

    return sorted;
  }, [activities, searchQuery, selectedType, sortBy]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)} m`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleDeleteActivity = (id: string, name: string) => {
    Alert.alert(
      'Delete Activity',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteActivity(id),
        },
      ]
    );
  };

  const handleViewMap = (activity: any) => {
    setSelectedActivity(activity);
    setShowMap(true);
  };

  // Generate Leaflet HTML for a specific activity route
  const generateActivityMapHTML = () => {
    if (!selectedActivity || !selectedActivity.route || selectedActivity.route.length === 0) {
      return '<html><body><p>No route data available</p></body></html>';
    }

    const route = selectedActivity.route;
    const routeCoords = route.map((point: any) => 
      `[${point.latitude}, ${point.longitude}]`
    ).join(',');

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
          .info-box {
            position: absolute;
            top: 10px;
            left: 10px;
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 1000;
          }
        </style>
      </head>
      <body>
        <div class="info-box">
          <strong>${selectedActivity.name}</strong><br>
          Distance: ${formatDistance(selectedActivity.distance)}<br>
          Duration: ${formatDuration(selectedActivity.duration)}
        </div>
        <div id="map"></div>
        <script>
          var map = L.map('map');
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          // Draw the route
          var routeCoords = [${routeCoords}];
          if (routeCoords.length > 0) {
            var polyline = L.polyline(routeCoords, {
              color: '#007AFF',
              weight: 4,
              opacity: 0.8
            }).addTo(map);

            // Add start marker (green)
            var startIcon = L.divIcon({
              html: '<div style="background-color: #34C759; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [24, 24],
              className: 'custom-div-icon'
            });
            L.marker(routeCoords[0], { icon: startIcon })
              .addTo(map)
              .bindPopup('Start');

            // Add end marker (red)
            var endIcon = L.divIcon({
              html: '<div style="background-color: #FF3B30; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [24, 24],
              className: 'custom-div-icon'
            });
            L.marker(routeCoords[routeCoords.length - 1], { icon: endIcon })
              .addTo(map)
              .bindPopup('Finish');

            // Fit map to route
            map.fitBounds(polyline.getBounds().pad(0.1));
          }
        </script>
      </body>
      </html>
    `;
  };

  const renderActivityItem = ({ item }: { item: any }) => {
    const iconName = (activityIcons as any)[item.type] || 'fitness';
    
    return (
      <TouchableOpacity 
        style={styles.activityCard}
        onPress={() => handleViewMap(item)}
        activeOpacity={0.7}
      >
        <View style={styles.activityHeader}>
          <View style={styles.activityIcon}>
            <Ionicons name={iconName as any} size={24} color="#007AFF" />
          </View>
          <View style={styles.activityInfo}>
            <Text style={styles.activityName}>{item.name}</Text>
            <Text style={styles.activityDate}>
              {formatDate(item.startTime)} at {formatTime(item.startTime)}
            </Text>
          </View>
          {item.isManualEntry && (
            <View style={styles.manualBadge}>
              <Text style={styles.manualBadgeText}>Manual</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{formatDistance(item.distance)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{formatDuration(item.duration)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Avg Speed</Text>
            <Text style={styles.statValue}>{item.averageSpeed.toFixed(1)} km/h</Text>
          </View>
        </View>

        {item.notes && (
          <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
        )}

        <View style={styles.activityActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleViewMap(item)}
          >
            <Ionicons name="map-outline" size={20} color="#007AFF" />
            <Text style={styles.actionButtonText}>View Route</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteActivity(item.id, item.name)}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (showMap && selectedActivity) {
    return (
      <View style={styles.container}>
        <View style={styles.mapHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowMap(false)}
          >
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
            <Text style={styles.backButtonText}>Back to List</Text>
          </TouchableOpacity>
        </View>
        <WebView
          style={styles.map}
          source={{ html: generateActivityMapHTML() }}
          scrollEnabled={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    );
  }

  // Calculate totals based on filtered activities
  const totalDistance = filteredActivities.reduce((sum, act) => sum + act.distance, 0);
  const totalDuration = filteredActivities.reduce((sum, act) => sum + act.duration, 0);
  const totalActivities = filteredActivities.length;

  if (activities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="fitness-outline" size={80} color="#ccc" />
        <Text style={styles.emptyText}>No activities yet</Text>
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => router.push('/track-activity')}
        >
          <Text style={styles.startButtonText}>Start Your First Activity</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search activities..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons 
            name="filter" 
            size={20} 
            color={selectedType !== 'all' || sortBy !== 'recent' ? '#007AFF' : '#666'} 
          />
        </TouchableOpacity>
      </View>

      {/* Filter Options */}
      {showFilters && (
        <View style={styles.filterContainer}>
          <Text style={styles.filterTitle}>Activity Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, selectedType === 'all' && styles.filterChipActive]}
              onPress={() => setSelectedType('all')}
            >
              <Text style={[styles.filterChipText, selectedType === 'all' && styles.filterChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {Object.entries(activityIcons).map(([type, icon]) => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, selectedType === type && styles.filterChipActive]}
                onPress={() => setSelectedType(type as ActivityType)}
              >
                <Ionicons 
                  name={icon as any} 
                  size={16} 
                  color={selectedType === type ? 'white' : '#666'} 
                />
                <Text style={[styles.filterChipText, selectedType === type && styles.filterChipTextActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterTitle}>Sort By</Text>
          <View style={styles.sortOptions}>
            <TouchableOpacity
              style={[styles.sortChip, sortBy === 'recent' && styles.sortChipActive]}
              onPress={() => setSortBy('recent')}
            >
              <Text style={[styles.sortChipText, sortBy === 'recent' && styles.sortChipTextActive]}>
                Most Recent
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortChip, sortBy === 'distance' && styles.sortChipActive]}
              onPress={() => setSortBy('distance')}
            >
              <Text style={[styles.sortChipText, sortBy === 'distance' && styles.sortChipTextActive]}>
                Distance
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortChip, sortBy === 'duration' && styles.sortChipActive]}
              onPress={() => setSortBy('duration')}
            >
              <Text style={[styles.sortChipText, sortBy === 'duration' && styles.sortChipTextActive]}>
                Duration
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Summary Stats */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalActivities}</Text>
          <Text style={styles.summaryLabel}>
            {selectedType === 'all' ? 'Activities' : selectedType}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatDistance(totalDistance)}</Text>
          <Text style={styles.summaryLabel}>Total Distance</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatDuration(totalDuration)}</Text>
          <Text style={styles.summaryLabel}>Total Time</Text>
        </View>
      </View>

      {/* Activities List */}
      {filteredActivities.length > 0 ? (
        <FlatList
          data={filteredActivities}
          renderItem={renderActivityItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={60} color="#ccc" />
          <Text style={styles.noResultsText}>No activities found</Text>
          {searchQuery !== '' && (
            <Text style={styles.noResultsSubtext}>Try adjusting your search</Text>
          )}
        </View>
      )}

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.floatingAddButton}
        onPress={() => router.push('/track-activity')}
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
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 20,
    marginBottom: 30,
  },
  startButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  listContainer: {
    padding: 15,
  },
  activityCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  activityDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  manualBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  manualBadgeText: {
    fontSize: 11,
    color: '#FF9800',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  notes: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    fontStyle: 'italic',
  },
  activityActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
  },
  mapHeader: {
    backgroundColor: 'white',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    marginLeft: 8,
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
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#333',
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    backgroundColor: 'white',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 15,
    marginBottom: 10,
  },
  filterScroll: {
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  filterChipTextActive: {
    color: 'white',
  },
  sortOptions: {
    flexDirection: 'row',
    paddingHorizontal: 15,
  },
  sortChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 8,
  },
  sortChipActive: {
    backgroundColor: '#007AFF',
  },
  sortChipText: {
    fontSize: 14,
    color: '#666',
  },
  sortChipTextActive: {
    color: 'white',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noResultsText: {
    fontSize: 18,
    color: '#999',
    marginTop: 20,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});