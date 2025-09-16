import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { NotificationService } from '../lib/notifications';
import { supabase } from '../lib/supabase';

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [preferences, setPreferences] = useState({
    friend_requests: true,
    comments: true,
    likes: true,
    activity_shared: true,
    achievements: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notifications_enabled, notification_preferences')
        .eq('id', user.id)
        .single();

      if (data) {
        setNotificationsEnabled(data.notifications_enabled ?? true);
        setPreferences(data.notification_preferences ?? preferences);
      }
    } catch (err) {
      console.error('Error loading notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);

    if (value) {
      // Request permission and get token
      const token = await NotificationService.registerForPushNotifications();
      if (!token) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive push notifications.',
          [{ text: 'OK' }]
        );
        setNotificationsEnabled(false);
        return;
      }
    }

    // Update in database
    await supabase
      .from('profiles')
      .update({ notifications_enabled: value })
      .eq('id', user!.id);
  };

  const updatePreference = async (key: string, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    await supabase
      .from('profiles')
      .update({ notification_preferences: newPreferences })
      .eq('id', user!.id);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Notification Settings',
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.mainToggle}>
            <View>
              <Text style={styles.mainToggleTitle}>Push Notifications</Text>
              <Text style={styles.mainToggleDesc}>
                Receive notifications on your device
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: '#ccc', true: theme.colors.forest }}
              thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {notificationsEnabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Types</Text>
            
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceTitle}>Friend Requests</Text>
                <Text style={styles.preferenceDesc}>
                  When someone sends you a friend request
                </Text>
              </View>
              <Switch
                value={preferences.friend_requests}
                onValueChange={(value) => updatePreference('friend_requests', value)}
                trackColor={{ false: '#ccc', true: theme.colors.forest }}
                thumbColor={preferences.friend_requests ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceTitle}>Comments</Text>
                <Text style={styles.preferenceDesc}>
                  When someone comments on your activities
                </Text>
              </View>
              <Switch
                value={preferences.comments}
                onValueChange={(value) => updatePreference('comments', value)}
                trackColor={{ false: '#ccc', true: theme.colors.forest }}
                thumbColor={preferences.comments ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceTitle}>Likes</Text>
                <Text style={styles.preferenceDesc}>
                  When someone likes your activities
                </Text>
              </View>
              <Switch
                value={preferences.likes}
                onValueChange={(value) => updatePreference('likes', value)}
                trackColor={{ false: '#ccc', true: theme.colors.forest }}
                thumbColor={preferences.likes ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceTitle}>Shared Activities</Text>
                <Text style={styles.preferenceDesc}>
                  When friends share activities with you
                </Text>
              </View>
              <Switch
                value={preferences.activity_shared}
                onValueChange={(value) => updatePreference('activity_shared', value)}
                trackColor={{ false: '#ccc', true: theme.colors.forest }}
                thumbColor={preferences.activity_shared ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceTitle}>Achievements</Text>
                <Text style={styles.preferenceDesc}>
                  When you unlock new achievements
                </Text>
              </View>
              <Switch
                value={preferences.achievements}
                onValueChange={(value) => updatePreference('achievements', value)}
                trackColor={{ false: '#ccc', true: theme.colors.forest }}
                thumbColor={preferences.achievements ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gray,
    marginLeft: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  mainToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  mainToggleTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  mainToggleDesc: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 2,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderGray,
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 10,
  },
  preferenceTitle: {
    fontSize: 16,
    color: theme.colors.navy,
  },
  preferenceDesc: {
    fontSize: 13,
    color: theme.colors.gray,
    marginTop: 2,
  },
});
