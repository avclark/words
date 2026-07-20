import React, { memo } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { SPECIAL_SQUARES } from "@/constants/game";
import { TileComponent } from "./TileComponent";

// ---------------------------------------------------------------------------
// Responsive board metrics.
// The board fills the screen width (capped for tablets) instead of using a
// hard-coded 19pt cell. Everything that needs to convert between screen
// coordinates and board cells imports these constants.
// ---------------------------------------------------------------------------
const SCREEN_W = Dimensions.get("window").width;
export const BOARD_PADDING = 6;
export const CELL_TOTAL = Math.floor(
  (Math.min(SCREEN_W - 8, 430) - BOARD_PADDING * 2) / 15
);
export const CELL_MARGIN = 1;
export const CELL_SIZE = CELL_TOTAL - CELL_MARGIN * 2;
export const BOARD_WIDTH = CELL_TOTAL * 15 + BOARD_PADDING * 2;

type SquareType = "TWS" | "DWS" | "TLS" | "DLS" | null;

// Precompute the square type for every cell once at module load.
const SQUARE_TYPES: SquareType[][] = Array.from({ length: 15 }, (_, r) =>
  Array.from({ length: 15 }, (_, c) => {
    if (SPECIAL_SQUARES.TWS.some(([row, col]) => row === r && col === c)) return "TWS";
    if (SPECIAL_SQUARES.DWS.some(([row, col]) => row === r && col === c)) return "DWS";
    if (SPECIAL_SQUARES.TLS.some(([row, col]) => row === r && col === c)) return "TLS";
    if (SPECIAL_SQUARES.DLS.some(([row, col]) => row === r && col === c)) return "DLS";
    return null;
  })
);

interface CellProps {
  r: number;
  c: number;
  bg: string;
  borderColor: string | null;
  label: string | null;
  showStar: boolean;
  starColor: string;
  letter: string | null; // committed board letter
  letterIsBlank: boolean;
  placedLetter: string | null; // tentatively placed this turn
  placedIsBlank: boolean;
  onCellPress: (r: number, c: number) => void;
}

// Memoized cell: only re-renders when its own tile/appearance changes.
// This is what keeps the 225-cell board cheap during placement updates —
// and during drags nothing here re-renders at all (the hover highlight is a
// separate overlay driven on the UI thread).
const Cell = memo(function Cell({
  r, c, bg, borderColor, label, showStar, starColor,
  letter, letterIsBlank, placedLetter, placedIsBlank, onCellPress,
}: CellProps) {
  return (
    <TouchableOpacity
      style={[
        styles.cell,
        {
          backgroundColor: bg,
          borderWidth: borderColor ? 1 : 0,
          borderColor: borderColor ?? "transparent",
        },
      ]}
      onPress={() => onCellPress(r, c)}
      activeOpacity={0.7}
    >
      {letter ? (
        <TileComponent letter={letter} isBlank={letterIsBlank} size={CELL_SIZE - 2} />
      ) : placedLetter ? (
        <TileComponent letter={placedLetter} isBlank={placedIsBlank} size={CELL_SIZE - 2} isPlaced />
      ) : (
        <>
          {showStar ? (
            <Text style={[styles.star, { color: starColor }]}>★</Text>
          ) : label ? (
            <Text style={styles.bonusLabel}>{label}</Text>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
});

interface GameBoardProps {
  board: any[][];
  placedTiles: { row: number; col: number; letter: string; isBlank: boolean }[];
  onCellPress: (row: number, col: number) => void;
  /** Hovered drop cell during a drag, driven on the UI thread. -1 = none. */
  hoverRow: SharedValue<number>;
  hoverCol: SharedValue<number>;
}

export const GameBoard = memo(function GameBoard({
  board, placedTiles, onCellPress, hoverRow, hoverCol,
}: GameBoardProps) {
  const colors = useColors();

  // Single animated overlay marks the hovered drop cell. Because it reads
  // shared values in an animated style, dragging never re-renders the board.
  const highlightStyle = useAnimatedStyle(() => ({
    opacity: hoverRow.value >= 0 ? 1 : 0,
    transform: [
      { translateX: BOARD_PADDING + Math.max(0, hoverCol.value) * CELL_TOTAL },
      { translateY: BOARD_PADDING + Math.max(0, hoverRow.value) * CELL_TOTAL },
    ],
  }));

  const typeColor = (t: SquareType) =>
    t === "TWS" ? colors.twsColor :
    t === "DWS" ? colors.dwsColor :
    t === "TLS" ? colors.tlsColor :
    t === "DLS" ? colors.dlsColor : colors.tileEmpty;

  return (
    <View style={[styles.container, { backgroundColor: colors.boardBackground }]}>
      {board.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((cell: any, c: number) => {
            const type = SQUARE_TYPES[r][c];
            const placed = placedTiles.find(t => t.row === r && t.col === c);
            return (
              <Cell
                key={c}
                r={r}
                c={c}
                bg={typeColor(type)}
                borderColor={type ? null : colors.tileEmptyBorder}
                label={type}
                showStar={r === 7 && c === 7}
                starColor={colors.centerStar}
                letter={cell.letter ?? null}
                letterIsBlank={!!cell.isBlank}
                placedLetter={placed?.letter ?? null}
                placedIsBlank={!!placed?.isBlank}
                onCellPress={onCellPress}
              />
            );
          })}
        </View>
      ))}

      {/* Drop-target highlight ring (UI-thread driven, never re-renders board) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.highlight,
          { borderColor: colors.primary, backgroundColor: colors.primary + "33" },
          highlightStyle,
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: BOARD_PADDING,
    alignSelf: "center",
    borderRadius: 10,
  },
  row: { flexDirection: "row" },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    margin: CELL_MARGIN,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  bonusLabel: {
    fontSize: Math.max(5, CELL_SIZE * 0.28),
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  star: {
    fontSize: Math.max(10, CELL_SIZE * 0.55),
    fontWeight: "bold",
  },
  highlight: {
    position: "absolute",
    width: CELL_TOTAL,
    height: CELL_TOTAL,
    borderRadius: 6,
    borderWidth: 2,
    left: 0,
    top: 0,
  },
});
