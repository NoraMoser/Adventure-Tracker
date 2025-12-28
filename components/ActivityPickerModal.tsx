import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { theme } from '../constants/theme';
import { ActivityType } from '../contexts/ActivityContext';

interface ActivityPickerModalProps {
  visible: boolean;
  currentValue: ActivityType;
  onClose: () => void;
  onSelect: (activity: ActivityType) => void;
}

const activities: { type: ActivityType; label: string; icon: string }[] = [
  { type: 'bike', label: 'Bike', icon: 'bicycle' },
  { type: 'run', label: 'Run', icon: 'walk' },
  { type: 'walk', label: 'Walk', icon: 'footsteps' },
  { type: 'hike', label: 'Hike', icon: 'trail-sign' },
  { type: 'paddleboard', label: 'Paddleboard', icon: 'boat' },
  { type: 'climb', label: 'Climb', icon: 'trending-up' },
  { type: 'other', label: 'Other', icon: 'fitness' },
];

export const ActivityPickerModal: React.FC<ActivityPickerModalProps> = ({
  visible,
  currentValue,
  onClose,
  onSelect,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Default Activity</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <View style={styles.activitiesList}>
            {activities.map((activity) => (
              <TouchableOpacity
                key={activity.type}
                style={[
                  styles.activityOption,
                  currentValue === activity.type && styles.activityOptionSelected,
                ]}
                onPress={() => {
                  onSelect(activity.type);
                  onClose();
                }}
              >
                <View style={styles.activityLeft}>
                  <View style={[
                    styles.iconContainer,
                    currentValue === activity.type && styles.iconContainerSelected,
                  ]}>
                    <Ionicons
                      name={activity.icon as any}
                      size={24}
                      color={currentValue === activity.type ? theme.colors.white : theme.colors.forest}
                    />
                  </View>
                  <Text style={[
                    styles.activityLabel,
                    currentValue === activity.type && styles.activityLabelSelected,
                  ]}>
                    {activity.label}
                  </Text>
                </View>
                {currentValue === activity.type && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.forest} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  activitiesList: {
    paddingVertical: 10,
  },
  activityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  activityOptionSelected: {
    backgroundColor: theme.colors.forest + '10',
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.forest + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  iconContainerSelected: {
    backgroundColor: theme.colors.forest,
  },
  activityLabel: {
    fontSize: 16,
    color: theme.colors.navy,
  },
  activityLabelSelected: {
    fontWeight: '600',
    color: theme.colors.forest,
  },
  cancelButton: {
    margin: 20,
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: theme.colors.gray,
  },
});

export default ActivityPickerModal;