import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { theme } from "../constants/theme";
import { ActivityProvider } from "../contexts/ActivityContext";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { FriendsProvider, useFriends } from "../contexts/FriendsContext";
import { LocationProvider } from "../contexts/LocationContext";
import { SettingsProvider } from "../contexts/SettingsContext";
import { TripProvider } from "../contexts/TripContext";
import { WishlistProvider } from "../contexts/WishlistContext";
import { supabase } from "../lib/supabase";
import { UpdateChecker } from "../services/updateService";

// Conditionally import notifications
let Notifications: any = null;
let NotificationService: any = null;

// Only import notifications if not in Expo Go
if (Constants.appOwnership !== "expo") {
  Notifications = require("expo-notifications");
  NotificationService = require("../lib/notifications").NotificationService;
}

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {});

// Create a separate component for notification handling
function NotificationHandler({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const { refreshFeed } = useFriends(); // ADD THIS - import from FriendsContext

  useEffect(() => {
    // Skip if in Expo Go or notifications not available
    if (!user || !Notifications || !NotificationService) {
      return;
    }

    // Register for push notifications
    NotificationService.registerForPushNotifications().catch((err: any) => {
      console.log("Failed to register for push notifications:", err);
    });

    // Listen for incoming notifications while app is foregrounded
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification: any) => {});

    // Listen for notification interactions (user taps on notification)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        async (response: any) => {
          const { data } = response.notification.request.content;

          // Navigate based on notification type
          if (data?.type === "friend_request") {
            await refreshFeed(); // This will fetch the latest friend requests

            // Small delay to ensure refresh completes
            setTimeout(() => {
              router.push("/friend-requests");
            }, 300);
          } else if (data?.type === "comment") {
            if (data.activity_id) {
              router.push(`/activity/${data.activity_id}` as any);
            } else if (data.location_id) {
              router.push(`/location/${data.location_id}` as any);
            } else {
              router.push("/friends-feed");
            }
          } else if (data?.type === "friend_accepted") {
            if (data.friend_id) {
              router.push(`/friend-profile/${data.friend_id}` as any);
            } else {
              router.push("/friends");
            }
          } else if (
            data?.type === "like" ||
            data?.type === "activity_shared"
          ) {
            router.push("/friends-feed");
          }
        }
      );

    return () => {
      if (
        notificationListener.current &&
        Notifications.removeNotificationSubscription
      ) {
        Notifications.removeNotificationSubscription(
          notificationListener.current
        );
      }
      if (
        responseListener.current &&
        Notifications.removeNotificationSubscription
      ) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  // Handle app state changes to refresh connections when app resumes
  useEffect(() => {
    let isSubscribed = true;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && isSubscribed) {
        try {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();
          if (error) {
            console.error("Error refreshing session:", error);
            await supabase.auth.refreshSession();
          } else if (session) {
            console.log("Session refreshed successfully");
          }

          const channels = supabase.getChannels();
          if (channels.length > 0) {
            await supabase.removeAllChannels();
          }
        } catch (err) {
          console.error("Error handling app resume:", err);
        }
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      isSubscribed = false;
      subscription.remove();
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <UpdateChecker>
      <AuthProvider>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <SettingsProvider>
            <LocationProvider>
              <ActivityProvider>
                <WishlistProvider>
                  <FriendsProvider>
                    <NotificationHandler>
                      <TripProvider>
                        <SafeAreaProvider>
                          <StatusBar style="light" />
                          <Stack
                            screenOptions={{
                              headerStyle: {
                                backgroundColor: theme.colors.forest,
                              },
                              headerTintColor: "#fff",
                              headerTitleStyle: {
                                fontWeight: "bold",
                              },
                              contentStyle: {
                                backgroundColor: theme.colors.offWhite,
                              },
                            }}
                          >
                            {/* All your screens here */}
                            <Stack.Screen
                              name="index"
                              options={{ title: "Home", headerShown: false }}
                            />
                            <Stack.Screen
                              name="splash"
                              options={{ headerShown: false }}
                            />
                            <Stack.Screen
                              name="onboarding"
                              options={{ headerShown: false }}
                            />
                            <Stack.Screen
                              name="save-location"
                              options={{
                                title: "Save Location",
                                presentation: "modal",
                                headerLeft: () => null,
                              }}
                            />
                            <Stack.Screen
                              name="saved-spots"
                              options={{ title: "Saved Spots" }}
                            />
                            <Stack.Screen
                              name="edit-location"
                              options={{ title: "Edit Location" }}
                            />
                            <Stack.Screen
                              name="add-location"
                              options={{
                                title: "Add Location",
                                presentation: "modal",
                              }}
                            />
                            <Stack.Screen
                              name="track-activity"
                              options={{ title: "Track Activity" }}
                            />
                            <Stack.Screen
                              name="past-activities"
                              options={{ title: "Past Activities" }}
                            />
                            <Stack.Screen
                              name="add-activity"
                              options={{
                                title: "Add Activity",
                                presentation: "modal",
                              }}
                            />
                            <Stack.Screen
                              name="edit-activity"
                              options={{ title: "Edit Activity" }}
                            />
                            <Stack.Screen
                              name="statistics"
                              options={{ title: "Statistics" }}
                            />
                            <Stack.Screen
                              name="wishlist"
                              options={{ title: "Wishlist" }}
                            />
                            <Stack.Screen
                              name="settings"
                              options={{ title: "Settings" }}
                            />
                            <Stack.Screen
                              name="friends-feed"
                              options={{ title: "Friends Feed" }}
                            />
                            <Stack.Screen
                              name="friends"
                              options={{ title: "Friends" }}
                            />
                            <Stack.Screen
                              name="friend-requests"
                              options={{ title: "Friend Requests" }}
                            />
                            <Stack.Screen
                              name="friend-profile/[id]"
                              options={{ title: "Friend Profile" }}
                            />
                            <Stack.Screen
                              name="notifications"
                              options={{ title: "Notifications" }}
                            />
                            <Stack.Screen
                              name="notification-settings"
                              options={{ title: "Notification Settings" }}
                            />
                            <Stack.Screen
                              name="activity/[id]"
                              options={{ title: "Activity Details" }}
                            />
                            <Stack.Screen
                              name="location/[id]"
                              options={{ title: "Location Details" }}
                            />
                            <Stack.Screen
                              name="trips"
                              options={{ title: "My Trips" }}
                            />
                            <Stack.Screen
                              name="trip-detail"
                              options={{ title: "Trip Details" }}
                            />
                            <Stack.Screen
                              name="edit-trip"
                              options={{
                                title: "Edit Trip",
                                presentation: "modal",
                              }}
                            />
                            <Stack.Screen
                              name="create-trip"
                              options={{
                                title: "Create Trip",
                                presentation: "modal",
                              }}
                            />
                            <Stack.Screen
                              name="quick-photo"
                              options={{
                                title: "Quick Photo",
                                presentation: "modal",
                              }}
                            />
                            <Stack.Screen
                              name="today"
                              options={{ title: "Today" }}
                            />
                            <Stack.Screen
                              name="profile"
                              options={{ title: "Profile" }}
                            />
                            <Stack.Screen
                              name="profile-edit"
                              options={{ title: "Edit Profile" }}
                            />
                            <Stack.Screen
                              name="auth/login"
                              options={{
                                title: "Sign In",
                                headerShown: false,
                              }}
                            />
                            <Stack.Screen
                              name="auth/signup"
                              options={{
                                title: "Sign Up",
                                headerShown: false,
                              }}
                            />
                            <Stack.Screen
                              name="calendar-view"
                              options={{ title: "Calendar View" }}
                            />
                          </Stack>
                        </SafeAreaProvider>
                      </TripProvider>
                    </NotificationHandler>
                  </FriendsProvider>
                </WishlistProvider>
              </ActivityProvider>
            </LocationProvider>
          </SettingsProvider>
        </View>
      </AuthProvider>
    </UpdateChecker>
  );
}
