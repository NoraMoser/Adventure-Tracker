// components/ExportModal.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useActivity } from '../contexts/ActivityContext';
import { useLocation } from '../contexts/LocationContext';
import { useSettings } from '../contexts/SettingsContext';
import { useWishlist } from '../contexts/WishlistContext';
import { ExportService } from '../services/exportService';

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
}

type ExportFormat = 'backup' | 'gpx' | 'csv' | 'email';

export const ExportModal: React.FC<ExportModalProps> = ({ visible, onClose }) => {
  const { savedSpots } = useLocation();
  const { activities } = useActivity();
  const { wishlistItems } = useWishlist();
  const { settings } = useSettings();
  
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('backup');
  const [emailAddress, setEmailAddress] = useState('');
  const [exportStatus, setExportStatus] = useState<string>('');

  const formatOptions = [
    {
      id: 'backup' as ExportFormat,
      title: 'Full Backup',
      subtitle: 'Complete app data in JSON format',
      icon: 'save',
      color: theme.colors.forest,
    },
    {
      id: 'gpx' as ExportFormat,
      title: 'GPX Tracks',
      subtitle: 'Activity routes for GPS apps',
      icon: 'navigate',
      color: theme.colors.navy,
    },
    {
      id: 'csv' as ExportFormat,
      title: 'CSV Spreadsheet',
      subtitle: 'Locations & activities for Excel',
      icon: 'grid',
      color: theme.colors.burntOrange,
    },
    {
      id: 'email' as ExportFormat,
      title: 'Email Backup',
      subtitle: 'Send backup to your email',
      icon: 'mail',
      color: '#9C27B0',
    },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus('Preparing export...');

    try {
      switch (selectedFormat) {
        case 'backup':
          await exportFullBackup();
          break;
        case 'gpx':
          await exportGPX();
          break;
        case 'csv':
          await exportCSV();
          break;
        case 'email':
          await emailBackup();
          break;
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'There was an error exporting your data. Please try again.');
    } finally {
      setIsExporting(false);
      setExportStatus('');
    }
  };

  const exportFullBackup = async () => {
    setExportStatus('Creating backup file...');
    const { uri, filename } = await ExportService.createBackup(
      settings,
      savedSpots,
      activities,
      wishlistItems
    );

    setExportStatus('Preparing to share...');
    await ExportService.shareFile(uri, 'application/json');
    
    Alert.alert(
      'Backup Complete',
      `Your backup "${filename}" is ready to save or share.`,
      [{ text: 'OK', onPress: onClose }]
    );
  };

  const exportGPX = async () => {
    if (activities.length === 0) {
      Alert.alert('No Activities', 'You don\'t have any activities to export yet.');
      return;
    }

    const trackedActivities = activities.filter(a => a.route && a.route.length > 0);
    if (trackedActivities.length === 0) {
      Alert.alert('No GPS Tracks', 'None of your activities have GPS tracking data.');
      return;
    }

    setExportStatus(`Exporting ${trackedActivities.length} activities with GPS tracks...`);
    const { uri, filename } = await ExportService.exportActivitiesAsGPX(trackedActivities);

    setExportStatus('Preparing to share...');
    await ExportService.shareFile(uri, 'application/gpx+xml');
    
    Alert.alert(
      'GPX Export Complete',
      `Exported ${trackedActivities.length} activities to "${filename}".\n\nYou can import this file into Strava, Garmin Connect, or any GPS app!`,
      [{ text: 'OK', onPress: onClose }]
    );
  };

  const exportCSV = async () => {
    setExportStatus('Creating CSV files...');
    const { spotsUri, activitiesUri } = await ExportService.exportAsCSV(savedSpots, activities);

    setExportStatus('Preparing to share...');
    
    // Share spots first
    await ExportService.shareFile(spotsUri, 'text/csv');
    
    // Then activities
    setTimeout(async () => {
      await ExportService.shareFile(activitiesUri, 'text/csv');
    }, 1000);
    
    Alert.alert(
      'CSV Export Complete',
      `Created 2 CSV files:\n• ${savedSpots.length} saved locations\n• ${activities.length} activities\n\nPerfect for Excel or Google Sheets!`,
      [{ text: 'OK', onPress: onClose }]
    );
  };

  const emailBackup = async () => {
    if (!emailAddress) {
      Alert.alert('Email Required', 'Please enter an email address');
      return;
    }

    setExportStatus('Creating backup...');
    const { uri, filename } = await ExportService.createBackup(
      settings,
      savedSpots,
      activities,
      wishlistItems
    );

    setExportStatus('Composing email...');
    await ExportService.emailBackup(uri, filename, emailAddress);
    onClose();
  };

  const handleImport = async () => {
    Alert.alert(
      'Import Backup',
      'This will replace all your current data with the backup. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: async () => {
            setIsExporting(true);
            setExportStatus('Selecting backup file...');
            
            const data = await ExportService.importBackup();
            if (data) {
              setExportStatus('Restoring data...');
              const success = await ExportService.restoreFromBackup(data);
              
              if (success) {
                Alert.alert(
                  'Import Successful',
                  'Your data has been restored. Please restart the app for changes to take effect.',
                  [{ text: 'OK', onPress: onClose }]
                );
              } else {
                Alert.alert('Import Failed', 'Failed to restore backup data.');
              }
            }
            
            setIsExporting(false);
            setExportStatus('');
          },
        },
      ]
    );
  };

  const getDataSummary = () => {
    const totalPhotos = savedSpots.reduce((sum, spot) => sum + (spot.photos?.length || 0), 0);
    const totalDistance = activities.reduce((sum, act) => sum + act.distance, 0);
    
    return {
      spots: savedSpots.length,
      activities: activities.length,
      wishlist: wishlistItems.length,
      photos: totalPhotos,
      distance: (totalDistance / 1000).toFixed(1),
    };
  };

  const summary = getDataSummary();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Export & Backup</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Data Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Your Data</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.spots}</Text>
                  <Text style={styles.summaryLabel}>Locations</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.activities}</Text>
                  <Text style={styles.summaryLabel}>Activities</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.wishlist}</Text>
                  <Text style={styles.summaryLabel}>Wishlist</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.photos}</Text>
                  <Text style={styles.summaryLabel}>Photos</Text>
                </View>
              </View>
              <Text style={styles.summaryFooter}>
                Total distance tracked: {summary.distance} km
              </Text>
            </View>

            {/* Export Options */}
            <Text style={styles.sectionTitle}>Export Format</Text>
            {formatOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.formatOption,
                  selectedFormat === option.id && styles.formatOptionSelected,
                ]}
                onPress={() => setSelectedFormat(option.id)}
              >
                <View style={[styles.formatIcon, { backgroundColor: option.color + '20' }]}>
                  <Ionicons name={option.icon as any} size={24} color={option.color} />
                </View>
                <View style={styles.formatText}>
                  <Text style={styles.formatTitle}>{option.title}</Text>
                  <Text style={styles.formatSubtitle}>{option.subtitle}</Text>
                </View>
                {selectedFormat === option.id && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.forest} />
                )}
              </TouchableOpacity>
            ))}

            {/* Email input for email export */}
            {selectedFormat === 'email' && (
              <View style={styles.emailContainer}>
                <Text style={styles.emailLabel}>Email Address</Text>
                <TextInput
                  style={styles.emailInput}
                  value={emailAddress}
                  onChangeText={setEmailAddress}
                  placeholder="your@email.com"
                  placeholderTextColor={theme.colors.lightGray}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            {/* Export Status */}
            {isExporting && (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="small" color={theme.colors.forest} />
                <Text style={styles.statusText}>{exportStatus}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.exportButton, isExporting && styles.buttonDisabled]}
                onPress={handleExport}
                disabled={isExporting}
              >
                <Ionicons name="download-outline" size={20} color={theme.colors.white} />
                <Text style={styles.exportButtonText}>Export Data</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.importButton, isExporting && styles.buttonDisabled]}
                onPress={handleImport}
                disabled={isExporting}
              >
                <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.forest} />
                <Text style={styles.importButtonText}>Import Backup</Text>
              </TouchableOpacity>
            </View>

            {/* Info */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.gray} />
              <Text style={styles.infoText}>
                Your data is stored locally on your device. Regular backups ensure you never lose your adventures!
              </Text>
            </View>
          </ScrollView>
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
    maxHeight: '90%',
    paddingBottom: 30,
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
  summaryCard: {
    backgroundColor: theme.colors.offWhite,
    margin: 20,
    padding: 15,
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.forest,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 4,
  },
  summaryFooter: {
    fontSize: 12,
    color: theme.colors.gray,
    textAlign: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginHorizontal: 20,
    marginVertical: 5,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  formatOptionSelected: {
    borderColor: theme.colors.forest,
    backgroundColor: theme.colors.forest + '10',
  },
  formatIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  formatText: {
    flex: 1,
  },
  formatTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.navy,
  },
  formatSubtitle: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  emailContainer: {
    marginHorizontal: 20,
    marginTop: 15,
  },
  emailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.navy,
    marginBottom: 8,
  },
  emailInput: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.navy,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
  },
  statusText: {
    marginLeft: 10,
    fontSize: 14,
    color: theme.colors.gray,
  },
  actionButtons: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  exportButton: {
    backgroundColor: theme.colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  exportButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  importButton: {
    backgroundColor: theme.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.forest,
  },
  importButtonText: {
    color: theme.colors.forest,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.offWhite,
    margin: 20,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: theme.colors.gray,
    lineHeight: 18,
  },
});