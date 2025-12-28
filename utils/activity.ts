
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

export const getActivityIcon = (type: string): string => {
  const icons: Record<string, string> = {
    bike: "bicycle",
    run: "walk",
    walk: "footsteps",
    hike: "trail-sign",
    paddleboard: "boat",
    climb: "trending-up",
    other: "fitness",
  };
  return icons[type] || "fitness";
};

export const getActivityTypeLabel = (type: string): string => {
  return type.charAt(0).toUpperCase() + type.slice(1);
};