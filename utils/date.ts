// utils/date.ts

export const normalizeDate = (date: Date | string): Date => {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

export const setEndOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const getLastActiveText = (lastActive?: Date): string => {
  if (!lastActive) return "Offline";

  const now = new Date();
  const diff = now.getTime() - new Date(lastActive).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 5) return "Online now";
  if (hours < 1) return `Active ${minutes}m ago`;
  if (days < 1) return `Active ${hours}h ago`;
  if (days === 1) return "Active yesterday";
  return `Active ${days} days ago`;
};

export const isOnlineNow = (lastActive?: Date): boolean => {
  if (!lastActive) return false;
  return new Date().getTime() - new Date(lastActive).getTime() < 300000; // 5 minutes
};

export const formatFriendsSince = (date: Date): string => {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};