import {
  BINGO_BONUS,
  BOARD_LAYOUT,
  BOARD_SIZE,
  RACK_SIZE,
  TILE_VALUES,
  type BoardCell,
  type PlacedTile,
  type SquareType,
} from "./constants";
import { isValidWord } from "./dictionary";

export function createEmptyBoard(): BoardCell[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({
      letter: null,
      isBlank: false,
      placedBy: null,
    }))
  );
}

function getSquareType(row: number, col: number): SquareType {
  return BOARD_LAYOUT[row]?.[col] ?? null;
}

export function validateMove(
  board: BoardCell[][],
  tiles: PlacedTile[],
  isFirstMove: boolean
): { valid: boolean; error?: string } {
  if (tiles.length === 0) return { valid: false, error: "No tiles placed" };
  if (tiles.length > RACK_SIZE) return { valid: false, error: "Too many tiles" };

  // Check tiles are in bounds
  for (const t of tiles) {
    if (t.row < 0 || t.row >= BOARD_SIZE || t.col < 0 || t.col >= BOARD_SIZE) {
      return { valid: false, error: "Tile out of bounds" };
    }
    if (board[t.row]?.[t.col]?.letter !== null) {
      return { valid: false, error: "Square already occupied" };
    }
    if (!t.letter || t.letter.length !== 1) {
      return { valid: false, error: "Invalid tile letter" };
    }
  }

  // Check no duplicate positions
  const positions = new Set(tiles.map((t) => `${t.row},${t.col}`));
  if (positions.size !== tiles.length) {
    return { valid: false, error: "Duplicate tile positions" };
  }

  // All tiles must be in the same row or same column
  const rows = new Set(tiles.map((t) => t.row));
  const cols = new Set(tiles.map((t) => t.col));
  const isHorizontal = rows.size === 1;
  const isVertical = cols.size === 1;

  if (!isHorizontal && !isVertical) {
    return { valid: false, error: "Tiles must be in a straight line" };
  }

  // Check contiguous (no gaps when combined with existing tiles)
  if (isHorizontal) {
    const row = tiles[0]!.row;
    const colPositions = tiles.map((t) => t.col);
    const minCol = Math.min(...colPositions);
    const maxCol = Math.max(...colPositions);
    for (let c = minCol; c <= maxCol; c++) {
      const placed = tiles.some((t) => t.col === c);
      const existing = board[row]?.[c]?.letter !== null;
      if (!placed && !existing) {
        return { valid: false, error: "Tiles must be contiguous" };
      }
    }
  } else {
    const col = tiles[0]!.col;
    const rowPositions = tiles.map((t) => t.row);
    const minRow = Math.min(...rowPositions);
    const maxRow = Math.max(...rowPositions);
    for (let r = minRow; r <= maxRow; r++) {
      const placed = tiles.some((t) => t.row === r);
      const existing = board[r]?.[col]?.letter !== null;
      if (!placed && !existing) {
        return { valid: false, error: "Tiles must be contiguous" };
      }
    }
  }

  // First move must cover center
  if (isFirstMove) {
    const coversCenter = tiles.some((t) => t.row === 7 && t.col === 7);
    if (!coversCenter) {
      return { valid: false, error: "First word must cover the center square" };
    }
  } else {
    // Must connect to existing tiles
    const connects = tiles.some((t) => {
      const neighbors = [
        [t.row - 1, t.col],
        [t.row + 1, t.col],
        [t.row, t.col - 1],
        [t.row, t.col + 1],
      ];
      return neighbors.some(
        ([r, c]) =>
          r !== undefined &&
          c !== undefined &&
          r >= 0 && r < BOARD_SIZE &&
          c >= 0 && c < BOARD_SIZE &&
          board[r]?.[c]?.letter !== null &&
          !tiles.some((pt) => pt.row === r && pt.col === c)
      );
    });
    if (!connects) {
      return { valid: false, error: "Word must connect to existing tiles" };
    }
  }

  return { valid: true };
}

