// utils/date.ts

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