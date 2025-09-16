// components/UpdateModal.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { theme } from '../constants/theme';
import { UpdateService } from '../services/updateService';

interface UpdateModalProps {
  visible: boolean;
  version: string;
  features: string[];
  isRequired: boolean;
  onDismiss?: () => void;
}

export function UpdateModal({ 
  visible, 
  version, 
  features, 
  isRequired,
  onDismiss 
}: UpdateModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={isRequired ? undefined : onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header with icon */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="rocket" size={40} color={theme.colors.forest} />
            </View>
            <Text style={styles.title}>
              {isRequired ? 'Update Required' : 'Update Available!'}
            </Text>
            <Text style={styles.version}>Version {version}</Text>
          </View>

          {/* What's New Section */}
          <ScrollView style={styles.featuresContainer}>
            <Text style={styles.whatsNewTitle}>What is New:</Text>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons 
                  name="checkmark-circle" 
                  size={20} 
                  color={theme.colors.forest} 
                />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {!isRequired && (
              <TouchableOpacity 
                style={styles.laterButton} 
                onPress={onDismiss}
              >
                <Text style={styles.laterText}>Maybe Later</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[
                styles.updateButton,
                isRequired && styles.updateButtonFull
              ]} 
              onPress={() => {
                UpdateService.openStore();
                if (!isRequired) onDismiss?.();
              }}
            >
              <Ionicons name="download" size={20} color="white" />
              <Text style={styles.updateText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.offWhite,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.navy,
    marginBottom: 5,
  },
  version: {
    fontSize: 16,
    color: theme.colors.gray,
  },
  featuresContainer: {
    padding: 20,
    flexGrow: 0,
    maxHeight: 200,
  },
  whatsNewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 15,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: theme.colors.gray,
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  laterButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: theme.colors.offWhite,
  },
  laterText: {
    fontSize: 16,
    color: theme.colors.gray,
    fontWeight: '600',
  },
  updateButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: theme.colors.forest,
    gap: 8,
  },
  updateButtonFull: {
    flex: 2,
  },
  updateText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});
