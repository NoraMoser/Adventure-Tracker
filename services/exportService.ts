// services/exportService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { Activity } from '../contexts/ActivityContext';
import { SavedSpot } from '../contexts/LocationContext';
import { WishlistItem } from '../contexts/WishlistContext';

export interface ExportData {
  version: string;
  exportDate: string;
  appVersion: string;
  userData?: {
    userName?: string;
  };
  settings: any;
  savedSpots: SavedSpot[];
  activities: Activity[];
  wishlistItems: WishlistItem[];
}

export class ExportService {
  private static readonly APP_VERSION = '1.0.0';
  private static readonly EXPORT_VERSION = '1.0';

  /**
   * Export all app data to JSON
   */
  static async exportToJSON(data: ExportData): Promise<string> {
    const exportData: ExportData = {
      ...data,
      version: this.EXPORT_VERSION,
      exportDate: new Date().toISOString(),
      appVersion: this.APP_VERSION,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export activities to GPX format (GPS Exchange Format)
   */
  static async exportToGPX(activities: Activity[]): Promise<string> {
    const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="explorAble App"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>explorAble Activities Export</name>
    <desc>GPS tracks from explorAble adventure tracking app</desc>
    <author>
      <name>explorAble User</name>
    </author>
    <time>${new Date().toISOString()}</time>
  </metadata>`;

    const gpxFooter = `
</gpx>`;

    const tracks = activities
      .filter(activity => activity.route && activity.route.length > 0)
      .map(activity => {
        const trackPoints = activity.route.map(point => `
      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        <ele>${point.altitude || 0}</ele>
        <time>${new Date(point.timestamp).toISOString()}</time>
      </trkpt>`).join('');

        return `
  <trk>
    <name>${this.escapeXml(activity.name)}</name>
    <type>${activity.type}</type>
    <desc>${this.escapeXml(activity.notes || '')}</desc>
    <trkseg>${trackPoints}
    </trkseg>
  </trk>`;
      }).join('');

    return gpxHeader + tracks + gpxFooter;
  }

  /**
   * Export saved spots to CSV
   */
  static async exportSpotsToCSV(spots: SavedSpot[]): Promise<string> {
    const headers = ['Name', 'Category', 'Latitude', 'Longitude', 'Description', 'Rating', 'Date', 'Photos'];
    
    const rows = spots.map(spot => [
      this.escapeCSV(spot.name),
      spot.category,
      spot.location.latitude.toString(),
      spot.location.longitude.toString(),
      this.escapeCSV(spot.description || ''),
      (spot.rating || 0).toString(),
      new Date(spot.timestamp).toLocaleDateString(),
      (spot.photos?.length || 0).toString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Export activities summary to CSV
   */
  static async exportActivitiesToCSV(activities: Activity[]): Promise<string> {
    const headers = [
      'Name',
      'Type',
      'Date',
      'Start Time',
      'Duration (min)',
      'Distance (km)',
      'Avg Speed (km/h)',
      'Max Speed (km/h)',
      'Notes'
    ];

    const rows = activities.map(activity => [
      this.escapeCSV(activity.name),
      activity.type,
      new Date(activity.startTime).toLocaleDateString(),
      new Date(activity.startTime).toLocaleTimeString(),
      Math.round(activity.duration / 60).toString(),
      (activity.distance / 1000).toFixed(2),
      activity.averageSpeed.toFixed(1),
      activity.maxSpeed.toFixed(1),
      this.escapeCSV(activity.notes || '')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Create a comprehensive backup file
   */
  static async createBackup(
    settings: any,
    savedSpots: SavedSpot[],
    activities: Activity[],
    wishlistItems: WishlistItem[]
  ): Promise<{ uri: string; filename: string }> {
    try {
      const userName = await AsyncStorage.getItem('userName');
      
      const exportData: ExportData = {
        version: this.EXPORT_VERSION,
        exportDate: new Date().toISOString(),
        appVersion: this.APP_VERSION,
        userData: {
          userName: userName || undefined,
        },
        settings,
        savedSpots,
        activities,
        wishlistItems,
      };

      const jsonContent = await this.exportToJSON(exportData);
      const filename = `explorable_backup_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, jsonContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      return { uri: fileUri, filename };
    } catch (error) {
      console.error('Error creating backup:', error);
      throw new Error('Failed to create backup file');
    }
  }

  /**
   * Export activities as GPX file
   */
  static async exportActivitiesAsGPX(activities: Activity[]): Promise<{ uri: string; filename: string }> {
    try {
      const gpxContent = await this.exportToGPX(activities);
      const filename = `explorable_activities_${new Date().toISOString().split('T')[0]}.gpx`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, gpxContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      return { uri: fileUri, filename };
    } catch (error) {
      console.error('Error creating GPX file:', error);
      throw new Error('Failed to create GPX file');
    }
  }

  /**
   * Export data as CSV files (creates a summary)
   */
  static async exportAsCSV(
    spots: SavedSpot[],
    activities: Activity[]
  ): Promise<{ spotsUri: string; activitiesUri: string }> {
    try {
      const spotsCSV = await this.exportSpotsToCSV(spots);
      const activitiesCSV = await this.exportActivitiesToCSV(activities);
      
      const date = new Date().toISOString().split('T')[0];
      const spotsFilename = `explorable_spots_${date}.csv`;
      const activitiesFilename = `explorable_activities_${date}.csv`;
      
      const spotsUri = `${FileSystem.documentDirectory}${spotsFilename}`;
      const activitiesUri = `${FileSystem.documentDirectory}${activitiesFilename}`;

      await FileSystem.writeAsStringAsync(spotsUri, spotsCSV);
      await FileSystem.writeAsStringAsync(activitiesUri, activitiesCSV);

      return { spotsUri, activitiesUri };
    } catch (error) {
      console.error('Error creating CSV files:', error);
      throw new Error('Failed to create CSV files');
    }
  }

  /**
   * Share files using native share sheet
   */
  static async shareFile(fileUri: string, mimeType: string = 'application/json'): Promise<void> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (!isAvailable) {
        Alert.alert('Sharing not available', 'Sharing is not available on this device');
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: 'Export explorAble Data',
        UTI: mimeType === 'application/json' ? 'public.json' : 'public.plain-text',
      });
    } catch (error) {
      console.error('Error sharing file:', error);
      throw new Error('Failed to share file');
    }
  }

  /**
   * Send backup via email
   */
  static async emailBackup(
    fileUri: string,
    filename: string,
    recipientEmail?: string
  ): Promise<void> {
    try {
      const isAvailable = await MailComposer.isAvailableAsync();
      
      if (!isAvailable) {
        // Fallback to sharing if email is not available
        await this.shareFile(fileUri);
        return;
      }

      const options: MailComposer.MailComposerOptions = {
        subject: `explorAble Backup - ${new Date().toLocaleDateString()}`,
        body: `
          <html>
            <body>
              <h2>explorAble Data Backup</h2>
              <p>Attached is your explorAble data backup created on ${new Date().toLocaleString()}.</p>
              <p><strong>This backup includes:</strong></p>
              <ul>
                <li>All saved locations</li>
                <li>Activity history and GPS tracks</li>
                <li>Wishlist items</li>
                <li>App settings and preferences</li>
              </ul>
              <p><strong>To restore this backup:</strong></p>
              <ol>
                <li>Open explorAble app</li>
                <li>Go to Settings > Data Management</li>
                <li>Select "Import Backup"</li>
                <li>Choose this file</li>
              </ol>
              <p style="color: #666; font-size: 12px;">
                <em>Keep this file safe - it contains all your adventure data!</em>
              </p>
            </body>
          </html>
        `,
        recipients: recipientEmail ? [recipientEmail] : [],
        attachments: [fileUri],
        isHtml: true,
      };

      const result = await MailComposer.composeAsync(options);
      
      if (result.status === MailComposer.MailComposerStatus.SENT) {
        Alert.alert('Success', 'Backup email sent successfully!');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      // Fallback to sharing
      await this.shareFile(fileUri);
    }
  }

  /**
   * Import backup from file
   */
  static async importBackup(): Promise<ExportData | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      // Check if user cancelled (new API structure)
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      // Get the first asset
      const file = result.assets[0];

      // Read the file
      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const data: ExportData = JSON.parse(fileContent);

      // Validate the backup
      if (!data.version || !data.exportDate) {
        throw new Error('Invalid backup file format');
      }

      // Check version compatibility
      if (data.version !== this.EXPORT_VERSION) {
        Alert.alert(
          'Version Mismatch',
          `This backup was created with a different version (${data.version}). Some data may not import correctly.`,
          [{ text: 'Continue Anyway' }]
        );
      }

      return data;
    } catch (error) {
      console.error('Error importing backup:', error);
      Alert.alert('Import Failed', 'Failed to import backup file. Please ensure it\'s a valid explorAble backup.');
      return null;
    }
  }

  /**
   * Restore app data from backup
   */
  static async restoreFromBackup(data: ExportData): Promise<boolean> {
    try {
      // Restore user data
      if (data.userData?.userName) {
        await AsyncStorage.setItem('userName', data.userData.userName);
      }

      // Restore settings
      if (data.settings) {
        await AsyncStorage.setItem('explorableSettings', JSON.stringify(data.settings));
      }

      // Restore saved spots
      if (data.savedSpots) {
        await AsyncStorage.setItem('savedSpots', JSON.stringify(data.savedSpots));
      }

      // Restore activities
      if (data.activities) {
        await AsyncStorage.setItem('activities', JSON.stringify(data.activities));
      }

      // Restore wishlist
      if (data.wishlistItems) {
        await AsyncStorage.setItem('wishlist', JSON.stringify(data.wishlistItems));
      }

      return true;
    } catch (error) {
      console.error('Error restoring backup:', error);
      return false;
    }
  }

  /**
   * Helper function to escape XML special characters
   */
  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Helper function to escape CSV special characters
   */
  private static escapeCSV(text: string): string {
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  /**
   * Get file size in human readable format
   */
  static async getFileSize(uri: string): Promise<string> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists || fileInfo.size === undefined) {
        return 'Unknown size';
      }

      const bytes = fileInfo.size;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 Bytes';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    } catch (error) {
      return 'Unknown size';
    }
  }
}