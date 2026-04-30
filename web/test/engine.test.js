import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  InvalidPlayError,
  buildBag,
  consumeRack,
  drawTiles,
  emptyBoard,
  evaluateMove,
  shuffle,
} from "../server/engine.js";
import { BOARD_SIZE, RACK_SIZE } from "../server/bonuses.js";

const dict = (...words) => new Set(words.map((w) => w.toLowerCase()));

function placeFresh(board, placements) {
  const next = board.map((row) => row.slice());
  for (const p of placements) next[p.row][p.col] = p.letter.toUpperCase();
  return next;
}

describe("emptyBoard()", () => {
  it("returns a 15x15 grid of nulls", () => {
    const b = emptyBoard();
    assert.equal(b.length, BOARD_SIZE);
    for (const row of b) {
      assert.equal(row.length, BOARD_SIZE);
      for (const cell of row) assert.equal(cell, null);
    }
  });
});

describe("buildBag()", () => {
  it("produces exactly the expected number of English tiles", () => {
    const bag = buildBag("english");
    assert.equal(bag.length, 98); // 100 standard minus 2 blanks
  });

  it("produces a Spanish bag", () => {
    const bag = buildBag("spanish");
    assert.ok(bag.length > 80);
    assert.ok(bag.includes("Ñ"));
  });

  it("throws on an unknown language", () => {
    assert.throws(() => buildBag("klingon"));
  });
});

describe("drawTiles()", () => {
  it("draws N tiles from the bag and shrinks it", () => {
    const bag = ["A", "B", "C", "D", "E"];
    const drawn = drawTiles(bag, 3);
    assert.equal(drawn.length, 3);
    assert.equal(bag.length, 2);
  });

  it("returns whatever's left when the bag is short", () => {
    const bag = ["A", "B"];
    const drawn = drawTiles(bag, 5);
    assert.equal(drawn.length, 2);
    assert.equal(bag.length, 0);
  });
});

describe("shuffle()", () => {
  it("preserves length and items", () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr.slice());
    assert.equal(shuffled.length, 5);
    assert.deepEqual(shuffled.slice().sort(), [1, 2, 3, 4, 5]);
  });
});

describe("consumeRack()", () => {
  it("removes the played letters from the rack", () => {
    const rack = ["A", "B", "C", "D", "E", "F", "G"];
    const remaining = consumeRack(rack, [
      { row: 0, col: 0, letter: "A" },
      { row: 0, col: 1, letter: "C" },
    ]);
    assert.deepEqual(remaining, ["B", "D", "E", "F", "G"]);
  });

  it("throws when a played letter isn't on the rack", () => {
    const rack = ["A", "B"];
    assert.throws(
      () => consumeRack(rack, [{ row: 0, col: 0, letter: "Z" }]),
      InvalidPlayError,
    );
  });

  it("does not mutate the input rack", () => {
    const rack = ["A", "B"];
    consumeRack(rack, [{ row: 0, col: 0, letter: "A" }]);
    assert.deepEqual(rack, ["A", "B"]);
  });
});

