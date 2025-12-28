import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ExplorableLogo } from "../../components/Logo";
import { theme } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");

const handleLogin = async () => {
  if (!email || !password) {
    Alert.alert("Error", "Please fill in all fields");
    return;
  }

  try {
    setLoading(true);

    // Step 1: Sign in
    setSyncStatus("Signing in...");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("Login failed");

    // Step 2: Check if profile exists
    setSyncStatus("Loading profile...");
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      // First time user - need to complete profile
      router.replace("/auth/complete-profile");
      return;
    }
    
    // Step 3: Save auth state (optional - Supabase handles this)
    await AsyncStorage.setItem("isAuthenticated", "true");
    await AsyncStorage.setItem("userId", data.user.id);

    // Step 4: Navigate - the AuthContext will handle sync
    setSyncStatus("Redirecting...");
    
    setTimeout(() => {
      router.replace("/");
    }, 100);
    
  } catch (error: any) {
    console.error("Login error:", error);
    Alert.alert(
      "Login Failed",
      error.message || "Please check your email and password"
    );
  } finally {
    setLoading(false);
    setSyncStatus("");
  }
};

  const handleContinueOffline = async () => {
    await AsyncStorage.setItem("offlineMode", "true");
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <ExplorableLogo width={200} variant="default" />
            <Text style={styles.tagline}>Track. Save. Explore.</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to sync your adventures</Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={theme.colors.gray}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholderTextColor={theme.colors.lightGray}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={theme.colors.gray}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor={theme.colors.lightGray}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={theme.colors.gray}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.loginButtonText}>
                    {syncStatus || "Signing in..."}
                  </Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Do not have an account? </Text>
            <Link href="/auth/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Offline Mode */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.offlineButton}
            onPress={handleContinueOffline}
            disabled={loading}
          >
            <Ionicons name="airplane" size={20} color={theme.colors.forest} />
            <Text style={styles.offlineButtonText}>Continue Offline</Text>
          </TouchableOpacity>

          <Text style={styles.offlineNote}>
            You can still use the app offline and sync your data later
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  tagline: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 8,
  },
  formContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.colors.navy,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.navy,
  },
  eyeIcon: {
    padding: 5,
  },
  loginButton: {
    backgroundColor: theme.colors.forest,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  forgotPassword: {
    alignItems: "center",
    marginTop: 15,
  },
  forgotPasswordText: {
    color: theme.colors.forest,
    fontSize: 14,
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 30,
  },
  signupText: {
    color: theme.colors.gray,
    fontSize: 14,
  },
  signupLink: {
    color: theme.colors.forest,
    fontSize: 14,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 30,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderGray,
  },
  dividerText: {
    marginHorizontal: 15,
    color: theme.colors.gray,
    fontSize: 12,
  },
  offlineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: theme.colors.forest,
  },
  offlineButtonText: {
    color: theme.colors.forest,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  offlineNote: {
    textAlign: "center",
    color: theme.colors.gray,
    fontSize: 12,
    marginTop: 10,
  },
});
