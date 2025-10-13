// lib/notifications.ts - Complete version with all functions
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const isExpoGo = Constants.appOwnership === 'expo';

let Device: any = null;
let Notifications: any = null;

if (!isExpoGo) {
  Device = require('expo-device');
  Notifications = require('expo-notifications');
  
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export class NotificationService {
  // In lib/notifications.ts - Fix the token registration
static async registerForPushNotifications() {
  if (isExpoGo || !Notifications || !Device) {
    console.log('Push notifications not available in Expo Go');
    return null;
  }

  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Android channel setup
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

    // Use the projectId directly from your app.json
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: '0e548ecd-901d-40e5-a107-3a05329592e9' // Your actual project ID
    });
    
    
    // Save token to database
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          push_token: token.data,
          notifications_enabled: true 
        })
        .eq('id', user.id);
        
      if (error) {
        console.error('Error saving push token:', error);
      }
    }
    
    return token.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
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

    try {
      const content: any = {
        title,
        body,
        data: data || {},
        sound: true,
      };

      if (Platform.OS === 'android' && channelId) {
        content.channelId = channelId;
      }

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null, // Immediate notification
      });
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
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

export class PushNotificationHelper {
  private static EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  static async sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    channelId?: string
  ): Promise<boolean> {
    try {
      const message: any = {
        to: pushToken,
        title,
        body,
        data: data || {},
        sound: 'default',
        priority: 'high',
        badge: 1,
      };

      if (channelId && Platform.OS === 'android') {
        message.channelId = channelId;
      }

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