// lib/notifications.ts - With Expo Go detection
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Check if we're in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Conditionally import notification modules
let Device: any = null;
let Notifications: any = null;

if (!isExpoGo) {
  Device = require('expo-device');
  Notifications = require('expo-notifications');
  
  // Configure notification behavior only if not in Expo Go
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export class NotificationService {
  static async registerForPushNotifications() {
    // Skip entirely in Expo Go
    if (isExpoGo || !Notifications || !Device) {
      console.log('Push notifications not available in Expo Go. Use a development build.');
      return null;
    }

    let token;

    // Check if it's a physical device
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return;
    }

    // Get existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Ask for permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for notifications');
      return;
    }

    // Get the push token
    try {
      token = await Notifications.getExpoPushTokenAsync();
      console.log('Push token:', token.data);
      
      // Save token to user's profile in Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ 
            push_token: token.data,
            notifications_enabled: true 
          })
          .eq('id', user.id);
      }
      
      return token.data;
    } catch (error) {
      console.error('Error getting push token:', error);
    }

    // Android-specific channel setup
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2d5a3d',
      });

      await Notifications.setNotificationChannelAsync('friend-requests', {
        name: 'Friend Requests',
        importance: Notifications.AndroidImportance.HIGH,
      });

      await Notifications.setNotificationChannelAsync('comments', {
        name: 'Comments',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    return token?.data;
  }

  static async sendLocalNotification(
    title: string,
    body: string,
    data?: any,
    channelId?: string
  ) {
    if (isExpoGo || !Notifications) {
      console.log('Local notifications not available in Expo Go');
      return;
    }

    const content: any = {
      title,
      body,
      data,
    };

    if (Platform.OS === 'android' && channelId) {
      content.channelId = channelId;
    }

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: null,
    });
  }

  static async getBadgeCount(): Promise<number> {
    if (isExpoGo || !Notifications) return 0;
    return await Notifications.getBadgeCountAsync();
  }

  static async setBadgeCount(count: number) {
    if (isExpoGo || !Notifications) return;
    await Notifications.setBadgeCountAsync(count);
  }

  static async clearNotifications() {
    if (isExpoGo || !Notifications) return;
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  }
}

// Push notification helper for sending to other users
export class PushNotificationHelper {
  private static EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  static async sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    channelId?: string
  ): Promise<boolean> {
    // This can still work in Expo Go since it's just a fetch
    try {
      const message = {
        to: pushToken,
        title,
        body,
        data: data || {},
        sound: 'default',
        priority: 'high',
        badge: 1,
        ...(channelId && { channelId }),
      };

      const response = await fetch(this.EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      
      if (result.data && Array.isArray(result.data)) {
        const firstResult = result.data[0];
        if (firstResult && firstResult.status === 'error') {
          console.error('Push notification error:', firstResult.message);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }
  }

  static async sendNotificationToUser(
    userId: string,
    notificationType: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<boolean> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('push_token, notifications_enabled, notification_preferences')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        console.error('Failed to get user profile:', error);
        return false;
      }

      if (!profile.notifications_enabled || !profile.push_token) {
        console.log('User has notifications disabled or no push token');
        return false;
      }

      const preferences = profile.notification_preferences || {};
      const typeMapping: Record<string, string> = {
        'friend_request': 'friend_requests',
        'comment': 'comments',
        'like': 'likes',
        'activity_shared': 'activity_shared',
        'achievement': 'achievements',
      };

      const preferenceKey = typeMapping[notificationType] || notificationType;
      if (preferences[preferenceKey] === false) {
        console.log(`User has disabled ${notificationType} notifications`);
        return false;
      }

      let channelId = 'default';
      if (notificationType === 'friend_request') {
        channelId = 'friend-requests';
      } else if (notificationType === 'comment') {
        channelId = 'comments';
      }

      return await this.sendPushNotification(
        profile.push_token,
        title,
        body,
        data,
        channelId
      );
    } catch (error) {
      console.error('Error sending notification to user:', error);
      return false;
    }
  }
}