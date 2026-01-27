import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";
import { supabase } from "../lib/supabase";
import { syncService } from "../services/syncService";

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
  last_active: string;
  privacy_settings: {
    share_activities: boolean;
    share_locations: boolean;
    allow_friend_requests: boolean;
  };
  profile_picture?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isOfflineMode: boolean;
  isConnected: boolean;
  signUp: (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  syncLocalData: () => Promise<void>;
  setOfflineMode: (enabled: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const lastRefresh = useRef<Date>(new Date());
  const hasSyncedThisSession = useRef(false);
  const wasOffline = useRef(false);
  const pendingSyncRef = useRef(false);

  // Network connectivity listener - auto offline/online handling
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected ?? false;
      console.log("🌐 Network state changed:", connected ? "ONLINE" : "OFFLINE");
      setIsConnected(connected);

      if (!connected) {
        // Lost connection - enter offline mode automatically
        console.log("📴 Auto-entering offline mode (no network)");
        wasOffline.current = true;
        setIsOfflineMode(true);
      } else if (connected && wasOffline.current) {
        // Back online after being offline - trigger sync
        console.log("📶 Back online - preparing to sync...");
        wasOffline.current = false;
        
        // Small delay to ensure network is stable before syncing
        if (!pendingSyncRef.current) {
          pendingSyncRef.current = true;
          setTimeout(async () => {
            try {
              // Try to restore session first
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              
              if (currentSession) {
                console.log("🔄 Session restored, syncing data...");
                setSession(currentSession);
                setUser(currentSession.user);
                setIsOfflineMode(false);
                
                // Load fresh profile
                await loadProfile(currentSession.user.id);
                
                // Sync any offline data
                await syncLocalData();
                
                Alert.alert(
                  "Back Online! 🎉",
                  "Your connection is restored. Syncing your offline data now."
                );
              } else {
                // No session but online - user can sign in
                console.log("📶 Online but no session - user needs to sign in");
                setIsOfflineMode(false);
              }
            } catch (error) {
              console.error("❌ Error during reconnection:", error);
            } finally {
              pendingSyncRef.current = false;
            }
          }, 2000); // 2 second delay for network stability
        }
      }
    });

    // Check initial network state
    NetInfo.fetch().then((state) => {
      const connected = state.isConnected ?? false;
      console.log("🌐 Initial network state:", connected ? "ONLINE" : "OFFLINE");
      setIsConnected(connected);
      if (!connected) {
        wasOffline.current = true;
        setIsOfflineMode(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Initialize auth state
  useEffect(() => {
    checkAuthStatus();

    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {

        if (event === "SIGNED_IN" && session) {
          setSession(session);
          setUser(session.user);
          await loadProfile(session.user.id);

          // Trigger sync after successful sign in
          if (!hasSyncedThisSession.current) {
            hasSyncedThisSession.current = true;
            setTimeout(() => {
              syncLocalData();
            }, 1000);
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setSession(null);
          hasSyncedThisSession.current = false;
        } else if (event === "TOKEN_REFRESHED" && session) {
          setSession(session);
          setUser(session.user);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const timeoutId = setTimeout(() => {
        setLoading(false);
      }, 5000);

      const offlineMode = await AsyncStorage.getItem("offlineMode");
      if (offlineMode === "true") {
        setIsOfflineMode(true);
        clearTimeout(timeoutId);
        setLoading(false);
        return;
      }

      // Also check if we have no network
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
        console.log("🔍 AuthContext: No network on startup, entering offline mode");
        setIsOfflineMode(true);
        wasOffline.current = true;
        
        // Try to load cached profile
        const cachedProfile = await AsyncStorage.getItem("userProfile");
        if (cachedProfile) {
          setProfile(JSON.parse(cachedProfile));
          console.log("🔍 AuthContext: Loaded cached profile for offline use");
        }
        
        clearTimeout(timeoutId);
        setLoading(false);
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("🔍 AuthContext: Session error:", sessionError);
        clearTimeout(timeoutId);
        setLoading(false);
        return;
      }

      if (session) {
        setSession(session);
        setUser(session.user);

        await loadProfile(session.user.id);
        await updateLastActive(session.user.id);
      }

      clearTimeout(timeoutId);
      setLoading(false);
    } catch (error) {
      console.error("🔍 AuthContext: Critical auth check error:", error);
      setLoading(false);
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      // If offline, try to load from cache
      if (!isConnected) {
        const cachedProfile = await AsyncStorage.getItem("userProfile");
        if (cachedProfile) {
          setProfile(JSON.parse(cachedProfile));
          console.log("🔍 AuthContext: Loaded profile from cache (offline)");
          return;
        }
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("🔍 AuthContext: Profile load error:", error);
        // Try cache as fallback
        const cachedProfile = await AsyncStorage.getItem("userProfile");
        if (cachedProfile) {
          setProfile(JSON.parse(cachedProfile));
          console.log("🔍 AuthContext: Loaded profile from cache (fallback)");
        }
        return;
      }
      setProfile(data);
      await AsyncStorage.setItem("userProfile", JSON.stringify(data));
    } catch (error) {
      console.error("🔍 AuthContext: Error loading profile:", error);
      // Try cache as fallback
      const cachedProfile = await AsyncStorage.getItem("userProfile");
      if (cachedProfile) {
        setProfile(JSON.parse(cachedProfile));
      }
    }
  };

  const refreshProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
        await AsyncStorage.setItem("userProfile", JSON.stringify(data));
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      // Don't try to refresh if offline
      if (!isConnected) {
        console.log("⏭️ Skipping session refresh - offline");
        return false;
      }

      const now = new Date();
      const timeSince = now.getTime() - lastRefresh.current.getTime();

      if (timeSince < 300000) {
        return true;
      }

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Refresh timeout")), 5000)
      );

      const refreshPromise = supabase.auth.refreshSession();

      const { data, error } = await Promise.race([
        refreshPromise,
        timeoutPromise,
      ]).catch((err) => {
        if (err.message === "Refresh timeout") {
          console.error("❌ Refresh timed out after 5 seconds");
          return { data: null, error: err };
        }
        throw err;
      });

      if (error) {
        console.error("❌ Refresh failed:", error);
        return false;
      }

      if (data?.session) {
        setSession(data.session);
        setUser(data.session.user);
        lastRefresh.current = new Date();
        return true;
      }

      console.error("❌ No session returned");
      return false;
    } catch (error) {
      console.error("💥 Refresh error:", error);
      return false;
    }
  };

  const updateLastActive = async (userId: string) => {
    try {
      await supabase
        .from("profiles")
        .update({ last_active: new Date().toISOString() })
        .eq("id", userId);
    } catch (error) {
      console.error("🔍 AuthContext: Error updating last active:", error);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => {
    try {
      setLoading(true);

      const { data: existingUser } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        throw new Error("Username already taken. Please choose another.");
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            username: username.toLowerCase(),
            display_name: displayName,
          },
        },
      });

      if (error) {
        console.error("Supabase signup error:", error);
        if (error.message.includes("User already registered")) {
          throw new Error(
            "An account with this email already exists. Please sign in instead."
          );
        }
        throw error;
      }

      if (!data.user) {
        throw new Error("Failed to create user account");
      }

      // Create profile if it doesn't exist
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        username: username.toLowerCase(),
        display_name: displayName,
        avatar: "🏔️",
        privacy_settings: {
          share_activities: true,
          share_locations: true,
          allow_friend_requests: true,
        },
      });

      if (profileError && !profileError.message.includes("duplicate")) {
        console.error("Profile creation error:", profileError);
      }

      await AsyncStorage.setItem("isAuthenticated", "true");
      await AsyncStorage.setItem("userId", data.user.id);

      Alert.alert(
        "Welcome to ExplorAble!",
        "Your account has been created successfully!"
      );
    } catch (error: any) {
      console.error("Signup error details:", error);
      Alert.alert("Sign Up Error", error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error("Login failed");

      // The onAuthStateChange listener will handle setting user/session
      // and triggering sync

      await AsyncStorage.setItem("isAuthenticated", "true");
      await AsyncStorage.setItem("userId", data.user.id);
      await AsyncStorage.removeItem("offlineMode");

      setIsOfflineMode(false);
      wasOffline.current = false;
    } catch (error: any) {
      Alert.alert("Sign In Error", error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      // Sign out from Supabase first
      try {
        await supabase.auth.signOut();
      } catch (supabaseError) {
        console.error("Supabase signout failed:", supabaseError);
      }

      // Clear storage - but DON'T clear onboardingComplete
      await AsyncStorage.multiRemove([
        "isAuthenticated",
        "userId",
        "userProfile",
        "lastSyncTime",
        "offlineMode",
        // NOT "onboardingComplete" - keep this!
      ]);

      // Update state immediately - no setTimeout
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsOfflineMode(false);
      hasSyncedThisSession.current = false;
      wasOffline.current = false;
      setLoading(false);

    } catch (error) {
      console.error("Sign out error:", error);
      // Still clear state on error
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsOfflineMode(false);
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!user) throw new Error("No user logged in");

      // If offline, queue the update
      if (!isConnected) {
        const currentProfile = profile ? { ...profile, ...updates } : null;
        if (currentProfile) {
          setProfile(currentProfile as Profile);
          await AsyncStorage.setItem("userProfile", JSON.stringify(currentProfile));
          await AsyncStorage.setItem("pendingProfileUpdate", JSON.stringify(updates));
          console.log("📝 Profile update queued for sync (offline)");
        }
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      await AsyncStorage.setItem("userProfile", JSON.stringify(data));
    } catch (error: any) {
      Alert.alert("Update Error", error.message);
      throw error;
    }
  };

  const syncLocalData = async () => {
    try {
      if (!user) {
        return;
      }

      // Don't sync if offline
      if (!isConnected) {
        console.log("⏭️ Skipping sync - offline");
        return;
      }

      console.log("🔄 Starting sync for user:", user.id);

      // Check for pending profile updates first
      const pendingProfileUpdate = await AsyncStorage.getItem("pendingProfileUpdate");
      if (pendingProfileUpdate) {
        try {
          const updates = JSON.parse(pendingProfileUpdate);
          await supabase
            .from("profiles")
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);
          await AsyncStorage.removeItem("pendingProfileUpdate");
          console.log("✅ Pending profile update synced");
        } catch (profileSyncError) {
          console.error("❌ Failed to sync pending profile update:", profileSyncError);
        }
      }

      const result = await syncService.syncAllData(user.id);

      if (result.success) {
        const totalSynced =
          result.synced.activities +
          result.synced.locations +
          result.synced.achievements;
        console.log("🔄 Sync complete:", result.synced);
        if (totalSynced > 0) {
          Alert.alert(
            "Data Synced!",
            `Synced ${result.synced.activities} activities, ${result.synced.locations} locations`
          );
        }
      } else {
        console.error("Sync failed:", result.errors);
      }
    } catch (error) {
      console.error("Error syncing data:", error);
    }
  };

  const setOfflineMode = async (enabled: boolean) => {
    try {
      if (enabled) {
        await AsyncStorage.setItem("offlineMode", "true");
        setIsOfflineMode(true);
        wasOffline.current = true;
        if (session) {
          await supabase.auth.signOut();
        }
      } else {
        await AsyncStorage.removeItem("offlineMode");
        setIsOfflineMode(false);
        wasOffline.current = false;
      }
    } catch (error) {
      console.error("Error setting offline mode:", error);
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    isOfflineMode,
    isConnected,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
    syncLocalData,
    setOfflineMode,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};