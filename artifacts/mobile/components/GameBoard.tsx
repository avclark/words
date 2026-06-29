import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { SPECIAL_SQUARES } from "@/constants/game";
import { TileComponent } from "./TileComponent";

export const CELL_SIZE = 19;
export const CELL_MARGIN = 2;
export const BOARD_PADDING = 8;

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

  const getSquareStyle = (type: string | null, isHighlighted: boolean) => {
    if (isHighlighted) return { backgroundColor: colors.primary + "AA", borderWidth: 0 };
    switch (type) {
      case "TWS": return { backgroundColor: colors.twsColor, borderWidth: 0 };
      case "DWS": return { backgroundColor: colors.dwsColor, borderWidth: 0 };
      case "TLS": return { backgroundColor: colors.tlsColor, borderWidth: 0 };
      case "DLS": return { backgroundColor: colors.dlsColor, borderWidth: 0 };
      default: return {
        backgroundColor: colors.tileEmpty,
        borderWidth: 1,
        borderColor: colors.tileEmptyBorder,
      };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.boardBackground }]}>
      {board.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((cell, c) => {
            const type = getSquareType(r, c);
            const placed = placedTiles.find(t => t.row === r && t.col === c);
            const isHighlighted = dropHighlight?.row === r && dropHighlight?.col === c;
            const squareStyle = getSquareStyle(type, isHighlighted);

            return (
              <TouchableOpacity
                key={c}
                style={[styles.cell, squareStyle]}
                onPress={() => onCellPress(r, c)}
                activeOpacity={0.7}
              >
                {cell.letter ? (
                  <TileComponent letter={cell.letter} isBlank={cell.isBlank} size={CELL_SIZE - 3} />
                ) : placed ? (
                  <TileComponent letter={placed.letter} isBlank={placed.isBlank} size={CELL_SIZE - 3} isPlaced />
                ) : (
                  <>
                    {type && (
                      <Text style={styles.bonusLabel}>{type}</Text>
                    )}
                    {r === 7 && c === 7 && !type && (
                      <Text style={[styles.star, { color: colors.centerStar }]}>★</Text>
                    )}
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: BOARD_PADDING,
    alignSelf: "center",
    borderRadius: 8,
  },
  row: { flexDirection: "row" },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    margin: CELL_MARGIN,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  bonusLabel: {
    fontSize: 4.5,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  star: {
    fontSize: 10,
    fontWeight: "bold",
  },
});
