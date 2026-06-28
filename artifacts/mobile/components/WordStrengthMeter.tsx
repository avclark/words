import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useCheckWordStrength } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

interface PlacedTileLocal {
  row: number;
  col: number;
  letter: string;
  isBlank: boolean;
}

interface WordStrengthMeterProps {
  gameId: string;
  placedTiles: PlacedTileLocal[];
}

export function WordStrengthMeter({ gameId, placedTiles }: WordStrengthMeterProps) {
  const colors = useColors();
  const { mutate, data: strength } = useCheckWordStrength();

  useEffect(() => {
    if (placedTiles.length === 0) return;
    mutate({
      gameId,
      data: {
        tiles: placedTiles.map((t) => ({
          row: t.row,
          col: t.col,
          letter: t.letter,
          isBlank: t.isBlank,
        })),
      },
    });
  }, [gameId, placedTiles, mutate]);

  if (!strength || placedTiles.length === 0) return null;

  const getStrengthColor = (s: string) => {
    switch (s) {
      case "weak": return "#E53E3E";
      case "fair": return "#ED8936";
      case "good": return "#ECC94B";
      case "great": return "#48BB78";
      case "exceptional": return "#F5C842";
      default: return colors.muted;
    }
  };

  const strengthLabel = strength.strength
    ? (strength.strength as string).toUpperCase()
    : "";

  return (
    <View style={styles.container}>
      <View style={[styles.barBackground, { backgroundColor: colors.secondary }]}>
        <View
          style={[
            styles.bar,
            {
              backgroundColor: strength.valid
                ? getStrengthColor(strength.strength as string)
                : colors.destructive,
              width: strength.valid
                ? `${Math.min((strength.score / 80) * 100, 100)}%`
                : "100%",
            },
          ]}
        />
      </View>
      <View style={styles.info}>
        <Text
          style={[
            styles.strengthText,
            {
              color: strength.valid
                ? getStrengthColor(strength.strength as string)
                : colors.destructive,
            },
          ]}
        >
          {strength.valid ? strengthLabel : "INVALID"}
        </Text>
        {strength.valid && (
          <Text style={[styles.scoreText, { color: colors.primary }]}>
            +{strength.score} pts
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  barBackground: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 3,
  },
  info: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  scoreText: {
    fontSize: 12,
    fontWeight: "bold",
  },
});