// Apply tiles to a working board copy and find all words
function applyTilesToBoard(
  board: BoardCell[][],
  tiles: PlacedTile[]
): BoardCell[][] {
  const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
  for (const t of tiles) {
    newBoard[t.row]![t.col] = {
      letter: t.letter.toUpperCase(),
      isBlank: t.isBlank,
      placedBy: null,
    };
  }
  return newBoard;
}

function getHorizontalWord(
  board: BoardCell[][],
  row: number,
  col: number
): { word: string; startCol: number } | null {
  // Find leftmost
  let startCol = col;
  while (startCol > 0 && board[row]?.[startCol - 1]?.letter) startCol--;

  let word = "";
  let c = startCol;
  while (c < BOARD_SIZE && board[row]?.[c]?.letter) {
    word += board[row]![c]!.letter!;
    c++;
  }

  if (word.length < 2) return null;
  return { word, startCol };
}

function getVerticalWord(
  board: BoardCell[][],
  row: number,
  col: number
): { word: string; startRow: number } | null {
  let startRow = row;
  while (startRow > 0 && board[startRow - 1]?.[col]?.letter) startRow--;

  let word = "";
  let r = startRow;
  while (r < BOARD_SIZE && board[r]?.[col]?.letter) {
    word += board[r]![col]!.letter!;
    r++;
  }

  if (word.length < 2) return null;
  return { word, startRow };
}

export function findWordsFormed(
  board: BoardCell[][],
  tiles: PlacedTile[]
): string[] {
  const tempBoard = applyTilesToBoard(board, tiles);
  const placedPositions = new Set(tiles.map((t) => `${t.row},${t.col}`));
  const words: string[] = [];

  const rows = new Set(tiles.map((t) => t.row));
  const cols = new Set(tiles.map((t) => t.col));
  const isHorizontal = rows.size === 1 || tiles.length === 1;

  if (isHorizontal && tiles.length > 0) {
    const row = tiles[0]!.row;
    const anyCol = tiles[0]!.col;
    const mainWord = getHorizontalWord(tempBoard, row, anyCol);
    if (mainWord) words.push(mainWord.word);

    // Cross words (vertical)
    for (const t of tiles) {
      const vWord = getVerticalWord(tempBoard, t.row, t.col);
      if (vWord) words.push(vWord.word);
    }
  } else {
    const col = tiles[0]!.col;
    const mainWord = getVerticalWord(tempBoard, tiles[0]!.row, col);
    if (mainWord) words.push(mainWord.word);

    // Cross words (horizontal)
    for (const t of tiles) {
      const hWord = getHorizontalWord(tempBoard, t.row, t.col);
      if (hWord) words.push(hWord.word);
    }
  }

  // Single tile: check both directions
  if (tiles.length === 1) {
    const t = tiles[0]!;
    const h = getHorizontalWord(tempBoard, t.row, t.col);
    const v = getVerticalWord(tempBoard, t.row, t.col);
    const result: string[] = [];
    if (h) result.push(h.word);
    if (v) result.push(v.word);
    return [...new Set(result)];
  }

  void placedPositions;
  return [...new Set(words)];
}

export function validateWords(words: string[]): { valid: boolean; invalid?: string } {
  for (const word of words) {
    if (!isValidWord(word)) {
      return { valid: false, invalid: word };
    }
  }
  return { valid: true };
}

