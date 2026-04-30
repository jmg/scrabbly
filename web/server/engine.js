import {
  BONUSES,
  BOARD_SIZE,
  CENTER,
  LETTER_VALUES,
  TILE_COUNTS,
  RACK_SIZE,
  BINGO_BONUS,
} from "./bonuses.js";

export class InvalidPlayError extends Error {}

export function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
}

export function buildBag(language) {
  const counts = TILE_COUNTS[language];
  if (!counts) throw new Error(`Unsupported language: ${language}`);
  const bag = [];
  for (const [letter, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) bag.push(letter);
  }
  shuffle(bag);
  return bag;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function drawTiles(bag, n) {
  const drawn = [];
  while (drawn.length < n && bag.length > 0) drawn.push(bag.pop());
  return drawn;
}

function inBounds(r, c) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function letterValue(language, letter) {
  return LETTER_VALUES[language][letter.toUpperCase()] ?? 0;
}

// `placements` is an array of { row, col, letter } describing the new tiles
// the player wants to put on the board this turn. Returns
// { words, score, board: nextBoard } on success or throws InvalidPlayError.
export function evaluateMove({ board, language, dictionary, placements, isFirstMove }) {
  if (!placements || placements.length === 0) {
    throw new InvalidPlayError("Tenés que colocar al menos una ficha.");
  }
  if (placements.length > RACK_SIZE) {
    throw new InvalidPlayError("No podés colocar más de 7 fichas en un turno.");
  }

  // 1. All placements must be on empty squares and unique.
  const placedAt = new Map();
  for (const p of placements) {
    if (!inBounds(p.row, p.col)) {
      throw new InvalidPlayError("Hay una ficha fuera del tablero.");
    }
    if (board[p.row][p.col] !== null) {
      throw new InvalidPlayError("Hay una ficha sobre una casilla ocupada.");
    }
    const key = `${p.row},${p.col}`;
    if (placedAt.has(key)) {
      throw new InvalidPlayError("Dos fichas en la misma casilla.");
    }
    placedAt.set(key, p.letter.toUpperCase());
  }

  // 2. All placed tiles share a row or a column.
  const rows = new Set(placements.map((p) => p.row));
  const cols = new Set(placements.map((p) => p.col));
  let direction;
  if (rows.size === 1) direction = "H";
  else if (cols.size === 1) direction = "V";
  else throw new InvalidPlayError("Las fichas tienen que estar en una misma fila o columna.");

  // 3. Together with existing tiles they must form a contiguous run.
  const merged = board.map((row) => row.slice());
  for (const p of placements) merged[p.row][p.col] = p.letter.toUpperCase();

  if (direction === "H") {
    const r = placements[0].row;
    const placedCols = placements.map((p) => p.col).sort((a, b) => a - b);
    const minC = placedCols[0];
    const maxC = placedCols[placedCols.length - 1];
    for (let c = minC; c <= maxC; c++) {
      if (merged[r][c] === null) {
        throw new InvalidPlayError("Las fichas tienen que ser contiguas.");
      }
    }
  } else {
    const c = placements[0].col;
    const placedRows = placements.map((p) => p.row).sort((a, b) => a - b);
    const minR = placedRows[0];
    const maxR = placedRows[placedRows.length - 1];
    for (let r = minR; r <= maxR; r++) {
      if (merged[r][c] === null) {
        throw new InvalidPlayError("Las fichas tienen que ser contiguas.");
      }
    }
  }

  // 4. First move must cover the center; every later move must touch
  //    an existing tile.
  if (isFirstMove) {
    const coversCenter = placements.some(
      (p) => p.row === CENTER && p.col === CENTER,
    );
    if (!coversCenter) {
      throw new InvalidPlayError("La primera jugada tiene que cubrir el centro.");
    }
  } else {
    const touchesExisting = placements.some(({ row, col }) => {
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nr = row + dr;
        const nc = col + dc;
        if (inBounds(nr, nc) && board[nr][nc] !== null) return true;
      }
      return false;
    });
    if (!touchesExisting) {
      throw new InvalidPlayError("La jugada tiene que tocar una palabra existente.");
    }
  }

  // 5. Collect every word formed by this play.
  const words = collectWords(merged, placements, direction);
  if (words.length === 0) {
    throw new InvalidPlayError("La jugada no forma ninguna palabra.");
  }

  // 6. Validate every word against the dictionary.
  for (const w of words) {
    const text = w.tiles.map((t) => t.letter).join("").toLowerCase();
    if (!dictionary.has(text)) {
      throw new InvalidPlayError(`"${text.toUpperCase()}" no está en el diccionario.`);
    }
  }

  // 7. Score the move.
  const placedKeys = new Set(placements.map((p) => `${p.row},${p.col}`));
  let totalScore = 0;
  const scoredWords = [];
  for (const w of words) {
    let wordScore = 0;
    let wordMultiplier = 1;
    for (const tile of w.tiles) {
      const key = `${tile.row},${tile.col}`;
      const isNew = placedKeys.has(key);
      const bonus = BONUSES[tile.row][tile.col];
      let value = letterValue(language, tile.letter);
      if (isNew && bonus === "TL") value *= 3;
      if (isNew && bonus === "DL") value *= 2;
      wordScore += value;
      if (isNew && (bonus === "TW")) wordMultiplier *= 3;
      if (isNew && (bonus === "DW" || bonus === "ST")) wordMultiplier *= 2;
    }
    wordScore *= wordMultiplier;
    scoredWords.push({
      word: w.tiles.map((t) => t.letter).join(""),
      points: wordScore,
    });
    totalScore += wordScore;
  }

  // 8. Bingo: using all 7 of your rack tiles in one turn = +50.
  if (placements.length === RACK_SIZE) {
    totalScore += BINGO_BONUS;
    scoredWords.push({ word: "BINGO!", points: BINGO_BONUS });
  }

  return { score: totalScore, words: scoredWords, board: merged };
}

function collectWords(board, placements, direction) {
  const seen = new Set();
  const words = [];

  function wordAt(row, col, dir) {
    let r = row;
    let c = col;
    while (
      inBounds(dir === "H" ? r : r - 1, dir === "H" ? c - 1 : c) &&
      board[dir === "H" ? r : r - 1]?.[dir === "H" ? c - 1 : c] !== null
    ) {
      if (dir === "H") c--;
      else r--;
    }
    const tiles = [];
    while (inBounds(r, c) && board[r][c] !== null) {
      tiles.push({ row: r, col: c, letter: board[r][c] });
      if (dir === "H") c++;
      else r++;
    }
    if (tiles.length < 2) return null;
    const key = `${dir}:${tiles[0].row},${tiles[0].col}:${tiles.length}`;
    if (seen.has(key)) return null;
    seen.add(key);
    return { tiles, direction: dir };
  }

  // Main word: along the axis of the play.
  const mainWord = wordAt(placements[0].row, placements[0].col, direction);
  if (mainWord) words.push(mainWord);

  // Cross words: perpendicular through each placed tile.
  const cross = direction === "H" ? "V" : "H";
  for (const p of placements) {
    const w = wordAt(p.row, p.col, cross);
    if (w) words.push(w);
  }

  return words;
}

// Take tiles from a player's rack to play them. Returns the indices removed.
export function consumeRack(rack, placements) {
  const remaining = rack.slice();
  for (const p of placements) {
    const target = p.letter.toUpperCase();
    const idx = remaining.indexOf(target);
    if (idx === -1) {
      throw new InvalidPlayError(`No tenés la ficha "${target}" en el atril.`);
    }
    remaining.splice(idx, 1);
  }
  return remaining;
}
