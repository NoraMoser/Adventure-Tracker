// hooks/useActivitySharing.ts
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { Activity } from '../contexts/ActivityContext';
import { useFriends } from '../contexts/FriendsContext';

export const useActivitySharing = () => {
  const { privacySettings, addActivityToFeed } = useFriends();
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [activityToShare, setActivityToShare] = useState<Activity | null>(null);

  const shouldPromptSharing = useCallback((activity: Activity): boolean => {
    // Don't prompt for manual entries
    if (activity.isManualEntry) return false;
    
    // Don't prompt for very short activities (less than 5 minutes)
    if (activity.duration < 300) return false;
    
    // Don't prompt for very short distances (less than 0.5km)
    if (activity.distance < 500) return false;
    
    return true;
  }, []);

  const promptActivitySharing = useCallback((activity: Activity) => {
    if (!shouldPromptSharing(activity)) return;

    // Check if auto-share is enabled
    if (privacySettings.autoShareActivities) {
      // Auto-share with default privacy settings
      const shareOptions = {
        includeRoute: privacySettings.defaultActivityPrivacy !== 'stats_only',
        includeExactLocation: privacySettings.defaultActivityPrivacy === 'full_route',
      };
      
      addActivityToFeed(activity, shareOptions);
      
      Alert.alert(
        'Activity Shared!',
        `Your ${activity.type} activity has been automatically shared with your friends.`,
        [
          {
            text: 'View Feed',
            onPress: () => {
              // Navigate to friends feed - you can implement this navigation
            }
          },
          { text: 'OK', style: 'default' }
        ]
      );
      return;
    }

    // Show sharing prompt
    Alert.alert(
      'Great Workout!',
      `Would you like to share your ${activity.type} activity with friends?`,
      [
        { 
          text: 'Not Now', 
          style: 'cancel' 
        },
        {
          text: 'Share',
          onPress: () => {
            setActivityToShare(activity);
            setShareModalVisible(true);
          }
        }
      ]
    );
  }, [privacySettings, addActivityToFeed, shouldPromptSharing]);

  const handleShareComplete = useCallback((sharedToFriends: boolean, shareOptions: any) => {
    setShareModalVisible(false);
    setActivityToShare(null);

    if (sharedToFriends) {
      // Optionally show success message or navigate to feed
      console.log('Activity shared successfully with options:', shareOptions);
    }
  }, []);

  const closeShareModal = useCallback(() => {
    setShareModalVisible(false);
    setActivityToShare(null);
  }, []);

  // Manual share function for use in activity lists
  const shareActivity = useCallback((activity: Activity) => {
    setActivityToShare(activity);
    setShareModalVisible(true);
  }, []);

  return {
    shareModalVisible,
    activityToShare,
    promptActivitySharing,
    shareActivity,
    handleShareComplete,
    closeShareModal,
    shouldPromptSharing,
  };
};