export function calculateScore(
  board: BoardCell[][],
  tiles: PlacedTile[]
): number {
  const tempBoard = applyTilesToBoard(board, tiles);
  const placedSet = new Set(tiles.map((t) => `${t.row},${t.col}`));
  const rows = new Set(tiles.map((t) => t.row));
  const isHorizontal = rows.size === 1 || tiles.length === 1;

  let totalScore = 0;

  const scoreWord = (wordTiles: Array<{ row: number; col: number; letter: string; isBlank: boolean }>): number => {
    let wordScore = 0;
    let wordMultiplier = 1;

    for (const wt of wordTiles) {
      const tileValue = wt.isBlank ? 0 : (TILE_VALUES[wt.letter.toUpperCase()] ?? 0);
      const squareType = getSquareType(wt.row, wt.col);
      const isNewlyPlaced = placedSet.has(`${wt.row},${wt.col}`);

      if (isNewlyPlaced) {
        if (squareType === "DLS") {
          wordScore += tileValue * 2;
        } else if (squareType === "TLS") {
          wordScore += tileValue * 3;
        } else {
          wordScore += tileValue;
        }

        if (squareType === "DWS" || squareType === "CENTER") wordMultiplier *= 2;
        if (squareType === "TWS") wordMultiplier *= 3;
      } else {
        wordScore += tileValue;
      }
    }

    return wordScore * wordMultiplier;
  };

  // Build words and calculate scores
  if (tiles.length === 1) {
    const t = tiles[0]!;
    const hInfo = getHorizontalWord(tempBoard, t.row, t.col);
    const vInfo = getVerticalWord(tempBoard, t.row, t.col);

    if (hInfo) {
      const wordTiles = buildWordTiles(tempBoard, t.row, hInfo.startCol, true, hInfo.word.length);
      totalScore += scoreWord(wordTiles);
    }
    if (vInfo) {
      const wordTiles = buildWordTiles(tempBoard, vInfo.startRow, t.col, false, vInfo.word.length);
      totalScore += scoreWord(wordTiles);
    }
    if (!hInfo && !vInfo) {
      // Single tile, no words formed - just the tile value
      const tileValue = tiles[0]!.isBlank ? 0 : (TILE_VALUES[tiles[0]!.letter.toUpperCase()] ?? 0);
      totalScore += tileValue;
    }
  } else if (isHorizontal) {
    const row = tiles[0]!.row;
    const minCol = Math.min(...tiles.map((t) => t.col));
    const info = getHorizontalWord(tempBoard, row, minCol);
    if (info) {
      const wordTiles = buildWordTiles(tempBoard, row, info.startCol, true, info.word.length);
      totalScore += scoreWord(wordTiles);
    }
    // Cross words
    for (const t of tiles) {
      const vInfo = getVerticalWord(tempBoard, t.row, t.col);
      if (vInfo) {
        const wordTiles = buildWordTiles(tempBoard, vInfo.startRow, t.col, false, vInfo.word.length);
        totalScore += scoreWord(wordTiles);
      }
    }
  } else {
    const col = tiles[0]!.col;
    const minRow = Math.min(...tiles.map((t) => t.row));
    const info = getVerticalWord(tempBoard, minRow, col);
    if (info) {
      const wordTiles = buildWordTiles(tempBoard, info.startRow, col, false, info.word.length);
      totalScore += scoreWord(wordTiles);
    }
    // Cross words
    for (const t of tiles) {
      const hInfo = getHorizontalWord(tempBoard, t.row, t.col);
      if (hInfo) {
        const wordTiles = buildWordTiles(tempBoard, t.row, hInfo.startCol, true, hInfo.word.length);
        totalScore += scoreWord(wordTiles);
      }
    }
  }

  // Bingo bonus: used all 7 tiles
  if (tiles.length === RACK_SIZE) {
    totalScore += BINGO_BONUS;
  }

  return totalScore;
}

function buildWordTiles(
  board: BoardCell[][],
  startRow: number,
  startCol: number,
  horizontal: boolean,
  length: number
): Array<{ row: number; col: number; letter: string; isBlank: boolean }> {
  const result = [];
  for (let i = 0; i < length; i++) {
    const row = horizontal ? startRow : startRow + i;
    const col = horizontal ? startCol + i : startCol;
    const cell = board[row]![col]!;
    result.push({ row, col, letter: cell.letter ?? "", isBlank: cell.isBlank });
  }
  return result;
}

export function applyMove(
  board: BoardCell[][],
  tiles: PlacedTile[],
  userId: string
): BoardCell[][] {
  const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
  for (const t of tiles) {
    newBoard[t.row]![t.col] = {
      letter: t.letter.toUpperCase(),
      isBlank: t.isBlank,
      placedBy: userId,
    };
  }
  return newBoard;
}

