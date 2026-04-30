// Standard 15x15 Scrabble premium-square layout.
// Bonus codes:
//   TW = triple-word, DW = double-word
//   TL = triple-letter, DL = double-letter
//   ST = center star (acts as a DW the first time it is covered)

export const BOARD_SIZE = 15;
export const RACK_SIZE = 7;
export const BINGO_BONUS = 50;
export const CENTER = 7;

const TW = [
  [0, 0], [0, 7], [0, 14],
  [7, 0],          [7, 14],
  [14, 0], [14, 7], [14, 14],
];

const DW = [
  [1, 1], [2, 2], [3, 3], [4, 4],
  [1, 13], [2, 12], [3, 11], [4, 10],
  [10, 4], [11, 3], [12, 2], [13, 1],
  [10, 10], [11, 11], [12, 12], [13, 13],
];

const TL = [
  [1, 5], [1, 9],
  [5, 1], [5, 5], [5, 9], [5, 13],
  [9, 1], [9, 5], [9, 9], [9, 13],
  [13, 5], [13, 9],
];

const DL = [
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

function buildBonusMap() {
  const map = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
  for (const [r, c] of TW) map[r][c] = "TW";
  for (const [r, c] of DW) map[r][c] = "DW";
  for (const [r, c] of TL) map[r][c] = "TL";
  for (const [r, c] of DL) map[r][c] = "DL";
  map[CENTER][CENTER] = "ST";
  return map;
}

export const BONUSES = buildBonusMap();

// Letter values and bag composition. Blanks intentionally excluded for now.
// English values match the standard Scrabble distribution.
export const LETTER_VALUES = {
  english: {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5,
    L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4,
    W: 4, X: 8, Y: 4, Z: 10,
  },
  spanish: {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, L: 1,
    M: 3, N: 1, "Ñ": 8, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4,
    X: 8, Y: 4, Z: 10,
  },
};

export const TILE_COUNTS = {
  english: {
    A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1,
    L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2,
    W: 2, X: 1, Y: 2, Z: 1,
  },
  spanish: {
    A: 12, B: 2, C: 4, D: 5, E: 12, F: 1, G: 2, H: 2, I: 6, J: 1, L: 4,
    M: 2, N: 5, "Ñ": 1, O: 9, P: 2, Q: 1, R: 5, S: 6, T: 4, U: 5, V: 1,
    X: 1, Y: 1, Z: 1,
  },
};
