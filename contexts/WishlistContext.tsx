// contexts/WishlistContext.tsx - Complete with date support and Supabase integration
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { CategoryType } from '../constants/categories';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface WishlistItem {
  id: string;
  name: string;
  description?: string;
  location: LocationCoords;
  category: CategoryType;
  priority: number; // 1 = Must See, 2 = Want to See, 3 = Maybe Someday
  dateAdded: Date; // When added to wishlist
  createdAt: Date; // DB timestamp
  notes?: string;
  expectedVisitDate?: Date;
  estimatedCost?: number;
  links?: string[];
}

interface WishlistContextType {
  wishlistItems: WishlistItem[];
  addWishlistItem: (item: Omit<WishlistItem, 'id' | 'dateAdded' | 'createdAt'>) => Promise<void>;
  updateWishlistItem: (id: string, updates: Partial<WishlistItem>) => Promise<void>;
  removeWishlistItem: (id: string) => Promise<void>;
  convertToVisited: (id: string) => Promise<WishlistItem | null>;
  getWishlistByPriority: (priority: number) => WishlistItem[];
  getWishlistByCategory: (category: CategoryType) => WishlistItem[];
  loading: boolean;
  error: string | null;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Load wishlist when user changes
  useEffect(() => {
    if (user?.id) {
      loadWishlist();
    } else {
      setWishlistItems([]);
    }
  }, [user?.id]);

  // Subscribe to real-time changes
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('wishlist_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wishlist_items',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Wishlist change received:', payload);
          loadWishlist();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const loadWishlist = async () => {
    if (!user) {
      console.log('loadWishlist: No user present');
      setWishlistItems([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('Loading wishlist from Supabase for user:', user.id);

      const { data, error: fetchError } = await supabase
        .from('wishlist_items')
        .select('*')
        .eq('user_id', user.id)
        .order('date_added', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Supabase error loading wishlist:', fetchError);
        throw fetchError;
      }

      if (data && data.length > 0) {
        const transformedItems: WishlistItem[] = data.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          location: {
            latitude: item.latitude,
            longitude: item.longitude,
          },
          category: (item.category as CategoryType) || 'other',
          priority: item.priority || 2,
          dateAdded: item.date_added 
            ? new Date(item.date_added) 
            : new Date(item.created_at),
          createdAt: new Date(item.created_at),
          notes: item.notes,
          expectedVisitDate: item.expected_visit_date 
            ? new Date(item.expected_visit_date) 
            : undefined,
          estimatedCost: item.estimated_cost,
          links: item.links || [],
        }));
        setWishlistItems(transformedItems);
      } else {
        setWishlistItems([]);
      }
    } catch (err) {
      console.error('Error loading wishlist:', err);
      setError('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const refreshWishlist = async () => {
    await loadWishlist();
  };

  const addWishlistItem = async (
    item: Omit<WishlistItem, 'id' | 'dateAdded' | 'createdAt'>
  ) => {
    if (!user) {
      setError('Please sign in to add to wishlist');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: insertError } = await supabase
        .from('wishlist_items')
        .insert({
          user_id: user.id,
          name: item.name,
          description: item.description,
          latitude: item.location.latitude,
          longitude: item.location.longitude,
          category: item.category || 'other',
          priority: item.priority || 2,
          date_added: new Date().toISOString(),
          notes: item.notes,
          expected_visit_date: item.expectedVisitDate?.toISOString(),
          estimated_cost: item.estimatedCost
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        const newItem: WishlistItem = {
          id: data.id,
          name: data.name,
          description: data.description,
          location: {
            latitude: data.latitude,
            longitude: data.longitude,
          },
          category: (data.category as CategoryType) || 'other',
          priority: data.priority || 2,
          dateAdded: data.date_added 
            ? new Date(data.date_added) 
            : new Date(),
          createdAt: new Date(data.created_at),
          notes: data.notes,
          expectedVisitDate: data.expected_visit_date 
            ? new Date(data.expected_visit_date) 
            : undefined,
          estimatedCost: data.estimated_cost,
          links: []
        };

        setWishlistItems((prev) => [newItem, ...prev]);
      }

      console.log('Wishlist item added successfully');
    } catch (err) {
      console.error('Error adding wishlist item:', err);
      setError('Failed to add item to wishlist');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateWishlistItem = async (id: string, updates: Partial<WishlistItem>) => {
    if (!user) {
      setError('Please sign in to update wishlist');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const updateData: any = {
        name: updates.name,
        description: updates.description,
        category: updates.category,
        priority: updates.priority,
        notes: updates.notes,
        estimated_cost: updates.estimatedCost,
        links: updates.links,
      };

      if (updates.location) {
        updateData.latitude = updates.location.latitude;
        updateData.longitude = updates.location.longitude;
      }

      if (updates.expectedVisitDate) {
        updateData.expected_visit_date = updates.expectedVisitDate.toISOString();
      }

      const { error: updateError } = await supabase
        .from('wishlist_items')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setWishlistItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );

      console.log('Wishlist item updated successfully');
    } catch (err) {
      console.error('Error updating wishlist item:', err);
      setError('Failed to update wishlist item');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeWishlistItem = async (id: string) => {
    if (!user) {
      setError('Please sign in to remove from wishlist');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('wishlist_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setWishlistItems((prev) => prev.filter((item) => item.id !== id));

    } catch (err) {
      console.error('Error removing wishlist item:', err);
      setError('Failed to remove item from wishlist');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const convertToVisited = async (id: string): Promise<WishlistItem | null> => {
    try {
      const item = wishlistItems.find((item) => item.id === id);
      if (!item) return null;

      // Remove from wishlist
      await removeWishlistItem(id);

      // Return the item so it can be added to saved locations
      return item;
    } catch (err) {
      console.error('Error converting wishlist item:', err);
      setError('Failed to convert wishlist item');
      return null;
    }
  };

  const getWishlistByPriority = (priority: number): WishlistItem[] => {
    return wishlistItems.filter((item) => item.priority === priority);
  };

  const getWishlistByCategory = (category: CategoryType): WishlistItem[] => {
    return wishlistItems.filter((item) => item.category === category);
  };

  const value: WishlistContextType = {
    wishlistItems,
    addWishlistItem,
    updateWishlistItem,
    removeWishlistItem,
    convertToVisited,
    getWishlistByPriority,
    getWishlistByCategory,
    loading,
    error,
    refreshWishlist,
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};

export type { WishlistItem };
