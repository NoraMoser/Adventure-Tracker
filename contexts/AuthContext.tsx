// contexts/AuthContext.tsx - Complete fixed version
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

  useEffect(() => {
    console.log("🔍 AuthContext: Starting initialization...");
    checkAuthStatus();
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

        loadProfile(session.user.id).catch((err) => {
          console.error(
            "🔍 AuthContext: Profile load error (non-blocking):",
            err
          );
        });

        updateLastActive(session.user.id).catch((err) => {
          console.error(
            "🔍 AuthContext: Last active update error (non-blocking):",
            err
          );
        });

        console.log("🔍 AuthContext: Skipping auto-sync to prevent duplicates");
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

  // In AuthContext.tsx, replace refreshSession with this version that has a timeout:
  const refreshSession = async (): Promise<boolean> => {
    try {
      const now = new Date();
      const timeSince = now.getTime() - lastRefresh.current.getTime();

      console.log("🔄 Session refresh check:", {
        timeSinceLastRefresh: `${(timeSince / 1000).toFixed(1)}s`,
        willRefresh: timeSince >= 5000,
      });

      // In AuthContext refreshSession:
      if (timeSince < 300000) {
        // 5 minutes instead of 5 seconds
        return true;
      }

      console.log("🔄 Starting refresh...");

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Refresh timeout")), 5000)
      );

      // Create the refresh promise
      const refreshPromise = supabase.auth.refreshSession();

      // Race them - if refresh takes more than 5 seconds, timeout
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
        console.log("✅ Got new session, updating client...");

        // Update the Supabase client with new tokens
        const { error: setError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (setError) {
          console.error("❌ Failed to set session:", setError);
          return false;
        }

        console.log("✅ Session updated in client");
        setSession(data.session);
        setUser(data.session.user);
        lastRefresh.current = new Date();

        // Quick test to verify it works
        const { error: testError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.session.user.id)
          .single();

        if (testError) {
          console.error("❌ DB test failed:", testError);
          return false;
        }

        console.log("✅ DB connection verified");
        return true;
      }

      console.error("❌ No session returned");
      return false;
    } catch (error) {
      console.error("💥 Refresh error:", error);
      return false;
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
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!profile) {
        console.log("Profile not auto-created, creating manually...");
        const { error: insertError } = await supabase.from("profiles").insert({
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

        if (insertError && !insertError.message.includes("duplicate")) {
          console.error("Profile creation error:", insertError);
        }
      }

      await AsyncStorage.setItem("isAuthenticated", "true");
      await AsyncStorage.setItem("userId", data.user.id);

      Alert.alert(
        "Welcome to explorAble!",
        "Your account has been created successfully!"
      );
      await syncLocalData();
    } catch (error: any) {
      console.error("Signup error details:", error);

      let errorMessage = error.message;
      if (error.message.includes("duplicate key")) {
        if (error.message.includes("profiles_pkey")) {
          errorMessage = "An account already exists. Please sign in instead.";
        } else if (error.message.includes("username")) {
          errorMessage =
            "This username is already taken. Please choose another.";
        }
      } else if (error.message.includes("Password should be")) {
        errorMessage = "Password must be at least 6 characters long.";
      } else if (error.message.includes("Invalid email")) {
        errorMessage = "Please enter a valid email address.";
      }

      Alert.alert("Sign Up Error", errorMessage);
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

      await AsyncStorage.setItem("isAuthenticated", "true");
      await AsyncStorage.setItem("userId", data.user.id);
      await AsyncStorage.removeItem("offlineMode");

      setIsOfflineMode(false);
      console.log("Skipping auto-sync on sign in to prevent duplicates");
    } catch (error: any) {
      Alert.alert("Sign In Error", error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);

      setUser(null);
      setProfile(null);
      setSession(null);
      setIsOfflineMode(false);

      try {
        const { error } = await supabase.auth.signOut();
        if (error && !error.message.includes("session")) {
          console.error("Supabase signOut error:", error);
        }
      } catch (supabaseError) {
        console.error("Supabase signout failed:", supabaseError);
      }

      await AsyncStorage.multiRemove([
        "isAuthenticated",
        "userId",
        "userProfile",
        "lastSyncTime",
        "offlineMode",
      ]);

      console.log("Sign out completed");
    } catch (error) {
      console.error("Sign out error:", error);
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsOfflineMode(false);
    } finally {
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

  console.log("🔍 AuthContext: Current state:", {
    hasUser: !!user,
    hasProfile: !!profile,
    hasSession: !!session,
    loading,
    isOfflineMode,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
