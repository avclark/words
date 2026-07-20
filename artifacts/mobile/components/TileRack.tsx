import React, { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SharedValue,
  runOnJS,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { TileComponent } from "./TileComponent";
import { BOARD_PADDING, CELL_TOTAL } from "./GameBoard";

// The floating tile is drawn with its CENTER this many points above the
// finger so your finger doesn't cover it. Crucially, the drop cell is
// computed from this same point — so the tile lands exactly where it
// appears to be, which fixes the old "drops one row too low" bug.
export const DRAG_OFFSET_Y = -58;
export const FLOAT_TILE_SIZE = 52;
export const RACK_TILE_SIZE = 46;

export interface RackDragShared {
  /** Finger position in window coordinates (updated every frame, UI thread). */
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  /** 1 while a drag is active, else 0. */
  dragActive: SharedValue<number>;
  /** Rack index of the tile being dragged, -1 when idle. */
  draggingIndex: SharedValue<number>;
  /** Hovered drop cell (valid + empty), -1 when none. */
  hoverRow: SharedValue<number>;
  hoverCol: SharedValue<number>;
  /** Window coordinates of the board's top-left corner. */
  boardOrigin: SharedValue<{ x: number; y: number }>;
}

interface TileRackProps {
  tiles: string[];
  selectedTileIndex: number | null;
  /** Tap: toggle selection (for tap-to-place). */
  onTilePress: (index: number) => void;
  /** Drag crossed the activation threshold. Re-measure the board here. */
  onDragStart: (index: number) => void;
  /** Finger released. row/col are the drop cell, or -1 if off-board/invalid. */
  onDrop: (index: number, row: number, col: number) => void;
  /** 15x15 grid: true where a tile (committed or tentatively placed) sits. */
  occupied: boolean[][];
  shared: RackDragShared;
}

interface RackTileProps {
  letter: string;
  index: number;
  isSelected: boolean;
  onTilePress: (index: number) => void;
  onDragStart: (index: number) => void;
  onDrop: (index: number, row: number, col: number) => void;
  occupied: boolean[][];
  shared: RackDragShared;
}

const RackTile = memo(function RackTile({
  letter, index, isSelected, onTilePress, onDragStart, onDrop, occupied, shared,
}: RackTileProps) {
  const { dragX, dragY, dragActive, draggingIndex, hoverRow, hoverCol, boardOrigin } = shared;

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(6)
      .onStart((e) => {
        draggingIndex.value = index;
        dragActive.value = 1;
        dragX.value = e.absoluteX;
        dragY.value = e.absoluteY;
        runOnJS(onDragStart)(index);
      })
      .onUpdate((e) => {
        dragX.value = e.absoluteX;
        dragY.value = e.absoluteY;
        // Hit-test using the floating tile's visual center, not the raw finger.
        const cx = e.absoluteX;
        const cy = e.absoluteY + DRAG_OFFSET_Y;
        const col = Math.floor((cx - boardOrigin.value.x - BOARD_PADDING) / CELL_TOTAL);
        const row = Math.floor((cy - boardOrigin.value.y - BOARD_PADDING) / CELL_TOTAL);
        if (row >= 0 && row < 15 && col >= 0 && col < 15 && !occupied[row][col]) {
          hoverRow.value = row;
          hoverCol.value = col;
        } else {
          hoverRow.value = -1;
          hoverCol.value = -1;
        }
      })
      .onEnd(() => {
        // hoverRow/Col already hold the validated drop cell (or -1).
        runOnJS(onDrop)(index, hoverRow.value, hoverCol.value);
      })
      .onFinalize(() => {
        dragActive.value = 0;
        draggingIndex.value = -1;
        hoverRow.value = -1;
        hoverCol.value = -1;
      });

    const tap = Gesture.Tap()
      .maxDuration(300)
      .onEnd(() => {
        runOnJS(onTilePress)(index);
      });

    // Pan wins if the finger moves; a clean press falls through to tap.
    return Gesture.Exclusive(pan, tap);
    // Shared values are stable refs — they don't need to be dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, occupied, onDragStart, onDrop, onTilePress]);

  // Fade the rack slot while its tile is "lifted".
  const liftStyle = useAnimatedStyle(() => ({
    opacity: dragActive.value === 1 && draggingIndex.value === index ? 0.25 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={liftStyle}>
        <TileComponent
          letter={letter === "?" ? "?" : letter}
          isBlank={letter === "?"}
          isSelected={isSelected}
          size={RACK_TILE_SIZE}
        />
      </Animated.View>
    </GestureDetector>
  );
});

export function TileRack({
  tiles, selectedTileIndex, onTilePress, onDragStart, onDrop, occupied, shared,
}: TileRackProps) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.rackBackground }]}>
      {tiles.map((letter, index) => (
        <RackTile
          // Index-based key is deliberate: tiles shift left when one is
          // placed, and we want slots (not letters) to keep gesture identity.
          key={index}
          letter={letter}
          index={index}
          isSelected={selectedTileIndex === index}
          onTilePress={onTilePress}
          onDragStart={onDragStart}
          onDrop={onDrop}
          occupied={occupied}
          shared={shared}
        />
      ))}
    </View>
  );
}

/**
 * The floating tile that follows the finger during a drag.
 * Rendered once at the top level of the game screen (above everything),
 * position driven entirely on the UI thread — zero React re-renders per frame.
 */
export function FloatingDragTile({
  shared, letter,
}: { shared: RackDragShared; letter: string | null }) {
  const { dragX, dragY, dragActive } = shared;

  const style = useAnimatedStyle(() => ({
    opacity: dragActive.value,
    transform: [
      { translateX: dragX.value - FLOAT_TILE_SIZE / 2 },
      { translateY: dragY.value + DRAG_OFFSET_Y - FLOAT_TILE_SIZE / 2 },
      { scale: dragActive.value === 1 ? 1.05 : 0.8 },
    ],
  }));

  if (!letter) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.floating, style]}>
      <TileComponent
        letter={letter === "?" ? "?" : letter}
        isBlank={letter === "?"}
        size={FLOAT_TILE_SIZE}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  floating: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 999,
    elevation: 12,
  },
});
