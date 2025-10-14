// supabase/functions/send-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationPayload {
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  try {
    const payload: NotificationPayload = await req.json();
    const { user_id, notification_type, title, body, data } = payload;

    console.log(`Processing notification for user ${user_id}, type: ${notification_type}`);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's push token and notification preferences
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('push_token, notifications_enabled, notification_preferences')
      .eq('id', user_id)
      .single();

    if (error || !profile) {
      console.error('Failed to get user profile:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.notifications_enabled || !profile.push_token) {
      console.log('User has notifications disabled or no push token');
      return new Response(
        JSON.stringify({ success: false, message: 'Notifications disabled' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check notification preferences
    const preferences = profile.notification_preferences || {};
    const typeMapping: Record<string, string> = {
      'friend_request': 'friend_requests',
      'comment': 'comments',
      'like': 'likes',
      'activity_shared': 'activity_shared',
      'achievement': 'achievements',
    };

    const preferenceKey = typeMapping[notification_type] || notification_type;
    if (preferences[preferenceKey] === false) {
      console.log(`User has disabled ${preferenceKey} notifications`);
      return new Response(
        JSON.stringify({ success: false, message: 'Notification type disabled' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine channel ID for Android
    let channelId = 'default';
    if (notification_type === 'friend_request') {
      channelId = 'friend-requests';
    } else if (notification_type === 'comment') {
      channelId = 'comments';
    }

    // Send push notification
    const message = {
      to: profile.push_token,
      title,
      body,
      data: data || {},
      sound: 'default',
      priority: 'high',
      badge: 1,
      channelId,
    };

    console.log(`Sending push notification to token: ${profile.push_token.substring(0, 30)}...`);

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('Expo API response:', JSON.stringify(result));
    
    // Handle error responses from Expo
    // Check if data is an array with error status
    if (result.data && Array.isArray(result.data)) {
      const firstResult = result.data[0];
      if (firstResult && firstResult.status === 'error') {
        console.error('Push notification error (array):', firstResult.message, firstResult.details);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: firstResult.message,
            details: firstResult.details 
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Check if data is an object with error status
    if (result.data && !Array.isArray(result.data) && result.data.status === 'error') {
      console.error('Push notification error (object):', result.data.message, result.data.details);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.data.message,
          details: result.data.details 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Push notification sent successfully to user ${user_id}`);
    
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-notification function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
})