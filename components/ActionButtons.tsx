import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { LocationObject } from '../types';

interface ActionButtonsProps {
  location: LocationObject | null;
  savedSpotsCount: number;
  onGetLocation: () => void;
  onSaveLocation: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  location,
  savedSpotsCount,
  onGetLocation,
  onSaveLocation
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Adventure Tracker</Text>
      <View style={styles.buttonRow}>
        <Button title="Get Location" onPress={onGetLocation} />
        <Button 
          title="Save Spot" 
          onPress={onSaveLocation} 
          disabled={!location}
          color="#28a745"
        />
      </View>
      <Text style={styles.spotCount}>Saved spots: {savedSpotsCount}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  spotCount: {
    textAlign: 'center',
    marginTop: 10,
    color: '#666',
  },
});

export default ActionButtons;