import { Link } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Homepage() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Adventure Tracker</Text>
      <Text style={styles.subtitle}>Where will you explore today?</Text>
      
      <View style={styles.menuContainer}>
        <Link href="/track-ride" asChild>
          <TouchableOpacity style={styles.menuButton}>
            <Text style={styles.menuIcon}>🚴</Text>
            <Text style={styles.menuText}>Track Bike Ride</Text>
            <Text style={styles.menuSubtext}>Start recording your route</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/save-location" asChild>
          <TouchableOpacity style={styles.menuButton}>
            <Text style={styles.menuIcon}>📍</Text>
            <Text style={styles.menuText}>Save Location</Text>
            <Text style={styles.menuSubtext}>Mark this spot on your map</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/saved-spots" asChild>
          <TouchableOpacity style={styles.menuButton}>
            <Text style={styles.menuIcon}>🗺️</Text>
            <Text style={styles.menuText}>View Saved Spots</Text>
            <Text style={styles.menuSubtext}>See where you have been</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/past-rides" asChild>
          <TouchableOpacity style={styles.menuButton}>
            <Text style={styles.menuIcon}>📊</Text>
            <Text style={styles.menuText}>Past Rides</Text>
            <Text style={styles.menuSubtext}>Review your bike adventures</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/wishlist" asChild>
          <TouchableOpacity style={styles.menuButton}>
            <Text style={styles.menuIcon}>📝</Text>
            <Text style={styles.menuText}>Wishlist</Text>
            <Text style={styles.menuSubtext}>Places you want to explore</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#7f8c8d',
    marginBottom: 40,
  },
  menuContainer: {
    flex: 1,
    gap: 16,
  },
  menuButton: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  menuText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  menuSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
});