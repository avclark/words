// TWL-approximation: uses an-array-of-english-words filtered to valid Scrabble lengths
// Can be replaced with actual TWL06 for production accuracy

let wordSet: Set<string> | null = null;

export function loadDictionary(): void {
  if (wordSet) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const words = require("an-array-of-english-words") as string[];
    wordSet = new Set(
      words
        .filter((w) => w.length >= 2 && w.length <= 15 && /^[a-z]+$/.test(w))
        .map((w) => w.toUpperCase())
    );
  } catch {
    // Fallback: empty set (all words pass) for development
    wordSet = new Set();
  }
}

export function isValidWord(word: string): boolean {
  if (!wordSet) loadDictionary();
  if (wordSet!.size === 0) return true; // fallback: allow all words
  return wordSet!.has(word.toUpperCase());
}
