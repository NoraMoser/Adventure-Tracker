// contexts/AuthContext.tsx - Clean, working version
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  const lastRefresh = useRef<Date>(new Date());
  const hasSyncedThisSession = useRef(false);

  // Initialize auth state
  useEffect(() => {
    console.log("🔍 AuthContext: Starting initialization...");
    checkAuthStatus();

    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔍 Auth state changed:", event);

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
    console.log("🔍 AuthContext: Checking auth status...");
    try {
      const timeoutId = setTimeout(() => {
        console.log("🔍 AuthContext: Timeout - forcing loading to false");
        setLoading(false);
      }, 5000);

      const offlineMode = await AsyncStorage.getItem("offlineMode");
      console.log("🔍 AuthContext: Offline mode check:", offlineMode);

      if (offlineMode === "true") {
        console.log("🔍 AuthContext: Setting offline mode");
        setIsOfflineMode(true);
        clearTimeout(timeoutId);
        setLoading(false);
        return;
      }

      console.log("🔍 AuthContext: Getting session from Supabase...");
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

      console.log(
        "🔍 AuthContext: Session result:",
        session ? "Found session" : "No session"
      );

      if (session) {
        setSession(session);
        setUser(session.user);
        console.log(
          "🔍 AuthContext: Loading profile for user:",
          session.user.id
        );

        await loadProfile(session.user.id);
        await updateLastActive(session.user.id);
      }

      clearTimeout(timeoutId);
      console.log(
        "🔍 AuthContext: Auth check complete, setting loading to false"
      );
      setLoading(false);
    } catch (error) {
      console.error("🔍 AuthContext: Critical auth check error:", error);
      setLoading(false);
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      console.log("🔍 AuthContext: Loading profile for:", userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("🔍 AuthContext: Profile load error:", error);
        return;
      }

      console.log("🔍 AuthContext: Profile loaded successfully");
      setProfile(data);
      await AsyncStorage.setItem("userProfile", JSON.stringify(data));
    } catch (error) {
      console.error("🔍 AuthContext: Error loading profile:", error);
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
      const now = new Date();
      const timeSince = now.getTime() - lastRefresh.current.getTime();

      console.log("🔄 Session refresh check:", {
        timeSinceLastRefresh: `${(timeSince / 1000).toFixed(1)}s`,
        willRefresh: timeSince >= 300000, // 5 minutes
      });

      if (timeSince < 300000) {
        return true;
      }

      console.log("🔄 Starting refresh...");

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
        console.log("✅ Got new session, updating state...");
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
      console.log("🔍 AuthContext: Updating last active for:", userId);
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

      console.log("User created successfully:", data.user.id);

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
      console.log("Sign in successful - auth state listener will handle sync");
    } catch (error: any) {
      Alert.alert("Sign In Error", error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      // Don't set loading immediately - it might cause render issues
      // setLoading(true);

      // Sign out from Supabase first
      try {
        await supabase.auth.signOut();
      } catch (supabaseError) {
        console.error("Supabase signout failed:", supabaseError);
      }

      // Clear storage
      await AsyncStorage.multiRemove([
        "isAuthenticated",
        "userId",
        "userProfile",
        "lastSyncTime",
        "offlineMode",
      ]);

      // Use setTimeout to ensure state updates happen after navigation
      setTimeout(() => {
        setUser(null);
        setProfile(null);
        setSession(null);
        setIsOfflineMode(false);
        hasSyncedThisSession.current = false;
        setLoading(false);
      }, 100);

      console.log("Sign out completed");
    } catch (error) {
      console.error("Sign out error:", error);
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
        console.log("No user logged in, skipping sync");
        return;
      }

      console.log("Starting data sync for user:", user.id);
      const result = await syncService.syncAllData(user.id);

      if (result.success) {
        const totalSynced =
          result.synced.activities +
          result.synced.locations +
          result.synced.achievements;
        if (totalSynced > 0) {
          console.log(`Successfully synced ${totalSynced} items`);
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
        if (session) {
          await supabase.auth.signOut();
        }
      } else {
        await AsyncStorage.removeItem("offlineMode");
        setIsOfflineMode(false);
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
