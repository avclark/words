import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from "react-native";
import { useColors } from "@/hooks/useColors";
import { TileComponent } from "./TileComponent";

interface TileRackProps {
  tiles: string[];
  selectedTileIndex: number | null;
  onTilePress: (index: number) => void;
}

export function TileRack({ tiles, selectedTileIndex, onTilePress }: TileRackProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.rackBackground }]}>
      <ScrollView horizontal contentContainerStyle={styles.scrollContent} showsHorizontalScrollIndicator={false}>
        {tiles.map((letter, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => onTilePress(index)}
            style={styles.tileWrapper}
          >
            <TileComponent
              letter={letter === "?" ? "?" : letter}
              isBlank={letter === "?"}
              isSelected={selectedTileIndex === index}
              size={44}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 70,
    width: "100%",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
  },
  tileWrapper: {
    marginVertical: 4,
  },
});
