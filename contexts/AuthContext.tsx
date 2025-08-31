// contexts/AuthContext.tsx - Fixed version
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
  profile_picture?: string | null; // Add this line
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

  // Simple refresh that doesn't interfere with other operations
  const refreshSession = async (): Promise<boolean> => {
    try {
      // Only refresh if it's been more than 30 seconds
      const now = new Date();
      const timeSince = now.getTime() - lastRefresh.current.getTime();
      if (timeSince < 30000) {
        return true; // Session is fresh enough
      }

      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error("Session refresh error:", error);
        return false;
      }

      if (data?.session) {
        setSession(data.session);
        setUser(data.session.user);
        lastRefresh.current = new Date();
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error refreshing session:", error);
      return false;
    }
  };

  useEffect(() => {
    console.log("🔍 AuthContext: Starting initialization...");
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    console.log("🔍 AuthContext: Checking auth status...");
    try {
      // Set a timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.log("🔍 AuthContext: Timeout - forcing loading to false");
        setLoading(false);
      }, 5000); // 5 second timeout

      // Check if user chose offline mode
      const offlineMode = await AsyncStorage.getItem("offlineMode");
      console.log("🔍 AuthContext: Offline mode check:", offlineMode);

      if (offlineMode === "true") {
        console.log("🔍 AuthContext: Setting offline mode");
        setIsOfflineMode(true);
        clearTimeout(timeoutId);
        setLoading(false);
        return;
      }

      // Check for existing session
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

        // Don't await profile loading - do it in background
        loadProfile(session.user.id).catch((err) => {
          console.error(
            "🔍 AuthContext: Profile load error (non-blocking):",
            err
          );
        });

        // Update last active in background
        updateLastActive(session.user.id).catch((err) => {
          console.error(
            "🔍 AuthContext: Last active update error (non-blocking):",
            err
          );
        });

        // DON'T auto-sync on every login - this causes duplicates
        // Only sync if explicitly requested or after certain actions
        console.log("🔍 AuthContext: Skipping auto-sync to prevent duplicates");
      }

      clearTimeout(timeoutId);
      console.log(
        "🔍 AuthContext: Auth check complete, setting loading to false"
      );
      setLoading(false);
    } catch (error) {
      console.error("🔍 AuthContext: Critical auth check error:", error);
      setLoading(false); // Make sure loading is set to false even on error
    }
  };

  // Listen for auth changes
  useEffect(() => {
    console.log("🔍 AuthContext: Setting up auth state listener...");
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("🔍 AuthContext: Auth state changed:", _event);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadProfile(session.user.id);
        await updateLastActive(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

      // Save profile to local storage for offline access
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
        // Also update local storage
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
      // Don't throw - this is non-critical
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

      // First, thoroughly check if username is already taken
      const { data: existingUser, error: checkError } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        throw new Error("Username already taken. Please choose another.");
      }

      // Sign up the user WITH metadata in the options
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

        // Check for specific error types
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

      // Wait a moment for the trigger to create the profile
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify profile was created
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!profile) {
        console.log("Profile not auto-created, creating manually...");

        // Only try to create if it doesn't exist
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

        // If insert fails due to duplicate, that's OK - trigger might have just created it
        if (insertError && !insertError.message.includes("duplicate")) {
          console.error("Profile creation error:", insertError);
        }
      }

      // Save auth state
      await AsyncStorage.setItem("isAuthenticated", "true");
      await AsyncStorage.setItem("userId", data.user.id);

      Alert.alert(
        "Welcome to explorAble!",
        "Your account has been created successfully!"
      );

      // After signup, sync any existing local data
      await syncLocalData();
    } catch (error: any) {
      console.error("Signup error details:", error);

      // Provide user-friendly error messages
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

      // Save auth state
      await AsyncStorage.setItem("isAuthenticated", "true");
      await AsyncStorage.setItem("userId", data.user.id);
      await AsyncStorage.removeItem("offlineMode");

      setIsOfflineMode(false);

      // DON'T auto-sync on sign in - let user manually sync if needed
      // This prevents duplicate locations being created
      console.log("Skipping auto-sync on sign in to prevent duplicates");

      // Optional: Show a message to user about syncing
      // Alert.alert('Signed In', 'You can manually sync your data from Settings if needed.');
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

      // Clear state FIRST before async operations
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsOfflineMode(false);

      // Then attempt Supabase signout
      try {
        const { error } = await supabase.auth.signOut();
        if (error && !error.message.includes("session")) {
          console.error("Supabase signOut error:", error);
        }
      } catch (supabaseError) {
        console.error("Supabase signout failed:", supabaseError);
        // Continue with local cleanup even if Supabase fails
      }

      // Clear only auth-related storage, NOT onboarding
      await AsyncStorage.multiRemove([
        "isAuthenticated",
        "userId",
        "userProfile",
        "lastSyncTime",
        "offlineMode",
        // Don't clear "onboardingComplete" here
      ]);

      console.log("Sign out completed");
    } catch (error) {
      console.error("Sign out error:", error);
      // Still ensure state is cleared on error
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

        // Sign out from Supabase but keep using the app
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
    refreshSession
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
