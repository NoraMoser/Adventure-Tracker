// components/DayCell.tsx

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../constants/theme";
import { DayData } from "../hooks/useCalendarData";

interface DayCellProps {
  day: DayData;
  onPress: (day: DayData) => void;
}

export function DayCell({ day, onPress }: DayCellProps) {
  const hasContent = day.activities.length > 0 || day.locations.length > 0;
  const dotCount = Math.min(day.activities.length + day.locations.length, 3);

  return (
    <TouchableOpacity
      style={[
        styles.dayCell,
        !day.isCurrentMonth && styles.dayCellInactive,
        day.isToday && styles.dayCellToday,
        hasContent && styles.dayCellWithContent,
      ]}
      onPress={() => onPress(day)}
      disabled={!hasContent}
    >
      <Text
        style={[
          styles.dayNumber,
          !day.isCurrentMonth && styles.dayNumberInactive,
          day.isToday && styles.dayNumberToday,
        ]}
      >
        {day.date.getDate()}
      </Text>

      {hasContent && (
        <View style={styles.dayIndicators}>
          {Array.from({ length: dotCount }).map((_, i) => {
            const isActivity = i < day.activities.length;
            return (
              <View
                key={i}
                style={[
                  styles.dayDot,
                  {
                    backgroundColor: isActivity
                      ? theme.colors.forest
                      : theme.colors.burntOrange,
                  },
                ]}
              />
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    padding: 5,
    borderWidth: 0.5,
    borderColor: theme.colors.borderGray,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellInactive: {
    backgroundColor: theme.colors.offWhite + "50",
  },
  dayCellToday: {
    backgroundColor: theme.colors.forest + "10",
    borderColor: theme.colors.forest,
    borderWidth: 2,
  },
  dayCellWithContent: {
    backgroundColor: "white",
  },
  dayNumber: {
    fontSize: 14,
    color: theme.colors.navy,
    marginBottom: 2,
  },
  dayNumberInactive: {
    color: theme.colors.lightGray,
  },
  dayNumberToday: {
    fontWeight: "bold",
    color: theme.colors.forest,
  },
  dayIndicators: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});