import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
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

  const scaleAnim = useRef(new Animated.Value(isPlaced ? 0.85 : 1)).current;
  const opacityAnim = useRef(new Animated.Value(isPlaced ? 0.4 : 1)).current;

  useEffect(() => {
    if (isPlaced) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, []);

  if (!letter && !isBlank) return null;

  const points = isBlank ? 0 : TILE_POINTS[letter || ""] || 0;
  const displayLetter = isBlank ? "" : letter;
  const bgColor = isPlaced ? "#F4CF4A" : colors.tileBackground;

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          backgroundColor: bgColor,
          borderColor: isSelected ? colors.primary : "transparent",
          borderWidth: isSelected ? 2 : 0,
          borderRadius: Math.max(3, size * 0.2),
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.52 }]}>
        {displayLetter}
      </Text>
      {points > 0 && (
        <Text style={[styles.points, { fontSize: Math.max(4, size * 0.24) }]}>
          {points}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2,
  },
  letter: {
    fontWeight: "bold",
    color: "#111111",
  },
  points: {
    position: "absolute",
    bottom: 1,
    right: 3,
    fontWeight: "600",
    color: "#111111",
  },
});
