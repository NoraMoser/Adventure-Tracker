import { useMemo } from "react";

export interface DayData {
  date: Date;
  activities: any[];
  locations: any[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

export interface MonthStats {
  activities: number;
  locations: number;
  distance: number;
  duration: number;
  activeDays: number;
}

export function useCalendarData(
  currentDate: Date,
  activities: any[],
  savedSpots: any[]
) {
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: DayData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      const dayActivities = activities.filter((a) => {
        const activityDateStr = new Date(a.activityDate || a.startTime)
          .toISOString()
          .split("T")[0];
        return activityDateStr === dateStr;
      });

      const dayLocations = savedSpots.filter((l) => {
        const locationDateStr = new Date(l.locationDate || l.timestamp)
          .toISOString()
          .split("T")[0];
        return locationDateStr === dateStr;
      });

      days.push({
        date,
        activities: dayActivities,
        locations: dayLocations,
        isToday: date.getTime() === today.getTime(),
        isCurrentMonth: date.getMonth() === month,
      });
    }

    return days;
  }, [currentDate, activities, savedSpots]);

  const monthStats = useMemo((): MonthStats => {
    const monthActivities = calendarData
      .filter((d) => d.isCurrentMonth)
      .flatMap((d) => d.activities);

    const monthLocations = calendarData
      .filter((d) => d.isCurrentMonth)
      .flatMap((d) => d.locations);

    const totalDistance = monthActivities.reduce(
      (sum, a) => sum + (a.distance || 0),
      0
    );
    const totalDuration = monthActivities.reduce(
      (sum, a) => sum + (a.duration || 0),
      0
    );
    const activeDays = calendarData.filter(
      (d) =>
        d.isCurrentMonth && (d.activities.length > 0 || d.locations.length > 0)
    ).length;

    return {
      activities: monthActivities.length,
      locations: monthLocations.length,
      distance: totalDistance,
      duration: totalDuration,
      activeDays,
    };
  }, [calendarData]);

  return { calendarData, monthStats };
}