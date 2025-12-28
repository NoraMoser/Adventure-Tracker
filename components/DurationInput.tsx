import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "../constants/theme";

interface DurationInputProps {
  hours: string;
  minutes: string;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
}

export function DurationInput({
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
}: DurationInputProps) {
  return (
    <View style={styles.container}>
      <View style={styles.inputGroup}>
        <TextInput
          style={styles.numberInput}
          value={hours}
          onChangeText={onHoursChange}
          keyboardType="numeric"
          placeholder="0"
          maxLength={2}
        />
        <Text style={styles.label}>hours</Text>
      </View>
      <View style={styles.inputGroup}>
        <TextInput
          style={styles.numberInput}
          value={minutes}
          onChangeText={onMinutesChange}
          keyboardType="numeric"
          placeholder="0"
          maxLength={2}
        />
        <Text style={styles.label}>minutes</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inputGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    paddingHorizontal: 12,
    marginHorizontal: 5,
  },
  numberInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.navy,
    padding: 12,
  },
  label: {
    fontSize: 14,
    color: theme.colors.gray,
  },
});