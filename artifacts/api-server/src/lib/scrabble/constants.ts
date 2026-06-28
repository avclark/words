export const TILE_VALUES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10, "?": 0,
};

export const TILE_DISTRIBUTION: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9,
  J: 1, K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6,
  S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, "?": 2,
};

export type SquareType = "TWS" | "DWS" | "TLS" | "DLS" | "CENTER" | null;

// Standard Scrabble board bonus squares (0-indexed)
const boardLayout: SquareType[][] = Array.from({ length: 15 }, () =>
  Array(15).fill(null)
);

// Triple Word Score
const tws: [number, number][] = [
  [0, 0], [0, 7], [0, 14],
  [7, 0],          [7, 14],
  [14, 0], [14, 7], [14, 14],
];
// Double Word Score
const dws: [number, number][] = [
  [1, 1], [2, 2], [3, 3], [4, 4],
  [1, 13], [2, 12], [3, 11], [4, 10],
  [10, 4], [11, 3], [12, 2], [13, 1],
  [10, 10], [11, 11], [12, 12], [13, 13],
];
// Triple Letter Score
const tls: [number, number][] = [
  [1, 5], [1, 9],
  [5, 1], [5, 5], [5, 9], [5, 13],
  [9, 1], [9, 5], [9, 9], [9, 13],
  [13, 5], [13, 9],
];
// Double Letter Score
const dls: [number, number][] = [
  [0, 3], [0, 11],
  [2, 6], [2, 8],
  [3, 0], [3, 7], [3, 14],
  [6, 2], [6, 6], [6, 8], [6, 12],
  [7, 3], [7, 11],
  [8, 2], [8, 6], [8, 8], [8, 12],
  [11, 0], [11, 7], [11, 14],
  [12, 6], [12, 8],
  [14, 3], [14, 11],
];

for (const [r, c] of tws) boardLayout[r]![c] = "TWS";
for (const [r, c] of dws) boardLayout[r]![c] = "DWS";
for (const [r, c] of tls) boardLayout[r]![c] = "TLS";
for (const [r, c] of dls) boardLayout[r]![c] = "DLS";
boardLayout[7]![7] = "CENTER";

export const BOARD_LAYOUT: SquareType[][] = boardLayout;

export const BOARD_SIZE = 15;
export const RACK_SIZE = 7;
export const BINGO_BONUS = 50;
export const TURN_WARNING_HOURS = 20; // warn after 20h of inactivity
export const TURN_DEADLINE_HOURS = 72; // game ends after 72h of inactivity

export type BoardCell = {
  letter: string | null;
  isBlank: boolean;
  placedBy: string | null;
};

export type PlacedTile = {
  row: number;
  col: number;
  letter: string;
  isBlank: boolean;
};

export const EMPTY_BOARD: BoardCell[][] = Array.from({ length: BOARD_SIZE }, () =>
  Array.from({ length: BOARD_SIZE }, () => ({
    letter: null,
    isBlank: false,
    placedBy: null,
  }))
);
