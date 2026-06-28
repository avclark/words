import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { TILE_POINTS } from "@/constants/game";

interface TileComponentProps {
  letter: string | null;
  isBlank?: boolean;
  size?: number;
  isSelected?: boolean;
  isPlaced?: boolean;
}

export function TileComponent({
  letter,
  isBlank,
  size = 40,
  isSelected,
  isPlaced,
}: TileComponentProps) {
  const colors = useColors();
  
  if (!letter && !isBlank) return null;

  const points = isBlank ? 0 : TILE_POINTS[letter || ""] || 0;
  const displayLetter = isBlank ? "" : letter;

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          backgroundColor: isPlaced ? "#FFD700" : colors.tileBackground,
          borderColor: isSelected ? colors.primary : "transparent",
          borderWidth: isSelected ? 2 : 0,
        },
      ]}
    >
      <Text style={[styles.letter, { color: colors.tileForeground, fontSize: size * 0.6 }]}>
        {displayLetter}
      </Text>
      <Text style={[styles.points, { color: colors.tileForeground, fontSize: size * 0.25 }]}>
        {points}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  letter: {
    fontWeight: "bold",
  },
  points: {
    position: "absolute",
    bottom: 2,
    right: 4,
    fontWeight: "600",
  },
});
