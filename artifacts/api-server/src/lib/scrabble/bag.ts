import { RACK_SIZE, TILE_DISTRIBUTION } from "./constants";

export function createBag(): string[] {
  const bag: string[] = [];
  for (const [letter, count] of Object.entries(TILE_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) {
      bag.push(letter);
    }
  }
  return shuffleBag(bag);
}

export function shuffleBag(bag: string[]): string[] {
  const arr = [...bag];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function drawTiles(
  bag: string[],
  rack: string[],
  count: number
): { newRack: string[]; newBag: string[] } {
  const newBag = [...bag];
  const newRack = [...rack];
  const drawn = Math.min(count, newBag.length);
  for (let i = 0; i < drawn; i++) {
    newRack.push(newBag.pop()!);
  }
  return { newRack, newBag };
}

export function fillRack(rack: string[], bag: string[]): { newRack: string[]; newBag: string[] } {
  const needed = RACK_SIZE - rack.length;
  return drawTiles(bag, rack, needed);
}

export function swapTiles(
  letters: string[],
  rack: string[],
  bag: string[]
): { newRack: string[]; newBag: string[] } | { error: string } {
  if (bag.length < letters.length) {
    return { error: "Not enough tiles in bag to swap" };
  }
  // Remove tiles from rack
  const newRack = [...rack];
  for (const letter of letters) {
    const idx = newRack.indexOf(letter);
    if (idx === -1) return { error: `Tile ${letter} not in rack` };
    newRack.splice(idx, 1);
  }
  // Return swapped tiles to bag and shuffle
  const newBag = shuffleBag([...bag, ...letters]);
  // Draw replacement tiles
  const { newRack: filledRack, newBag: finalBag } = fillRack(newRack, newBag);
  return { newRack: filledRack, newBag: finalBag };
}
