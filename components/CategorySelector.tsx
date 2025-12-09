// components/CategorySelector.tsx

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { CategoryType, categoryList } from "../constants/categories";
import { theme } from "../constants/theme";

interface CategorySelectorProps {
  selected: CategoryType;
  onSelect: (category: CategoryType) => void;
  disabled?: boolean;
}

export function CategorySelector({
  selected,
  onSelect,
  disabled = false,
}: CategorySelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
    >
      {categoryList.map((category) => {
        const isSelected = selected === category.id;
        return (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.chip,
              isSelected && {
                backgroundColor: category.color,
                borderColor: category.color,
              },
            ]}
            onPress={() => onSelect(category.id)}
            disabled={disabled}
          >
            <Ionicons
              name={category.icon}
              size={18}
              color={isSelected ? "white" : category.color}
            />
            <Text style={[styles.chipText, isSelected && { color: "white" }]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 15,
    maxHeight: 50,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  chipText: {
    marginLeft: 6,
    fontSize: 14,
    color: theme.colors.gray,
    fontWeight: "500",
  },
});