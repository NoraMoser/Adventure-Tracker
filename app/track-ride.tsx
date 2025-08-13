import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function TrackRideScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Track Bike Ride' }} />
      <View style={styles.container}>
        <Text style={styles.title}>🚴 Track Bike Ride</Text>
        <Text style={styles.subtitle}>Coming soon!</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});