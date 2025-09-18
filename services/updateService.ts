// services/updateService.tsx
import * as Application from "expo-application";
import * as Linking from "expo-linking";
import React, { useEffect } from "react";
import { Alert, Platform } from "react-native";
import { supabase } from "../lib/supabase";

interface AppVersion {
  id: string;
  version: string;
  build_number: number;
  release_date: string;
  is_required: boolean;
  features: string[];
  download_url?: string;
}

export class UpdateService {
  static async checkForUpdates(): Promise<boolean> {
    try {
      // Add safety check for app initialization
      if (!Application.nativeApplicationVersion) {
        console.log("App not fully initialized, skipping update check");
        return false;
      }

      // Get current app version
      const currentVersion = Application.nativeApplicationVersion || "1.0.0";
      const currentBuildNumber = Application.nativeBuildVersion || "1";

      // Fetch latest version from your database
      const { data: latestVersion, error } = await supabase
        .from("app_versions")
        .select("*")
        .order("build_number", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error("Error checking for updates:", error);
        return false;
      }

      if (!latestVersion) return false;

      // Compare versions
      const needsUpdate =
        this.compareVersions(currentVersion, latestVersion.version) < 0;

      if (needsUpdate) {
        this.promptForUpdate(latestVersion, latestVersion.is_required);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Update check failed:", error);
      return false;
    }
  }

  private static compareVersions(current: string, latest: string): number {
    const currentParts = current.split(".").map(Number);
    const latestParts = latest.split(".").map(Number);

    for (
      let i = 0;
      i < Math.max(currentParts.length, latestParts.length);
      i++
    ) {
      const currentPart = currentParts[i] || 0;
      const latestPart = latestParts[i] || 0;

      if (currentPart < latestPart) return -1;
      if (currentPart > latestPart) return 1;
    }

    return 0;
  }

  private static promptForUpdate(version: AppVersion, isRequired: boolean) {
    const message =
      version.features?.length > 0
        ? `Version ${
            version.version
          } is available!\n\nWhat's new:\n${version.features
            .map((f) => `• ${f}`)
            .join("\n")}`
        : `Version ${version.version} is available with bug fixes and improvements.`;

    if (isRequired) {
      Alert.alert(
        "Update Required",
        message,
        [
          {
            text: "Update Now",
            onPress: () => this.openStore(),
            style: "default",
          },
        ],
        { cancelable: false }
      );
    } else {
      Alert.alert("Update Available", message, [
        {
          text: "Later",
          style: "cancel",
        },
        {
          text: "Update Now",
          onPress: () => this.openStore(),
          style: "default",
        },
      ]);
    }
  }

  static openStore() {
    const storeUrl = Platform.select({
      ios: "https://apps.apple.com/app/explorable/id[YOUR_APP_STORE_ID]",
      android:
        "https://play.google.com/store/apps/details?id=com.moser.explorable",
    });

    if (storeUrl) {
      Linking.openURL(storeUrl);
    }
  }
}

export function UpdateChecker({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // CRITICAL: Delay the initial update check to let app fully initialize
    const initialCheckTimer = setTimeout(() => {
      UpdateService.checkForUpdates();
    }, 3000); // 3 second delay

    // Check periodically (every 4 hours)
    const interval = setInterval(() => {
      UpdateService.checkForUpdates();
    }, 4 * 60 * 60 * 1000);

    return () => {
      clearTimeout(initialCheckTimer);
      clearInterval(interval);
    };
  }, []);

  return children as React.ReactElement;
}
