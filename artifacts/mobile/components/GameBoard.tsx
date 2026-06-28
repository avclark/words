import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from "react-native";
import { useColors } from "@/hooks/useColors";
import { SPECIAL_SQUARES } from "@/constants/game";
import { TileComponent } from "./TileComponent";

interface GameBoardProps {
  board: any[][];
  placedTiles: any[];
  onCellPress: (row: number, col: number) => void;
}

export function GameBoard({ board, placedTiles, onCellPress }: GameBoardProps) {
  const colors = useColors();

  const getSquareType = (r: number, c: number) => {
    if (SPECIAL_SQUARES.TWS.some(([row, col]) => row === r && col === c)) return "TWS";
    if (SPECIAL_SQUARES.DWS.some(([row, col]) => row === r && col === c)) return "DWS";
    if (SPECIAL_SQUARES.TLS.some(([row, col]) => row === r && col === c)) return "TLS";
    if (SPECIAL_SQUARES.DLS.some(([row, col]) => row === r && col === c)) return "DLS";
    return null;
  };

  const getSquareColor = (type: string | null) => {
    switch (type) {
      case "TWS": return colors.twsColor;
      case "DWS": return colors.dwsColor;
      case "TLS": return colors.tlsColor;
      case "DLS": return colors.dlsColor;
      default: return colors.tileEmpty;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.boardBackground }]}>
      <ScrollView horizontal bounces={false}>
        <ScrollView bounces={false}>
          <View style={styles.grid}>
            {board.map((row, r) => (
              <View key={r} style={styles.row}>
                {row.map((cell, c) => {
                  const type = getSquareType(r, c);
                  const placed = placedTiles.find(t => t.row === r && t.col === c);
                  
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.cell, { backgroundColor: getSquareColor(type) }]}
                      onPress={() => onCellPress(r, c)}
                    >
                      {cell.letter ? (
                        <TileComponent letter={cell.letter} isBlank={cell.isBlank} size={22} />
                      ) : placed ? (
                        <TileComponent letter={placed.letter} isBlank={placed.isBlank} size={22} isPlaced />
                      ) : (
                        <View style={styles.bonusLabelContainer}>
                          {type && <Text style={styles.bonusLabel}>{type}</Text>}
                          {r === 7 && c === 7 && <Text style={styles.star}>★</Text>}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 4, alignSelf: "center" },
  grid: { padding: 2 },
  row: { flexDirection: "row" },
  cell: {
    width: 23,
    height: 23,
    margin: 0.5,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 2,
  },
  bonusLabelContainer: { justifyContent: "center", alignItems: "center" },
  bonusLabel: { fontSize: 6, fontWeight: "bold", color: "#FFF" },
  star: { fontSize: 12, color: "#FFF" },
});
