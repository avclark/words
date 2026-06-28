import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { SPECIAL_SQUARES } from "@/constants/game";
import { TileComponent } from "./TileComponent";

export const CELL_SIZE = 23;
export const CELL_MARGIN = 0.5;
export const BOARD_PADDING = 6;

interface GameBoardProps {
  board: any[][];
  placedTiles: any[];
  onCellPress: (row: number, col: number) => void;
  dropHighlight?: { row: number; col: number } | null;
}

export function GameBoard({ board, placedTiles, onCellPress, dropHighlight }: GameBoardProps) {
  const colors = useColors();

  const getSquareType = (r: number, c: number) => {
    if (SPECIAL_SQUARES.TWS.some(([row, col]) => row === r && col === c)) return "TWS";
    if (SPECIAL_SQUARES.DWS.some(([row, col]) => row === r && col === c)) return "DWS";
    if (SPECIAL_SQUARES.TLS.some(([row, col]) => row === r && col === c)) return "TLS";
    if (SPECIAL_SQUARES.DLS.some(([row, col]) => row === r && col === c)) return "DLS";
    return null;
  };

  const getSquareColor = (type: string | null, isHighlighted: boolean) => {
    if (isHighlighted) return colors.primary + "99";
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
      <View style={styles.grid}>
        {board.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((cell, c) => {
              const type = getSquareType(r, c);
              const placed = placedTiles.find(t => t.row === r && t.col === c);
              const isHighlighted = dropHighlight?.row === r && dropHighlight?.col === c;

              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.cell, { backgroundColor: getSquareColor(type, isHighlighted) }]}
                  onPress={() => onCellPress(r, c)}
                  activeOpacity={0.7}
                >
                  {cell.letter ? (
                    <TileComponent letter={cell.letter} isBlank={cell.isBlank} size={CELL_SIZE - 2} />
                  ) : placed ? (
                    <TileComponent letter={placed.letter} isBlank={placed.isBlank} size={CELL_SIZE - 2} isPlaced />
                  ) : (
                    <View style={styles.bonusLabelContainer}>
                      {type && <Text style={styles.bonusLabel}>{type}</Text>}
                      {r === 7 && c === 7 && !type && <Text style={styles.star}>★</Text>}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: BOARD_PADDING / 2,
    alignSelf: "center",
    borderRadius: 4,
  },
  grid: { padding: BOARD_PADDING / 2 },
  row: { flexDirection: "row" },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    margin: CELL_MARGIN,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 2,
  },
  bonusLabelContainer: { justifyContent: "center", alignItems: "center" },
  bonusLabel: { fontSize: 5, fontWeight: "bold", color: "#FFF" },
  star: { fontSize: 11, color: "#FFF" },
});
