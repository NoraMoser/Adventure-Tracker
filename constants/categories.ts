export type CategoryType = 
  | 'beach'
  | 'trail'
  | 'restaurant'
  | 'viewpoint'
  | 'camping'
  | 'water'
  | 'climbing'
  | 'historic'
  | 'shopping'
  | 'accommodation'
  | 'transit'
  | 'entertainment'
  | 'other';

export interface Category {
  id: CategoryType;
  label: string;
  icon: any;
  color: string;
  mapColor: string; // For map markers
}

export const categories: Record<CategoryType, Category> = {
  beach: {
    id: 'beach',
    label: 'Beach',
    icon: 'umbrella' as any,
    color: '#cc5500', // burnt orange
    mapColor: '#ff6b00',
  },
  trail: {
    id: 'trail',
    label: 'Trail',
    icon: 'walk' as any,
    color: '#2d5a3d', // forest green
    mapColor: '#3a7a4f',
  },
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant',
    icon: 'restaurant' as any,
    color: '#1e3a5f', // navy
    mapColor: '#2a4a70',
  },
  viewpoint: {
    id: 'viewpoint',
    label: 'Viewpoint',
    icon: 'camera' as any,
    color: '#8b5cf6', // purple
    mapColor: '#a78bfa',
  },
  camping: {
    id: 'camping',
    label: 'Camping',
    icon: 'bonfire' as any,
    color: '#059669', // emerald
    mapColor: '#10b981',
  },
  water: {
    id: 'water',
    label: 'Water Access',
    icon: 'boat' as any,
    color: '#0891b2', // cyan
    mapColor: '#06b6d4',
  },
  climbing: {
    id: 'climbing',
    label: 'Climbing',
    icon: 'trending-up' as any,
    color: '#dc2626', // red
    mapColor: '#ef4444',
  },
  historic: {
    id: 'historic',
    label: 'Historic Site',
    icon: 'business' as any,
    color: '#7c3aed', // violet
    mapColor: '#8b5cf6',
  },
  shopping: {
    id: 'shopping',
    label: 'Shopping',
    icon: 'cart' as any,
    color: '#db2777', // pink
    mapColor: '#ec4899',
  },
  accommodation: {
    id: 'accommodation',
    label: 'Accommodation',
    icon: 'bed' as any,
    color: '#d97706', // amber
    mapColor: '#f59e0b',
  },
  transit: {
    id: 'transit',
    label: 'Transit',
    icon: 'train' as any,
    color: '#14b8a6', // teal
    mapColor: '#2dd4bf',
  },
  entertainment: {
    id: 'entertainment',
    label: 'Entertainment',
    icon: 'game-controller' as any,
    color: '#3b82f6', // bright blue
    mapColor: '#60a5fa',
  },
  other: {
    id: 'other',
    label: 'Other',
    icon: 'location' as any,
    color: '#6b7280', // gray
    mapColor: '#9ca3af',
  },
};

export const categoryList = Object.values(categories);

export const getCategoryById = (id: CategoryType): Category => {
  return categories[id] || categories.other;
};

export const getDefaultCategory = (): CategoryType => {
  return 'other';
};