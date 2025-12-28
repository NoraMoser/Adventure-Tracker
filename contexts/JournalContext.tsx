import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export interface JournalEntry {
  id: string;
  user_id: string;
  title?: string;
  content: string;
  mood?: string;
  photos?: string[];
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  trip_id?: string;
  activity_id?: string;
  spot_id?: string;
  weather?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  trip?: {
    id: string;
    name: string;
  };
  activity?: {
    id: string;
    name: string;
    type: string;
  };
  spot?: {
    id: string;
    name: string;
  };
}

interface JournalContextType {
  entries: JournalEntry[];
  loading: boolean;
  error: string | null;
  
  createEntry: (entry: Partial<JournalEntry>) => Promise<JournalEntry | null>;
  updateEntry: (id: string, updates: Partial<JournalEntry>) => Promise<boolean>;
  deleteEntry: (id: string) => Promise<boolean>;
  refreshEntries: () => Promise<void>;
  
  getEntriesForTrip: (tripId: string) => JournalEntry[];
  getEntriesForActivity: (activityId: string) => JournalEntry[];
  getEntriesForSpot: (spotId: string) => JournalEntry[];
  getEntryById: (id: string) => JournalEntry | undefined;
}

const JournalContext = createContext<JournalContextType | undefined>(undefined);

export const JournalProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load entries when user changes
  useEffect(() => {
    if (user) {
      loadEntries();
    } else {
      setEntries([]);
    }
  }, [user]);

  const loadEntries = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("journal_entries")
        .select(`
          *,
          trip:trips(id, name),
          activity:activities(id, name, type),
          spot:locations(id, name)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setEntries(data || []);
    } catch (err: any) {
      console.error("Error loading journal entries:", err);
      setError("Failed to load journal entries");
    } finally {
      setLoading(false);
    }
  };

  const createEntry = async (entry: Partial<JournalEntry>): Promise<JournalEntry | null> => {
    if (!user) {
      Alert.alert("Error", "Please sign in to create journal entries");
      return null;
    }

    if (!entry.content?.trim()) {
      Alert.alert("Error", "Please write something in your journal entry");
      return null;
    }

    try {
      const newEntry = {
        user_id: user.id,
        title: entry.title?.trim() || null,
        content: entry.content.trim(),
        mood: entry.mood || null,
        photos: entry.photos || [],
        location: entry.location || null,
        trip_id: entry.trip_id || null,
        activity_id: entry.activity_id || null,
        spot_id: entry.spot_id || null,
        weather: entry.weather || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error: insertError } = await supabase
        .from("journal_entries")
        .insert(newEntry)
        .select(`
          *,
          trip:trips(id, name),
          activity:activities(id, name, type),
          spot:locations(id, name)
        `)
        .single();

      if (insertError) {
        throw insertError;
      }

      // Add to local state
      setEntries((prev) => [data, ...prev]);

      return data;
    } catch (err: any) {
      console.error("Error creating journal entry:", err);
      Alert.alert("Error", "Failed to create journal entry");
      return null;
    }
  };

  const updateEntry = async (id: string, updates: Partial<JournalEntry>): Promise<boolean> => {
    if (!user) return false;

    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Remove joined data from updates
      delete updateData.trip;
      delete updateData.activity;
      delete updateData.spot;
      delete updateData.id;
      delete updateData.user_id;
      delete updateData.created_at;

      const { data, error: updateError } = await supabase
        .from("journal_entries")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", user.id)
        .select(`
          *,
          trip:trips(id, name),
          activity:activities(id, name, type),
          spot:locations(id, name)
        `)
        .single();

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setEntries((prev) =>
        prev.map((entry) => (entry.id === id ? data : entry))
      );

      return true;
    } catch (err: any) {
      console.error("Error updating journal entry:", err);
      Alert.alert("Error", "Failed to update journal entry");
      return false;
    }
  };

  const deleteEntry = async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: deleteError } = await supabase
        .from("journal_entries")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      // Remove from local state
      setEntries((prev) => prev.filter((entry) => entry.id !== id));

      return true;
    } catch (err: any) {
      console.error("Error deleting journal entry:", err);
      Alert.alert("Error", "Failed to delete journal entry");
      return false;
    }
  };

  const refreshEntries = async () => {
    await loadEntries();
  };

  const getEntriesForTrip = (tripId: string): JournalEntry[] => {
    return entries.filter((entry) => entry.trip_id === tripId);
  };

  const getEntriesForActivity = (activityId: string): JournalEntry[] => {
    return entries.filter((entry) => entry.activity_id === activityId);
  };

  const getEntriesForSpot = (spotId: string): JournalEntry[] => {
    return entries.filter((entry) => entry.spot_id === spotId);
  };

  const getEntryById = (id: string): JournalEntry | undefined => {
    return entries.find((entry) => entry.id === id);
  };

  const value: JournalContextType = {
    entries,
    loading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
    refreshEntries,
    getEntriesForTrip,
    getEntriesForActivity,
    getEntriesForSpot,
    getEntryById,
  };

  return (
    <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
  );
};

export const useJournal = () => {
  const context = useContext(JournalContext);
  if (!context) {
    throw new Error("useJournal must be used within JournalProvider");
  }
  return context;
};