describe("evaluateMove() — required positioning", () => {
  it("rejects an empty placement", () => {
    assert.throws(
      () =>
        evaluateMove({
          board: emptyBoard(),
          language: "english",
          dictionary: dict("of"),
          placements: [],
          isFirstMove: true,
        }),
      InvalidPlayError,
    );
  });

  it("rejects a placement out of bounds", () => {
    assert.throws(
      () =>
        evaluateMove({
          board: emptyBoard(),
          language: "english",
          dictionary: dict("of"),
          placements: [{ row: 15, col: 7, letter: "O" }],
          isFirstMove: true,
        }),
      InvalidPlayError,
    );
  });

  it("rejects two tiles on the same square", () => {
    assert.throws(
      () =>
        evaluateMove({
          board: emptyBoard(),
          language: "english",
          dictionary: dict("of"),
          placements: [
            { row: 7, col: 7, letter: "O" },
            { row: 7, col: 7, letter: "F" },
          ],
          isFirstMove: true,
        }),
      InvalidPlayError,
    );
  });

  it("rejects a placement on an occupied square", () => {
    const board = emptyBoard();
    board[7][7] = "O";
    assert.throws(
      () =>
        evaluateMove({
          board,
          language: "english",
          dictionary: dict("of"),
          placements: [{ row: 7, col: 7, letter: "X" }],
          isFirstMove: false,
        }),
      InvalidPlayError,
    );
  });

  it("rejects tiles not in a single row or column", () => {
    assert.throws(
      () =>
        evaluateMove({
          board: emptyBoard(),
          language: "english",
          dictionary: dict("of"),
          placements: [
            { row: 7, col: 7, letter: "O" },
            { row: 8, col: 8, letter: "F" },
          ],
          isFirstMove: true,
        }),
      InvalidPlayError,
    );
  });

  it("rejects a gap on the play axis with no existing tile filling it", () => {
    assert.throws(
      () =>
        evaluateMove({
          board: emptyBoard(),
          language: "english",
          dictionary: dict("of"),
          placements: [
            { row: 7, col: 6, letter: "O" },
            { row: 7, col: 8, letter: "F" }, // gap at col 7
          ],
          isFirstMove: true,
        }),
      InvalidPlayError,
    );
  });

  it("rejects a first move that doesn't cover the center", () => {
    assert.throws(
      () =>
        evaluateMove({
          board: emptyBoard(),
          language: "english",
          dictionary: dict("of"),
          placements: [
            { row: 0, col: 0, letter: "O" },
            { row: 0, col: 1, letter: "F" },
          ],
          isFirstMove: true,
        }),
      InvalidPlayError,
    );
  });

  it("rejects a later move that doesn't touch any existing tile", () => {
    const board = emptyBoard();
    board[7][7] = "O";
    board[7][8] = "F";
    assert.throws(
      () =>
        evaluateMove({
          board,
          language: "english",
          dictionary: dict("of", "go"),
          placements: [
            { row: 0, col: 0, letter: "G" },
            { row: 0, col: 1, letter: "O" },
          ],
          isFirstMove: false,
        }),
      InvalidPlayError,
    );
  });
});

describe("evaluateMove() — dictionary checks", () => {
  it("rejects a word not in the dictionary", () => {
    assert.throws(
      () =>
        evaluateMove({
          board: emptyBoard(),
          language: "english",
          dictionary: dict("hello"),
          placements: [
            { row: 7, col: 7, letter: "Z" },
            { row: 7, col: 8, letter: "Q" },
          ],
          isFirstMove: true,
        }),
      /no está en el diccionario/i,
    );
  });

  it("rejects when a cross word is invalid even if main word is valid", () => {
    // Main word: "AT" placed across (7,7)-(7,8). Existing "I" sits below the
    // 'A' so the cross word is "AI". Dictionary has only "at".
    const board = emptyBoard();
    board[8][7] = "I";
    assert.throws(
      () =>
        evaluateMove({
          board,
          language: "english",
          dictionary: dict("at"),
          placements: [
            { row: 7, col: 7, letter: "A" },
            { row: 7, col: 8, letter: "T" },
          ],
          isFirstMove: true,
        }),
      /no está en el diccionario/i,
    );
  });
});

