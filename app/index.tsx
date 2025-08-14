import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { theme } from '../constants/theme';
import { useActivity } from '../contexts/ActivityContext';
import { useLocation } from '../contexts/LocationContext';

export default function HomeScreen() {
  const router = useRouter();
  const { savedSpots } = useLocation();
  const { activities } = useActivity();

  const menuItems = [
    {
      title: 'Track Activity',
      subtitle: 'Record your adventure',
      icon: 'compass-outline',
      route: '/track-activity',
      color: theme.colors.burntOrange,
    },
    {
      title: 'Save Location',
      subtitle: 'Mark this spot',
      icon: 'location-outline',
      route: '/save-location',
      color: theme.colors.forest,
    },
    {
      title: 'Past Activities',
      subtitle: `${activities.length} activities`,
      icon: 'map-outline',
      route: '/past-activities',
      color: theme.colors.navy,
    },
    {
      title: 'Saved Spots',
      subtitle: `${savedSpots.length} locations`,
      icon: 'bookmark-outline',
      route: '/saved-spots',
      color: theme.colors.forest,
    },
  ];

  const stats = [
    {
      label: 'Total Activities',
      value: activities.length.toString(),
      icon: 'fitness-outline',
    },
    {
      label: 'Saved Spots',
      value: savedSpots.length.toString(),
      icon: 'pin-outline',
    },
    {
      label: 'Total Distance',
      value: `${(activities.reduce((sum, act) => sum + act.distance, 0) / 1000).toFixed(1)} km`,
      icon: 'speedometer-outline',
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Section */}
      <View style={styles.hero}>
        <Text style={styles.appName}>ExplorAble</Text>
        <Text style={styles.tagline}>Track. Save. Explore.</Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statCard}>
            <Ionicons name={stat.icon as any} size={24} color={theme.colors.burntOrange} />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Menu Grid */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.menuCard, { borderLeftColor: item.color }]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
              <Ionicons name={item.icon as any} size={28} color={item.color} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.lightGray} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Activity Preview */}
      {activities.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Adventure</Text>
          <TouchableOpacity
            style={styles.recentCard}
            onPress={() => router.push('/past-activities')}
          >
            <View style={styles.recentHeader}>
              <Ionicons 
                name={(activities[0].type === 'bike' ? 'bicycle' : 'walk') as any} 
                size={20} 
                color={theme.colors.forest} 
              />
              <Text style={styles.recentName}>{activities[0].name}</Text>
            </View>
            <Text style={styles.recentDate}>
              {new Date(activities[0].startTime).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
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
  hero: {
    backgroundColor: theme.colors.navy,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: theme.colors.offWhite,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: theme.colors.offWhite,
    opacity: 0.9,
    marginTop: 8,
    letterSpacing: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    marginTop: -20,
  },
  statCard: {
    backgroundColor: theme.colors.white,
    padding: 15,
    borderRadius: theme.borderRadius.large,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.navy,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.gray,
    marginTop: 4,
  },
  menuContainer: {
    padding: 20,
  },
  menuCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.large,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  menuSubtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
  },
  recentSection: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 15,
  },
  recentCard: {
    backgroundColor: theme.colors.white,
    padding: 15,
    borderRadius: theme.borderRadius.large,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.forest,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.navy,
    marginLeft: 10,
  },
  recentDate: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 5,
  },
});