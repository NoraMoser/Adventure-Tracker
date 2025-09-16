// components/ActivityShareModal.tsx - Complete file with unit support
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { Activity } from '../contexts/ActivityContext';
import { useFriends } from '../contexts/FriendsContext';
import { useSettings } from '../contexts/SettingsContext';
import { ShareService } from '../services/shareService';

interface ActivityShareModalProps {
  visible: boolean;
  onClose: () => void;
  activity: Activity | null;
  onShare?: (sharedToFriends: boolean, shareOptions: any) => void;
}

export const ActivityShareModal: React.FC<ActivityShareModalProps> = ({
  visible,
  onClose,
  activity,
  onShare,
}) => {
  const { friends, addActivityToFeed, privacySettings, updatePrivacySettings } = useFriends();
  const { settings } = useSettings(); // Get user's unit preference
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [shareMessage, setShareMessage] = useState("");
  const [shareToAll, setShareToAll] = useState(false);
  const [shareToPublic, setShareToPublic] = useState(false);
  const [shareToFriends, setShareToFriends] = useState(true);
  
  // Privacy options
  const [includeRoute, setIncludeRoute] = useState(privacySettings.defaultActivityPrivacy !== 'stats_only');
  const [includeExactLocation, setIncludeExactLocation] = useState(privacySettings.defaultActivityPrivacy === 'full_route');
  const [rememberSettings, setRememberSettings] = useState(false);

  const acceptedFriends = friends.filter(f => f.status === 'accepted');

  const toggleFriend = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter(id => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  const getShareOptionDescription = () => {
    if (!includeRoute) return 'Stats only (distance, duration, speed)';
    if (!includeExactLocation) return 'General area only (rounded coordinates)';
    return 'Full route with exact GPS track';
  };

  const handleShare = async () => {
    if (!activity) return;

    try {
      const shareOptions = {
        includeRoute,
        includeExactLocation,
        shareToFriends: shareToFriends,
        friendIds: shareToAll ? acceptedFriends.map(f => f.id) : selectedFriends,
        message: shareMessage,
        units: settings.units, // Pass units preference
      };

      // Remember privacy settings if requested
      if (rememberSettings) {
        let defaultPrivacy: 'stats_only' | 'general_area' | 'full_route' = 'stats_only';
        if (includeRoute && includeExactLocation) {
          defaultPrivacy = 'full_route';
        } else if (includeRoute) {
          defaultPrivacy = 'general_area';
        }
        
        await updatePrivacySettings({
          defaultActivityPrivacy: defaultPrivacy,
        });
      }

      let sharedToFriends = false;

      // Share to friends feed if enabled
      if (shareToFriends && (shareToAll || selectedFriends.length > 0)) {
        await addActivityToFeed(activity, shareOptions);
        sharedToFriends = true;
      }

      // Share to public platforms if enabled
      if (shareToPublic) {
        await ShareService.shareActivity(activity, shareOptions);
      }

      // Call parent callback
      onShare?.(sharedToFriends, shareOptions);

      Alert.alert(
        'Activity Shared!',
        `Your ${activity.type} activity has been shared successfully.`,
        [{ text: 'Great!', onPress: onClose }]
      );

    } catch (error) {
      console.error('Error sharing activity:', error);
      Alert.alert('Error', 'Failed to share activity. Please try again.');
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!activity) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Share Your Activity</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Activity Preview */}
            <View style={styles.activityPreview}>
              <View style={styles.previewHeader}>
                <Ionicons
                  name={ShareService.getActivityEmoji(activity.type) === '🚴' ? 'bicycle' : 'fitness'}
                  size={24}
                  color={theme.colors.forest}
                />
                <Text style={styles.previewName}>{activity.name}</Text>
              </View>
              
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {ShareService.formatDistance(activity.distance, settings.units)}
                  </Text>
                  <Text style={styles.statLabel}>Distance</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {ShareService.formatDuration(activity.duration)}
                  </Text>
                  <Text style={styles.statLabel}>Duration</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {ShareService.formatSpeed(activity.averageSpeed, settings.units)}
                  </Text>
                  <Text style={styles.statLabel}>Avg Speed</Text>
                </View>
              </View>
            </View>

            {/* Privacy Settings */}
            <View style={styles.privacySection}>
              <Text style={styles.sectionTitle}>Privacy Settings</Text>
              
              <View style={styles.privacyOption}>
                <View style={styles.privacyInfo}>
                  <Text style={styles.privacyLabel}>Include Route Data</Text>
                  <Text style={styles.privacyDescription}>
                    {getShareOptionDescription()}
                  </Text>
                </View>
                <Switch
                  value={includeRoute}
                  onValueChange={(value) => {
                    setIncludeRoute(value);
                    if (!value) setIncludeExactLocation(false);
                  }}
                  trackColor={{ false: theme.colors.borderGray, true: theme.colors.forest }}
                />
              </View>

              {includeRoute && (
                <View style={styles.privacyOption}>
                  <View style={styles.privacyInfo}>
                    <Text style={styles.privacyLabel}>Share Exact Locations</Text>
                    <Text style={styles.privacyDescription}>
                      Show precise GPS coordinates and route
                    </Text>
                  </View>
                  <Switch
                    value={includeExactLocation}
                    onValueChange={setIncludeExactLocation}
                    trackColor={{ false: theme.colors.borderGray, true: theme.colors.forest }}
                  />
                </View>
              )}

              <View style={styles.privacyOption}>
                <View style={styles.privacyInfo}>
                  <Text style={styles.privacyLabel}>Remember These Settings</Text>
                  <Text style={styles.privacyDescription}>
                    Use as default for future activities
                  </Text>
                </View>
                <Switch
                  value={rememberSettings}
                  onValueChange={setRememberSettings}
                  trackColor={{ false: theme.colors.borderGray, true: theme.colors.forest }}
                />
              </View>
            </View>

            {/* Share Platforms */}
            <View style={styles.platformsSection}>
              <Text style={styles.sectionTitle}>Share To</Text>
              
              {acceptedFriends.length > 0 && (
                <View style={styles.platformOption}>
                  <View style={styles.platformInfo}>
                    <Ionicons name="people" size={20} color={theme.colors.navy} />
                    <Text style={styles.platformLabel}>Friends ({acceptedFriends.length})</Text>
                  </View>
                  <Switch
                    value={shareToFriends}
                    onValueChange={setShareToFriends}
                    trackColor={{ false: theme.colors.borderGray, true: theme.colors.navy }}
                  />
                </View>
              )}

              <View style={styles.platformOption}>
                <View style={styles.platformInfo}>
                  <Ionicons name="share-social" size={20} color={theme.colors.burntOrange} />
                  <Text style={styles.platformLabel}>Other Apps</Text>
                </View>
                <Switch
                  value={shareToPublic}
                  onValueChange={setShareToPublic}
                  trackColor={{ false: theme.colors.borderGray, true: theme.colors.burntOrange }}
                />
              </View>
            </View>

            {/* Friends Selection */}
            {shareToFriends && acceptedFriends.length > 0 && (
              <View style={styles.friendsSection}>
                <View style={styles.shareToAllOption}>
                  <Text style={styles.shareToAllText}>Share with all friends</Text>
                  <Switch
                    value={shareToAll}
                    onValueChange={setShareToAll}
                    trackColor={{ false: theme.colors.borderGray, true: theme.colors.forest }}
                  />
                </View>

                {!shareToAll && (
                  <View style={styles.friendsList}>
                    <Text style={styles.friendsTitle}>Select Friends:</Text>
                    {acceptedFriends.map((friend) => (
                      <TouchableOpacity
                        key={friend.id}
                        style={styles.friendItem}
                        onPress={() => toggleFriend(friend.id)}
                      >
                        <View style={styles.friendInfo}>
                          <Text style={styles.friendAvatar}>{friend.avatar || "👤"}</Text>
                          <Text style={styles.friendName}>{friend.displayName}</Text>
                        </View>
                        <Ionicons
                          name={selectedFriends.includes(friend.id) ? "checkbox" : "square-outline"}
                          size={24}
                          color={
                            selectedFriends.includes(friend.id)
                              ? theme.colors.forest
                              : theme.colors.gray
                          }
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Optional Message */}
            {(shareToFriends || shareToPublic) && (
              <View style={styles.messageSection}>
                <Text style={styles.sectionTitle}>Add a Message (Optional)</Text>
                <TextInput
                  style={styles.messageInput}
                  placeholder="What did you think of this adventure?"
                  value={shareMessage}
                  onChangeText={setShareMessage}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={theme.colors.lightGray}
                />
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.shareBtn,
                (!shareToFriends && !shareToPublic) && styles.shareBtnDisabled
              ]}
              onPress={handleShare}
              disabled={!shareToFriends && !shareToPublic}
            >
              <Ionicons name="share-social" size={20} color="white" />
              <Text style={styles.shareText}>Share Activity</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  scrollContent: {
    maxHeight: 500,
  },
  activityPreview: {
    backgroundColor: theme.colors.offWhite,
    margin: 20,
    padding: 15,
    borderRadius: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.navy,
    marginLeft: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  privacySection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.navy,
    marginBottom: 15,
  },
  privacyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  privacyInfo: {
    flex: 1,
    marginRight: 15,
  },
  privacyLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.navy,
  },
  privacyDescription: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  platformsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  platformOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  platformInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.navy,
    marginLeft: 10,
  },
  friendsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  shareToAllOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 15,
    backgroundColor: theme.colors.offWhite,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  shareToAllText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.navy,
  },
  friendsList: {
    maxHeight: 150,
  },
  friendsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gray,
    marginBottom: 10,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderGray,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    fontSize: 18,
    marginRight: 10,
  },
  friendName: {
    fontSize: 14,
    color: theme.colors.navy,
  },
  messageSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  messageInput: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: theme.colors.navy,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.offWhite,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  skipText: {
    fontSize: 16,
    color: theme.colors.gray,
    fontWeight: '600',
  },
  shareBtn: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: theme.colors.forest,
  },
  shareBtnDisabled: {
    opacity: 0.5,
  },
  shareText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
});
