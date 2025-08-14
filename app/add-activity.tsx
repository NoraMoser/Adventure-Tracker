import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { theme } from '../constants/theme';
import { ActivityType, useActivity } from '../contexts/ActivityContext';

const activityTypes: { type: ActivityType; label: string; icon: string }[] = [
  { type: 'bike', label: 'Bike', icon: 'bicycle' },
  { type: 'run', label: 'Run', icon: 'walk' },
  { type: 'walk', label: 'Walk', icon: 'footsteps' },
  { type: 'hike', label: 'Hike', icon: 'trail-sign' },
  { type: 'paddleboard', label: 'Paddle', icon: 'boat' },
  { type: 'climb', label: 'Climb', icon: 'trending-up' },
  { type: 'other', label: 'Other', icon: 'fitness' },
];

export default function AddActivityScreen() {
  const { addManualActivity } = useActivity();
  const router = useRouter();

  const [activityType, setActivityType] = useState<ActivityType>('bike');
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration] = useState({ hours: '0', minutes: '0' });
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const [notes, setNotes] = useState('');

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter an activity name');
      return;
    }

    const durationInSeconds = 
      (parseInt(duration.hours) || 0) * 3600 + 
      (parseInt(duration.minutes) || 0) * 60;

    if (durationInSeconds === 0) {
      Alert.alert('Error', 'Please enter the activity duration');
      return;
    }

    // Convert distance to meters
    let distanceInMeters = 0;
    if (distance) {
      const distanceValue = parseFloat(distance);
      distanceInMeters = distanceUnit === 'km' 
        ? distanceValue * 1000 
        : distanceValue * 1609.34; // miles to meters
    }

    // Calculate average speed
    const avgSpeed = distanceInMeters > 0 
      ? (distanceInMeters / 1000) / (durationInSeconds / 3600) 
      : 0;

    // Create activity object
    const activity = {
      type: activityType,
      name: name.trim(),
      startTime: date,
      endTime: new Date(date.getTime() + durationInSeconds * 1000),
      duration: durationInSeconds,
      distance: distanceInMeters,
      route: [], // No GPS route for manual entries
      averageSpeed: avgSpeed,
      maxSpeed: avgSpeed, // Use avg as max for manual entries
      notes: notes.trim(),
      isManualEntry: true,
    };

    try {
      await addManualActivity(activity);
      Alert.alert(
        'Success',
        'Activity added successfully!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save activity');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Past Activity</Text>
        <Text style={styles.subtitle}>Record an activity you forgot to track</Text>
      </View>

      {/* Activity Type Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.activityTypes}>
            {activityTypes.map((activity) => (
              <TouchableOpacity
                key={activity.type}
                style={[
                  styles.activityCard,
                  activityType === activity.type && styles.activityCardSelected,
                ]}
                onPress={() => setActivityType(activity.type)}
              >
                <Ionicons
                  name={activity.icon as any}
                  size={24}
                  color={activityType === activity.type ? theme.colors.white : theme.colors.navy}
                />
                <Text
                  style={[
                    styles.activityLabel,
                    activityType === activity.type && styles.activityLabelSelected,
                  ]}
                >
                  {activity.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Activity Name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Morning bike ride, Trail run, etc."
          placeholderTextColor={theme.colors.lightGray}
        />
      </View>

      {/* Date & Time */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Date & Time</Text>
        <View style={styles.dateTimeContainer}>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={theme.colors.navy} />
            <Text style={styles.dateTimeText}>{formatDate(date)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Ionicons name="time-outline" size={20} color={theme.colors.navy} />
            <Text style={styles.dateTimeText}>{formatTime(date)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDate(selectedDate);
          }}
          maximumDate={new Date()}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={date}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowTimePicker(false);
            if (selectedDate) setDate(selectedDate);
          }}
        />
      )}

      {/* Duration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Duration *</Text>
        <View style={styles.durationContainer}>
          <View style={styles.durationInput}>
            <TextInput
              style={styles.numberInput}
              value={duration.hours}
              onChangeText={(text) => setDuration({ ...duration, hours: text })}
              keyboardType="numeric"
              placeholder="0"
              maxLength={2}
            />
            <Text style={styles.durationLabel}>hours</Text>
          </View>
          <View style={styles.durationInput}>
            <TextInput
              style={styles.numberInput}
              value={duration.minutes}
              onChangeText={(text) => setDuration({ ...duration, minutes: text })}
              keyboardType="numeric"
              placeholder="0"
              maxLength={2}
            />
            <Text style={styles.durationLabel}>minutes</Text>
          </View>
        </View>
      </View>

      {/* Distance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Distance (Optional)</Text>
        <View style={styles.distanceContainer}>
          <TextInput
            style={[styles.input, styles.distanceInput]}
            value={distance}
            onChangeText={setDistance}
            keyboardType="decimal-pad"
            placeholder="0.0"
          />
          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[styles.unitButton, distanceUnit === 'km' && styles.unitButtonActive]}
              onPress={() => setDistanceUnit('km')}
            >
              <Text style={[styles.unitText, distanceUnit === 'km' && styles.unitTextActive]}>
                km
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unitButton, distanceUnit === 'mi' && styles.unitButtonActive]}
              onPress={() => setDistanceUnit('mi')}
            >
              <Text style={[styles.unitText, distanceUnit === 'mi' && styles.unitTextActive]}>
                mi
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes (Optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="How was it? Any details to remember..."
          placeholderTextColor={theme.colors.lightGray}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Ionicons name="save-outline" size={20} color={theme.colors.white} />
        <Text style={styles.saveButtonText}>Save Activity</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  header: {
    padding: 20,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.navy,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 5,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 12,
  },
  activityTypes: {
    flexDirection: 'row',
  },
  activityCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 2,
    borderColor: theme.colors.borderGray,
  },
  activityCardSelected: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  activityLabel: {
    marginTop: 6,
    fontSize: 12,
    color: theme.colors.navy,
    fontWeight: '500',
  },
  activityLabelSelected: {
    color: theme.colors.white,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.navy,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    marginHorizontal: 5,
  },
  dateTimeText: {
    fontSize: 14,
    color: theme.colors.navy,
    marginLeft: 8,
  },
  durationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  durationInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    paddingHorizontal: 12,
    marginHorizontal: 5,
  },
  numberInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.navy,
    padding: 12,
  },
  durationLabel: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceInput: {
    flex: 1,
    marginRight: 10,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  unitButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  unitButtonActive: {
    backgroundColor: theme.colors.forest,
    borderRadius: 6,
  },
  unitText: {
    fontSize: 14,
    color: theme.colors.gray,
    fontWeight: '500',
  },
  unitTextActive: {
    color: theme.colors.white,
  },
  notesInput: {
    height: 100,
  },
  saveButton: {
    backgroundColor: theme.colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  cancelButtonText: {
    color: theme.colors.burntOrange,
    fontSize: 16,
  },
});