// contexts/WishlistContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { CategoryType } from '../constants/categories';

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
  createdAt: Date;
  notes?: string;
  expectedVisitDate?: Date;
  estimatedCost?: number;
  links?: string[];
}

interface WishlistContextType {
  wishlistItems: WishlistItem[];
  addWishlistItem: (item: Omit<WishlistItem, 'id' | 'createdAt'>) => Promise<void>;
  updateWishlistItem: (id: string, updates: Partial<WishlistItem>) => Promise<void>;
  removeWishlistItem: (id: string) => Promise<void>;
  convertToVisited: (id: string) => Promise<WishlistItem | null>;
  getWishlistByPriority: (priority: number) => WishlistItem[];
  getWishlistByCategory: (category: CategoryType) => WishlistItem[];
  loading: boolean;
  error: string | null;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load wishlist from AsyncStorage on mount
  useEffect(() => {
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    try {
      setLoading(true);
      const wishlistJson = await AsyncStorage.getItem('wishlist');
      if (wishlistJson) {
        const items = JSON.parse(wishlistJson);
        // Convert date strings back to Date objects
        const parsedItems = items.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          expectedVisitDate: item.expectedVisitDate ? new Date(item.expectedVisitDate) : undefined,
        }));
        setWishlistItems(parsedItems);
      }
    } catch (err) {
      console.error('Error loading wishlist:', err);
      setError('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const saveWishlist = async (items: WishlistItem[]) => {
    try {
      await AsyncStorage.setItem('wishlist', JSON.stringify(items));
    } catch (err) {
      console.error('Error saving wishlist:', err);
      setError('Failed to save wishlist');
    }
  };

  const addWishlistItem = async (item: Omit<WishlistItem, 'id' | 'createdAt'>) => {
    try {
      const newItem: WishlistItem = {
        ...item,
        id: Date.now().toString(),
        createdAt: new Date(),
      };

      const updatedItems = [...wishlistItems, newItem];
      setWishlistItems(updatedItems);
      await saveWishlist(updatedItems);
    } catch (err) {
      console.error('Error adding wishlist item:', err);
      setError('Failed to add item to wishlist');
    }
  };

  const updateWishlistItem = async (id: string, updates: Partial<WishlistItem>) => {
    try {
      const updatedItems = wishlistItems.map(item =>
        item.id === id ? { ...item, ...updates } : item
      );
      setWishlistItems(updatedItems);
      await saveWishlist(updatedItems);
    } catch (err) {
      console.error('Error updating wishlist item:', err);
      setError('Failed to update wishlist item');
    }
  };

  const removeWishlistItem = async (id: string) => {
    try {
      const updatedItems = wishlistItems.filter(item => item.id !== id);
      setWishlistItems(updatedItems);
      await saveWishlist(updatedItems);
    } catch (err) {
      console.error('Error removing wishlist item:', err);
      setError('Failed to remove item from wishlist');
    }
  };

  const convertToVisited = async (id: string): Promise<WishlistItem | null> => {
    try {
      const item = wishlistItems.find(item => item.id === id);
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
    return wishlistItems.filter(item => item.priority === priority);
  };

  const getWishlistByCategory = (category: CategoryType): WishlistItem[] => {
    return wishlistItems.filter(item => item.category === category);
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
