// contexts/SettingsContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type DistanceUnit = "metric" | "imperial";
export type ActivityType =
  | "bike"
  | "run"
  | "walk"
  | "hike"
  | "paddleboard"
  | "climb"
  | "other";

interface Settings {
  units: DistanceUnit;
  defaultActivityType: ActivityType;
  notifications: boolean;
  autoSave: boolean;
  mapStyle: "standard" | "satellite" | "terrain";
  privacy: {
    shareLocation: boolean;
    publicProfile: boolean;
  };
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  formatDistance: (meters: number, decimals?: number) => string;
  formatSpeed: (kmh: number) => string;
  formatElevation: (meters: number) => string;
  convertDistance: (meters: number) => number;
  getDistanceUnit: () => string;
  getSpeedUnit: () => string;
  getMapTileUrl: () => string;
}

const DEFAULT_SETTINGS: Settings = {
  units: "metric",
  defaultActivityType: "bike",
  notifications: true,
  autoSave: true,
  mapStyle: "standard",
  privacy: {
    shareLocation: false,
    publicProfile: false,
  },
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem("explorableSettings");
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const updateSettings = async (updates: Partial<Settings>) => {
    try {
      const newSettings = { ...settings, ...updates };
      await AsyncStorage.setItem(
        "explorableSettings",
        JSON.stringify(newSettings)
      );
      setSettings(newSettings);
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    }
  };

  // Conversion utilities
  const convertDistance = (meters: number): number => {
    if (settings.units === "imperial") {
      return meters * 0.000621371; // Convert to miles
    }
    return meters / 1000; // Convert to kilometers
  };

  const formatDistance = (meters: number, decimals: number = 2): string => {
    const converted = convertDistance(meters);
    const unit = settings.units === "imperial" ? "mi" : "km";

    // For very small distances, show in feet or meters
    if (meters < 100) {
      if (settings.units === "imperial") {
        const feet = meters * 3.28084;
        return `${feet.toFixed(0)} ft`;
      }
      return `${meters.toFixed(0)} m`;
    }

    return `${converted.toFixed(decimals)} ${unit}`;
  };

  const formatSpeed = (kmh: number): string => {
    if (settings.units === "imperial") {
      const mph = kmh * 0.621371;
      return `${mph.toFixed(1)} mph`;
    }
    return `${kmh.toFixed(1)} km/h`;
  };

  const formatElevation = (meters: number): string => {
    if (settings.units === "imperial") {
      const feet = meters * 3.28084;
      return `${feet.toFixed(0)} ft`;
    }
    return `${meters.toFixed(0)} m`;
  };

  const getDistanceUnit = (): string => {
    return settings.units === "imperial" ? "miles" : "kilometers";
  };

  const getSpeedUnit = (): string => {
    return settings.units === "imperial" ? "mph" : "km/h";
  };

  // In your SettingsContext.tsx, make sure getMapTileUrl looks like this:

  // In SettingsContext.tsx, replace the getMapTileUrl function with this:

  const getMapTileUrl = () => {
    switch (settings.mapStyle) {
      case "satellite":
        // Esri World Imagery
        return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

      case "terrain":
        // OpenTopoMap - use the 'a' subdomain as primary
        // Note: Don't use {s} placeholder for OpenTopoMap in WebView
        return "https://a.tile.opentopomap.org/{z}/{x}/{y}.png";

      case "standard":
      default:
        // OpenStreetMap - don't use {s} in WebView to avoid issues
        return "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        formatDistance,
        formatSpeed,
        formatElevation,
        convertDistance,
        getDistanceUnit,
        getSpeedUnit,
        getMapTileUrl,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