describe("evaluateMove() — scoring", () => {
  it("scores a simple first move with the center DW multiplier", () => {
    // OF horizontally across (7,7)-(7,8): O=1, F=4 -> 5, DW (center) -> 10.
    const result = evaluateMove({
      board: emptyBoard(),
      language: "english",
      dictionary: dict("of"),
      placements: [
        { row: 7, col: 7, letter: "O" },
        { row: 7, col: 8, letter: "F" },
      ],
      isFirstMove: true,
    });
    assert.equal(result.score, 10);
    assert.equal(result.words[0].word, "OF");
    assert.equal(result.words[0].points, 10);
  });

  it("does not re-apply premiums to already-locked tiles", () => {
    // Pre-place the OF main word; then attach 'S' at (7,9). The new tile is
    // not on a premium square, so OFS should score 1+4+1 = 6 with no
    // multipliers from already-locked O/F.
    const board = emptyBoard();
    board[7][7] = "O";
    board[7][8] = "F";
    const result = evaluateMove({
      board,
      language: "english",
      dictionary: dict("ofs"),
      placements: [{ row: 7, col: 9, letter: "S" }],
      isFirstMove: false,
    });
    assert.equal(result.score, 6);
  });

  it("counts both main word and cross word", () => {
    // First put OF at (7,7)-(7,8). Then place I,T vertically at (8,7),(9,7).
    // Main word vertical: O(7,7) + I(8,7) + T(9,7) = "OIT" - we'll just
    // include that in the dictionary. Cross word at (8,7) is just I, length 1
    // so ignored. Cross word at (9,7) length 1. So only main word counts.
    // To exercise cross words: place AT at (7,7)-(7,8) with existing I at
    // (6,7) so cross word "IA" is formed at column 7.
    const board = emptyBoard();
    board[6][7] = "I";
    const result = evaluateMove({
      board,
      language: "english",
      dictionary: dict("at", "ia"),
      placements: [
        { row: 7, col: 7, letter: "A" },
        { row: 7, col: 8, letter: "T" },
      ],
      isFirstMove: true,
    });
    // Main "AT" with center DW: (1+1)*2 = 4
    // Cross "IA": I existing (no premium re-applied), A is new on center DW
    //   -> letter values I=1, A=1, word multiplier from new A (DW) = 2
    //   -> (1+1)*2 = 4
    // Total = 8
    assert.equal(result.score, 8);
    const wordTexts = result.words.map((w) => w.word);
    assert.ok(wordTexts.includes("AT"));
    assert.ok(wordTexts.includes("IA"));
  });

  it("awards +50 bingo bonus when all 7 tiles are placed", () => {
    // Construct a 7-letter horizontal play across the center using a made-up
    // word in our test dictionary.
    const word = "ABCDEFG";
    const placements = [...word].map((letter, i) => ({
      row: 7,
      col: 4 + i,
      letter,
    }));
    const result = evaluateMove({
      board: emptyBoard(),
      language: "english",
      dictionary: dict(word),
      placements,
      isFirstMove: true,
    });
    const bingoEntry = result.words.find((w) => w.word === "BINGO!");
    assert.ok(bingoEntry, "expected a BINGO! entry in scored words");
    assert.equal(bingoEntry.points, 50);
    // Total score must include the +50 bonus on top of the word score.
    const wordPoints = result.words
      .filter((w) => w.word !== "BINGO!")
      .reduce((a, w) => a + w.points, 0);
    assert.equal(result.score, wordPoints + 50);
  });

  it("does not mutate the input board", () => {
    const board = emptyBoard();
    const snapshot = board.map((r) => r.slice());
    evaluateMove({
      board,
      language: "english",
      dictionary: dict("of"),
      placements: [
        { row: 7, col: 7, letter: "O" },
        { row: 7, col: 8, letter: "F" },
      ],
      isFirstMove: true,
    });
    assert.deepEqual(board, snapshot);
  });

  it("returns a new board with the placed tiles applied", () => {
    const board = emptyBoard();
    const result = evaluateMove({
      board,
      language: "english",
      dictionary: dict("of"),
      placements: [
        { row: 7, col: 7, letter: "O" },
        { row: 7, col: 8, letter: "F" },
      ],
      isFirstMove: true,
    });
    assert.equal(result.board[7][7], "O");
    assert.equal(result.board[7][8], "F");
    // No accidental writes elsewhere:
    const expected = placeFresh(board, [
      { row: 7, col: 7, letter: "O" },
      { row: 7, col: 8, letter: "F" },
    ]);
    assert.deepEqual(result.board, expected);
  });

  it("throws if more than 7 tiles are submitted", () => {
    const placements = "ABCDEFGH".split("").map((letter, i) => ({
      row: 7,
      col: i,
      letter,
    }));
    assert.throws(
      () =>
        evaluateMove({
          board: emptyBoard(),
          language: "english",
          dictionary: dict("abcdefgh"),
          placements,
          isFirstMove: true,
        }),
      InvalidPlayError,
    );
  });
});

describe("evaluateMove() — single-tile placements", () => {
  it("a single tile that extends an existing word forms it", () => {
    const board = emptyBoard();
    board[7][7] = "O";
    board[7][8] = "F";
    const result = evaluateMove({
      board,
      language: "english",
      dictionary: dict("ofs"),
      placements: [{ row: 7, col: 9, letter: "S" }],
      isFirstMove: false,
    });
    assert.equal(result.score, 6);
    assert.deepEqual(
      result.words.map((w) => w.word),
      ["OFS"],
    );
  });
});
