// settings.tsx - Complete with ActivityPickerModal at the bottom
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system';
import { Stack, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ActivityPickerModal } from '../components/ActivityPickerModal';
import { ExplorableIcon } from '../components/Logo';
import { theme } from '../constants/theme';
import { useActivity } from '../contexts/ActivityContext';
import { useLocation } from '../contexts/LocationContext';
import { useSettings } from '../contexts/SettingsContext'; // ADD THIS
import { useWishlist } from '../contexts/WishlistContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { savedSpots } = useLocation();
  const { activities } = useActivity();
  const { wishlistItems } = useWishlist();
  const { settings, updateSettings } = useSettings(); // USE CONTEXT INSTEAD OF LOCAL STATE
  const [showActivityPicker, setShowActivityPicker] = useState(false);

  const updateSetting = async (key: string, value: any) => {
    await updateSettings({ [key]: value });
  };

  const updatePrivacySetting = async (key: string, value: boolean) => {
    await updateSettings({
      privacy: { ...settings.privacy, [key]: value },
    });
  };

  const exportData = async () => {
    try {
      const data = {
        exportDate: new Date().toISOString(),
        appVersion: Application.nativeApplicationVersion || '1.0.0',
        settings,
        savedSpots,
        activities,
        wishlistItems,
      };

      const jsonString = JSON.stringify(data, null, 2);
      const filename = `explorable-backup-${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, jsonString);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export explorAble Data',
        });
      } else {
        Alert.alert('Export Complete', `Data saved to ${filename}`);
      }
    } catch (error) {
      Alert.alert('Export Failed', 'Could not export your data');
    }
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your saved locations, activities, and wishlist items. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert(
                'Data Cleared',
                'All your data has been deleted. The app will now restart.',
                [{ text: 'OK', onPress: () => router.replace('/') }]
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  const openPrivacyPolicy = () => {
    Alert.alert(
      'Privacy Policy',
      'explorAble respects your privacy. We only store data locally on your device. Location access is used only for tracking activities and saving spots. Your data is never shared with third parties.',
      [{ text: 'OK' }]
    );
  };

  const openTerms = () => {
    Alert.alert(
      'Terms of Service',
      'By using explorAble, you agree to use the app responsibly and at your own risk during outdoor activities. Always prioritize safety and follow local regulations.',
      [{ text: 'OK' }]
    );
  };

  const contactSupport = () => {
    Linking.openURL('mailto:your.email@example.com?subject=explorAble Support Request');
  };

  const rateApp = () => {
    Alert.alert(
      'Coming Soon!',
      'explorAble will be available on the app stores soon. Thanks for your interest!',
      [{ text: 'OK' }]
    );
  };

  const shareApp = () => {
    const message = `Check out explorAble - Track your outdoor adventures! 🌲 Built with React Native & Expo.`;
    if (Platform.OS === 'ios') {
      Linking.openURL(`sms:&body=${encodeURIComponent(message)}`);
    } else {
      Linking.openURL(`sms:?body=${encodeURIComponent(message)}`);
    }
  };

  const settingSections = [
    {
      title: 'Preferences',
      icon: 'settings-outline',
      items: [
        {
          type: 'toggle',
          label: 'Distance Units',
          value: settings.units,
          options: ['metric', 'imperial'],
          displayValue: settings.units === 'metric' ? 'Kilometers' : 'Miles',
          onPress: () => {
            updateSetting('units', settings.units === 'metric' ? 'imperial' : 'metric');
          },
        },
        {
          type: 'select',
          label: 'Default Activity',
          value: settings.defaultActivityType,
          displayValue: settings.defaultActivityType.charAt(0).toUpperCase() + settings.defaultActivityType.slice(1),
          onPress: () => setShowActivityPicker(true),
        },
        {
          type: 'switch',
          label: 'Auto-save Activities',
          value: settings.autoSave,
          onValueChange: (value: boolean) => updateSetting('autoSave', value),
        },
        {
          type: 'switch',
          label: 'Notifications',
          value: settings.notifications,
          onValueChange: (value: boolean) => updateSetting('notifications', value),
        },
      ],
    },
    {
      title: 'Map Settings',
      icon: 'map-outline',
      items: [
        {
          type: 'select',
          label: 'Map Style',
          value: settings.mapStyle,
          displayValue: settings.mapStyle.charAt(0).toUpperCase() + settings.mapStyle.slice(1),
          onPress: () => {
            const styles = ['standard', 'satellite', 'terrain'];
            const currentIndex = styles.indexOf(settings.mapStyle);
            const nextIndex = (currentIndex + 1) % styles.length;
            updateSetting('mapStyle', styles[nextIndex]);
          },
        },
      ],
    },
    {
      title: 'Privacy',
      icon: 'lock-closed-outline',
      items: [
        {
          type: 'switch',
          label: 'Share Location',
          value: settings.privacy.shareLocation,
          onValueChange: (value: boolean) => updatePrivacySetting('shareLocation', value),
        },
        {
          type: 'switch',
          label: 'Public Profile',
          value: settings.privacy.publicProfile,
          onValueChange: (value: boolean) => updatePrivacySetting('publicProfile', value),
        },
      ],
    },
    {
      title: 'Data Management',
      icon: 'server-outline',
      items: [
        {
          type: 'action',
          label: 'Export Data',
          subtitle: 'Download all your data',
          icon: 'download-outline',
          onPress: exportData,
        },
        {
          type: 'action',
          label: 'Clear All Data',
          subtitle: 'Delete everything permanently',
          icon: 'trash-outline',
          danger: true,
          onPress: clearAllData,
        },
      ],
    },
    {
      title: 'Support',
      icon: 'help-circle-outline',
      items: [
        {
          type: 'link',
          label: 'Contact Support',
          icon: 'mail-outline',
          onPress: contactSupport,
        },
        {
          type: 'link',
          label: 'Rate explorAble',
          icon: 'star-outline',
          onPress: rateApp,
        },
        {
          type: 'link',
          label: 'Share with Friends',
          icon: 'share-social-outline',
          onPress: shareApp,
        },
      ],
    },
    {
      title: 'Legal',
      icon: 'document-text-outline',
      items: [
        {
          type: 'link',
          label: 'Privacy Policy',
          icon: 'shield-checkmark-outline',
          onPress: openPrivacyPolicy,
        },
        {
          type: 'link',
          label: 'Terms of Service',
          icon: 'document-outline',
          onPress: openTerms,
        },
      ],
    },
  ];

  const appVersion = Application.nativeApplicationVersion || '1.0.0';
  const buildNumber = Application.nativeBuildVersion || '1';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Stack.Screen
          options={{
            title: 'Settings',
            headerStyle: {
              backgroundColor: theme.colors.forest,
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />

        {/* App Info Header */}
        <View style={styles.appHeader}>
          <ExplorableIcon size={80} />
          <Text style={styles.appName}>explorAble</Text>
          <Text style={styles.appVersion}>Version {appVersion} ({buildNumber})</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{savedSpots.length}</Text>
              <Text style={styles.statLabel}>Places</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{activities.length}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{wishlistItems.length}</Text>
              <Text style={styles.statLabel}>Wishlist</Text>
            </View>
          </View>
        </View>

        {/* Settings Sections */}
        {settingSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon as any} size={20} color={theme.colors.forest} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>

            {section.items.map((item: any, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                style={[
                  styles.settingItem,
                  item.danger && styles.dangerItem,
                  itemIndex === section.items.length - 1 && styles.lastItem,
                ]}
                onPress={item.type !== 'switch' ? item.onPress : undefined}
                activeOpacity={item.type === 'switch' ? 1 : 0.7}
              >
                <View style={styles.settingContent}>
                  {item.icon && (
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={item.danger ? theme.colors.burntOrange : theme.colors.gray}
                      style={styles.settingIcon}
                    />
                  )}
                  <View style={styles.settingText}>
                    <Text style={[styles.settingLabel, item.danger && styles.dangerText]}>
                      {item.label}
                    </Text>
                    {item.subtitle && (
                      <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
                    )}
                  </View>
                </View>

                {item.type === 'switch' && (
                  <Switch
                    value={item.value}
                    onValueChange={item.onValueChange}
                    trackColor={{ false: theme.colors.borderGray, true: theme.colors.forest }}
                    thumbColor={item.value ? theme.colors.white : theme.colors.lightGray}
                  />
                )}

                {item.type === 'toggle' && (
                  <View style={styles.toggleValue}>
                    <Text style={styles.valueText}>{item.displayValue}</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.lightGray} />
                  </View>
                )}

                {item.type === 'select' && (
                  <View style={styles.selectValue}>
                    <Text style={styles.valueText}>{item.displayValue}</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.lightGray} />
                  </View>
                )}

                {item.type === 'link' && (
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.lightGray} />
                )}

                {item.type === 'action' && !item.danger && (
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.lightGray} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with ❤️ for adventurers</Text>
          <Text style={styles.footerSubtext}>© 2024 explorAble</Text>
        </View>
      </ScrollView>

      {/* ActivityPickerModal - THIS IS THE MODAL! */}
      <ActivityPickerModal
        visible={showActivityPicker}
        currentValue={settings.defaultActivityType as any}
        onClose={() => setShowActivityPicker(false)}
        onSelect={(activity) => updateSetting('defaultActivityType', activity)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  appHeader: {
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.navy,
    marginTop: 12,
  },
  appVersion: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    paddingHorizontal: 40,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.forest,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.borderGray,
    marginHorizontal: 20,
  },
  section: {
    backgroundColor: theme.colors.white,
    marginTop: 20,
    paddingVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginLeft: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  dangerItem: {
    backgroundColor: theme.colors.burntOrange + '05',
  },
  settingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.colors.navy,
  },
  settingSubtitle: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  dangerText: {
    color: theme.colors.burntOrange,
  },
  toggleValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 14,
    color: theme.colors.gray,
    marginRight: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  footerSubtext: {
    fontSize: 12,
    color: theme.colors.lightGray,
    marginTop: 4,
  },
});