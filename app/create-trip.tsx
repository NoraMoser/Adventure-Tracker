import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useTrips } from '../contexts/TripContext';

export default function CreateTripScreen() {
  const router = useRouter();
  const { createTrip, currentUserId } = useTrips();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a trip name');
      return;
    }
    
    try {
      await createTrip({
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        created_by: currentUserId || '',
        tagged_friends: [],
        auto_generated: false,
      });
      
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to create trip');
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={theme.colors.gray} />
        </TouchableOpacity>
        <Text style={styles.title}>Create Trip</Text>
        <TouchableOpacity onPress={handleCreate}>
          <Text style={styles.createText}>Create</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder="Trip Name"
          value={name}
          onChangeText={setName}
          placeholderTextColor={theme.colors.lightGray}
        />
        
        <TouchableOpacity 
          style={styles.dateButton}
          onPress={() => setShowStartPicker(true)}
        >
          <Text>Start: {startDate.toLocaleDateString()}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.dateButton}
          onPress={() => setShowEndPicker(true)}
        >
          <Text>End: {endDate.toLocaleDateString()}</Text>
        </TouchableOpacity>
      </View>
      
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          onChange={(e, date) => {
            setShowStartPicker(false);
            if (date) setStartDate(date);
          }}
        />
      )}
      
      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          minimumDate={startDate}
          onChange={(e, date) => {
            setShowEndPicker(false);
            if (date) setEndDate(date);
          }}
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  createText: {
    color: theme.colors.forest,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  dateButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
});