export function isGameOver(
  bag: string[],
  racks: string[][],
  consecutivePasses: number
): boolean {
  // Game over if a player emptied their rack and bag is empty
  if (bag.length === 0 && racks.some((rack) => rack.length === 0)) {
    return true;
  }
  // Game over if 6 consecutive passes (3 per player)
  if (consecutivePasses >= 6) {
    return true;
  }
  return false;
}

export function calculateFinalScores(
  scores: number[],
  racks: string[][]
): number[] {
  // Sum of remaining tiles is subtracted from each player's score
  // and added to the player who emptied their rack
  const remainingValues = racks.map((rack) =>
    rack.reduce((sum, letter) => sum + (TILE_VALUES[letter] ?? 0), 0)
  );
  const totalRemaining = remainingValues.reduce((a, b) => a + b, 0);

  return scores.map((score, i) => {
    if (racks[i]!.length === 0) {
      // This player emptied their rack
      return score + totalRemaining - remainingValues[i]!;
    }
    return score - remainingValues[i]!;
  });
}

// Simplified hint: find best scoring word from rack on current board
export function findBestWord(
  board: BoardCell[][],
  rack: string[]
): { word: string | null; tiles: PlacedTile[]; score: number } {
  const hasExistingTiles = board.some((row) => row.some((cell) => cell.letter !== null));
  const isFirstMove = !hasExistingTiles;

  let bestScore = 0;
  let bestTiles: PlacedTile[] = [];
  let bestWord: string | null = null;

  // Generate permutations of rack (2 to rack.length)
  const perms = generatePermutations(rack, Math.min(rack.length, 5));

  for (const perm of perms) {
    const word = perm.join("").toUpperCase();
    if (!isValidWord(word)) continue;

    // Try horizontal placements on row 7 (or near existing tiles)
    const rowsToTry = isFirstMove ? [7] : getActiveRows(board);
    for (const row of rowsToTry) {
      for (let startCol = 0; startCol <= BOARD_SIZE - perm.length; startCol++) {
        const tiles = perm.map((letter, i) => ({
          row,
          col: startCol + i,
          letter: letter === "?" ? "A" : letter, // blank as 'A' for hint
          isBlank: letter === "?",
        }));

        // Skip if any position is occupied
        if (tiles.some((t) => board[t.row]?.[t.col]?.letter !== null)) continue;

        const validation = validateMove(board, tiles, isFirstMove);
        if (!validation.valid) continue;

        const words = findWordsFormed(board, tiles);
        const allValid = words.every((w) => isValidWord(w));
        if (!allValid) continue;

        const score = calculateScore(board, tiles);
        if (score > bestScore) {
          bestScore = score;
          bestTiles = tiles;
          bestWord = word;
        }
      }
    }
  }

  return { word: bestWord, tiles: bestTiles, score: bestScore };
}

function getActiveRows(board: BoardCell[][]): number[] {
  const rows = new Set<number>();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r]?.[c]?.letter) {
        if (r > 0) rows.add(r - 1);
        rows.add(r);
        if (r < BOARD_SIZE - 1) rows.add(r + 1);
      }
    }
  }
  return [...rows].slice(0, 5);
}

function generatePermutations(arr: string[], maxLen: number): string[][] {
  const result: string[][] = [];
  const used = new Array(arr.length).fill(false);

  function backtrack(current: string[]) {
    if (current.length >= 2) {
      result.push([...current]);
      if (result.length > 500) return; // limit for performance
    }
    if (current.length >= maxLen || result.length > 500) return;

    for (let i = 0; i < arr.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      current.push(arr[i]!);
      backtrack(current);
      current.pop();
      used[i] = false;
    }
  }

  backtrack([]);
  return result;
}

export function getWordStrength(score: number): "weak" | "fair" | "good" | "great" | "exceptional" {
  if (score < 10) return "weak";
  if (score < 20) return "fair";
  if (score < 35) return "good";
  if (score < 50) return "great";
  return "exceptional";
}
