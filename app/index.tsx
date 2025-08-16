// app/index.tsx - Enhanced Dashboard Landing Page
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    PanResponder,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { categories } from '../constants/categories';
import { theme } from '../constants/theme';
import { useActivity } from '../contexts/ActivityContext';
import { useLocation } from '../contexts/LocationContext';

const { width, height } = Dimensions.get('window');
const BOTTOM_SHEET_MAX_HEIGHT = height * 0.5;
const BOTTOM_SHEET_MIN_HEIGHT = 80;

export default function DashboardScreen() {
  const router = useRouter();
  const { savedSpots, location, getLocation } = useLocation();
  const { activities } = useActivity();
  const webViewRef = useRef<WebView>(null);
  
  // State
  const [showSidebar, setShowSidebar] = useState(false);
  const [mapLayer, setMapLayer] = useState<'adventures' | 'terrain'>('adventures');
  
  // Bottom sheet animation
  const animatedValue = useRef(new Animated.Value(BOTTOM_SHEET_MIN_HEIGHT)).current;
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        animatedValue.extractOffset();
      },
      onPanResponderMove: (e, gesture) => {
        animatedValue.setValue(-gesture.dy);
      },
      onPanResponderRelease: (e, gesture) => {
        animatedValue.flattenOffset();
        
        if (gesture.dy < -50) {
          springAnimation(BOTTOM_SHEET_MAX_HEIGHT);
        } else if (gesture.dy > 50) {
          springAnimation(BOTTOM_SHEET_MIN_HEIGHT);
        } else {
          springAnimation(BOTTOM_SHEET_MIN_HEIGHT);
        }
      },
    })
  ).current;

  const springAnimation = (toValue: number) => {
    Animated.spring(animatedValue, {
      toValue,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };

  useEffect(() => {
    if (!location) {
      getLocation();
    }
  }, []);

  // Calculate statistics
  const totalDistance = activities.reduce((sum, act) => sum + act.distance, 0);
  const totalDuration = activities.reduce((sum, act) => sum + act.duration, 0);
  const thisWeekActivities = activities.filter(act => {
    const actDate = new Date(act.startTime);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return actDate > weekAgo;
  });
  const uniqueCategories = new Set(savedSpots.map(s => s.category)).size;
  
  // Calculate current streak
  const calculateStreak = () => {
    if (activities.length === 0) return 0;
    
    const sortedActivities = [...activities].sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (const activity of sortedActivities) {
      const actDate = new Date(activity.startTime);
      actDate.setHours(0, 0, 0, 0);
      
      const dayDiff = Math.floor((currentDate.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === streak) {
        streak++;
      } else if (dayDiff > streak) {
        break;
      }
    }
    
    return streak;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Generate map HTML with theme colors
  const generateMapHTML = () => {
    const centerLat = location?.latitude || 47.6062;
    const centerLng = location?.longitude || -122.3321;

    const spotMarkers = savedSpots.map(spot => {
      const category = categories[spot.category] || categories.other;
      return `
        L.circleMarker([${spot.location.latitude}, ${spot.location.longitude}], {
          radius: 8,
          fillColor: '${category.mapColor || category.color}',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        })
        .addTo(adventureLayer)
        .bindPopup(\`
          <div style="text-align: center;">
            <b style="color: ${category.color}">${spot.name}</b><br>
            <small>${category.label}</small>
          </div>
        \`);
      `;
    }).join('\n');

    const activityRoutes = activities
      .filter(act => act.route && act.route.length > 0)
      .map(act => {
        const coords = act.route.map(p => `[${p.latitude}, ${p.longitude}]`).join(',');
        return `
          L.polyline([${coords}], {
            color: '${theme.colors.forest}',
            weight: 3,
            opacity: 0.6
          }).addTo(adventureLayer);
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
          var map = L.map('map').setView([${centerLat}, ${centerLng}], 11);
          
          var streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
          });
          
          var terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap',
            maxZoom: 17
          });
          
          streetLayer.addTo(map);
          var adventureLayer = L.layerGroup().addTo(map);
          
          ${spotMarkers}
          ${activityRoutes}
          
          ${location ? `
            L.circleMarker([${location.latitude}, ${location.longitude}], {
              radius: 10,
              fillColor: '${theme.colors.burntOrange}',
              color: '#fff',
              weight: 3,
              opacity: 1,
              fillOpacity: 0.8
            })
            .addTo(map)
            .bindPopup('You are here');
          ` : ''}
          
          if (adventureLayer.getLayers().length > 0) {
            var group = new L.featureGroup(adventureLayer.getLayers());
            map.fitBounds(group.getBounds().pad(0.1));
          }
          
          window.switchToTerrain = function() {
            map.removeLayer(streetLayer);
            map.addLayer(terrainLayer);
          };
          
          window.switchToStreet = function() {
            map.removeLayer(terrainLayer);
            map.addLayer(streetLayer);
          };
        </script>
      </body>
      </html>
    `;
  };

  const sidebarItems = [
    { icon: 'map', label: 'Dashboard', route: '/', active: true },
    { icon: 'location', label: 'Saved Spots', route: '/saved-spots' },
    { icon: 'fitness', label: 'Activities', route: '/past-activities' },
    { icon: 'heart', label: 'Wishlist', route: '/wishlist' },
    { icon: 'add-circle', label: 'Add New', route: '/save-location' },
    { divider: true },
    { icon: 'stats-chart', label: 'Statistics', route: '/past-activities' },
    { icon: 'trophy', label: 'Achievements', route: '/past-activities' },
    { divider: true },
    { icon: 'settings', label: 'Settings', route: '/settings' },
    { icon: 'information-circle', label: 'About', route: '/' },
  ];

  const activityIcons = {
    bike: 'bicycle',
    run: 'walk',
    walk: 'footsteps',
    hike: 'trail-sign',
    paddleboard: 'boat',
    climb: 'trending-up',
    other: 'fitness',
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.white} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => setShowSidebar(true)} 
          style={styles.menuButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="menu" size={28} color={theme.colors.navy} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>ExplorAble</Text>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.layerButton}
            onPress={() => {
              const nextLayer = mapLayer === 'adventures' ? 'terrain' : 'adventures';
              setMapLayer(nextLayer);
              if (nextLayer === 'terrain') {
                webViewRef.current?.injectJavaScript('window.switchToTerrain();');
              } else {
                webViewRef.current?.injectJavaScript('window.switchToStreet();');
              }
            }}
          >
            <Ionicons name="layers" size={24} color={theme.colors.navy} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content ScrollView */}
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Stats Cards Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>This Week</Text>
          
          <View style={styles.statsGrid}>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => router.push('/past-activities')}
              activeOpacity={0.7}
            >
              <View style={[styles.statIconContainer, { backgroundColor: theme.colors.forest + '20' }]}>
                <Ionicons name="fitness" size={24} color={theme.colors.forest} />
              </View>
              <Text style={styles.statNumber}>{thisWeekActivities.length}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => router.push('/saved-spots')}
              activeOpacity={0.7}
            >
              <View style={[styles.statIconContainer, { backgroundColor: theme.colors.burntOrange + '20' }]}>
                <Ionicons name="location" size={24} color={theme.colors.burntOrange} />
              </View>
              <Text style={styles.statNumber}>{savedSpots.length}</Text>
              <Text style={styles.statLabel}>Places</Text>
            </TouchableOpacity>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: theme.colors.navy + '20' }]}>
                <Ionicons name="trending-up" size={24} color={theme.colors.navy} />
              </View>
              <Text style={styles.statNumber}>{(totalDistance / 1000).toFixed(0)}</Text>
              <Text style={styles.statLabel}>Kilometers</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: '#FFB800' + '20' }]}>
                <Ionicons name="flame" size={24} color="#FFB800" />
              </View>
              <Text style={styles.statNumber}>{calculateStreak()}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
          </View>

          {/* Quick Stats Bar */}
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{formatDuration(totalDuration)}</Text>
              <Text style={styles.quickStatLabel}>Total Time</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{uniqueCategories}</Text>
              <Text style={styles.quickStatLabel}>Categories</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>
                {activities.length > 0 
                  ? (totalDistance / activities.length / 1000).toFixed(1) + ' km'
                  : '0 km'}
              </Text>
              <Text style={styles.quickStatLabel}>Avg Distance</Text>
            </View>
          </View>
        </View>

        {/* Map Section */}
        <View style={styles.mapSection}>
          <Text style={styles.sectionTitle}>Your Adventure Map</Text>
          <View style={styles.mapContainer}>
            <WebView
              ref={webViewRef}
              style={styles.map}
              source={{ html: generateMapHTML() }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
            
            {/* Map Legend */}
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.burntOrange }]} />
                <Text style={styles.legendText}>You</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.forest }]} />
                <Text style={styles.legendText}>Routes</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.navy }]} />
                <Text style={styles.legendText}>Places</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Activity Section */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Adventures</Text>
          {activities.slice(0, 3).map((activity) => {
            const icon = (activityIcons as any)[activity.type] || 'fitness';
            return (
              <TouchableOpacity
                key={activity.id}
                style={styles.recentCard}
                onPress={() => router.push('/past-activities')}
                activeOpacity={0.7}
              >
                <View style={[styles.recentIcon, { backgroundColor: theme.colors.forest + '20' }]}>
                  <Ionicons name={icon} size={20} color={theme.colors.forest} />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName}>{activity.name}</Text>
                  <Text style={styles.recentMeta}>
                    {new Date(activity.startTime).toLocaleDateString()} • {(activity.distance / 1000).toFixed(1)} km • {formatDuration(activity.duration)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.lightGray} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={[styles.fab, styles.fabSecondary]}
          onPress={() => router.push('/track-activity')}
        >
          <Ionicons name="play" size={20} color={theme.colors.white} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.fab, styles.fabPrimary]}
          onPress={() => router.push('/save-location')}
        >
          <Ionicons name="add" size={26} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <Animated.View 
        style={[
          styles.bottomSheet,
          {
            height: animatedValue,
          }
        ]}
      >
        <View style={styles.bottomSheetHeader} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
          <Text style={styles.bottomSheetTitle}>Quick Actions</Text>
        </View>
        
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/save-location')}
          >
            <Ionicons name="location" size={24} color={theme.colors.forest} />
            <Text style={styles.quickActionText}>Save Spot</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/track-activity')}
          >
            <Ionicons name="fitness" size={24} color={theme.colors.navy} />
            <Text style={styles.quickActionText}>Track</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/saved-spots')}
          >
            <Ionicons name="map" size={24} color={theme.colors.burntOrange} />
            <Text style={styles.quickActionText}>Browse</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Sidebar Modal */}
      <Modal
        visible={showSidebar}
        animationType="none"
        transparent={true}
        onRequestClose={() => setShowSidebar(false)}
      >
        <View style={styles.sidebarContainer}>
          <TouchableOpacity 
            style={styles.sidebarOverlay}
            activeOpacity={1}
            onPress={() => setShowSidebar(false)}
          />
          
          <Animated.View style={[styles.sidebar, { transform: [{ translateX: 0 }] }]}>
            <View style={styles.profileSection}>
              <View style={styles.profileAvatar}>
                <Ionicons name="person-circle" size={60} color={theme.colors.forest} />
              </View>
              <Text style={styles.profileName}>Explorer</Text>
              <Text style={styles.profileStats}>
                {savedSpots.length} places • {activities.length} activities
              </Text>
            </View>

            <ScrollView style={styles.sidebarMenu}>
              {sidebarItems.map((item, index) => {
                if (item.divider) {
                  return <View key={index} style={styles.sidebarDivider} />;
                }
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.sidebarItem, item.active && styles.sidebarItemActive]}
                    onPress={() => {
                      setShowSidebar(false);
                      if (item.route) {
                        router.push(item.route as any);
                      }
                    }}
                  >
                    <Ionicons 
                      name={item.icon as any} 
                      size={24} 
                      color={item.active ? theme.colors.forest : theme.colors.gray}
                    />
                    <Text style={[
                      styles.sidebarItemText,
                      item.active && styles.sidebarItemTextActive
                    ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.white,
    paddingVertical: 15,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 10,
  },
  menuButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.navy,
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  layerButton: {
    padding: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  statsSection: {
    backgroundColor: theme.colors.white,
    paddingVertical: 20,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statCard: {
    width: '48%',
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.navy,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 4,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 15,
  },
  quickStatItem: {
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  quickStatLabel: {
    fontSize: 11,
    color: theme.colors.gray,
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: theme.colors.borderGray,
  },
  mapSection: {
    backgroundColor: theme.colors.white,
    padding: 15,
    marginBottom: 10,
  },
  mapContainer: {
    height: height * 0.4,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapLegend: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    color: theme.colors.gray,
  },
  recentSection: {
    backgroundColor: theme.colors.white,
    padding: 15,
    marginBottom: 100,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.navy,
  },
  recentMeta: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabPrimary: {
    backgroundColor: theme.colors.forest,
  },
  fabSecondary: {
    backgroundColor: theme.colors.navy,
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  bottomSheetHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.borderGray,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 4,
  },
  sidebarContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    width: width * 0.75,
    backgroundColor: theme.colors.white,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  profileSection: {
    backgroundColor: theme.colors.offWhite,
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  profileAvatar: {
    marginBottom: 10,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  profileStats: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 5,
  },
  sidebarMenu: {
    flex: 1,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  sidebarItemActive: {
    backgroundColor: theme.colors.offWhite,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.forest,
  },
  sidebarItemText: {
    fontSize: 16,
    color: theme.colors.gray,
    marginLeft: 15,
  },
  sidebarItemTextActive: {
    color: theme.colors.forest,
    fontWeight: '600',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: theme.colors.borderGray,
    marginVertical: 10,
  },
});