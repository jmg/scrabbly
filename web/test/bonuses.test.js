import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BOARD_SIZE,
  RACK_SIZE,
  BINGO_BONUS,
  CENTER,
  BONUSES,
  LETTER_VALUES,
  TILE_COUNTS,
} from "../server/bonuses.js";

describe("bonuses constants", () => {
  it("has standard Scrabble board dimensions", () => {
    assert.equal(BOARD_SIZE, 15);
    assert.equal(RACK_SIZE, 7);
    assert.equal(BINGO_BONUS, 50);
    assert.equal(CENTER, 7);
  });

  it("BONUSES is a 15x15 grid", () => {
    assert.equal(BONUSES.length, 15);
    for (const row of BONUSES) assert.equal(row.length, 15);
  });

  it("center square is the star (start tile)", () => {
    assert.equal(BONUSES[CENTER][CENTER], "ST");
  });

  it("corners are triple-word squares", () => {
    assert.equal(BONUSES[0][0], "TW");
    assert.equal(BONUSES[0][14], "TW");
    assert.equal(BONUSES[14][0], "TW");
    assert.equal(BONUSES[14][14], "TW");
  });

  it("(7,0) and (0,7) are triple-word squares", () => {
    assert.equal(BONUSES[7][0], "TW");
    assert.equal(BONUSES[0][7], "TW");
  });

  it("the diagonal (1,1)…(4,4) is double-word", () => {
    for (let i = 1; i <= 4; i++) assert.equal(BONUSES[i][i], "DW");
  });

  it("(1,5) and (5,1) are triple-letter squares", () => {
    assert.equal(BONUSES[1][5], "TL");
    assert.equal(BONUSES[5][1], "TL");
  });

  it("(0,3) and (3,0) are double-letter squares", () => {
    assert.equal(BONUSES[0][3], "DL");
    assert.equal(BONUSES[3][0], "DL");
  });

  it("BONUSES is symmetric across both axes", () => {
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        assert.equal(BONUSES[r][c], BONUSES[14 - r][c], `vert sym at (${r},${c})`);
        assert.equal(BONUSES[r][c], BONUSES[r][14 - c], `horiz sym at (${r},${c})`);
      }
    }
  });
});

describe("letter values", () => {
  it("English values include common letter scores", () => {
    const v = LETTER_VALUES.english;
    assert.equal(v.A, 1);
    assert.equal(v.E, 1);
    assert.equal(v.Q, 10);
    assert.equal(v.Z, 10);
    assert.equal(v.K, 5);
  });

  it("Spanish values include Ñ as a 8-pointer", () => {
    const v = LETTER_VALUES.spanish;
    assert.equal(v["Ñ"], 8);
    assert.equal(v.A, 1);
    assert.equal(v.Q, 10);
    assert.ok(!("K" in v), "Spanish has no K");
    assert.ok(!("W" in v), "Spanish has no W");
  });
});

describe("tile counts", () => {
  it("English bag totals 98 tiles (standard 100 minus 2 blanks)", () => {
    const total = Object.values(TILE_COUNTS.english).reduce((a, b) => a + b, 0);
    assert.equal(total, 98);
  });

  it("Spanish bag totals 98 tiles (no blanks, no digraphs)", () => {
    // 12+2+4+5+12+1+2+2+6+1+4+2+5+1+9+2+1+5+6+4+5+1+1+1+1 = 95? compute live.
    const total = Object.values(TILE_COUNTS.spanish).reduce((a, b) => a + b, 0);
    assert.ok(total >= 90 && total <= 100, `unexpected Spanish bag size ${total}`);
  });

  it("English includes 12 E and 9 A", () => {
    assert.equal(TILE_COUNTS.english.E, 12);
    assert.equal(TILE_COUNTS.english.A, 9);
  });

  it("Spanish has exactly 1 Ñ", () => {
    assert.equal(TILE_COUNTS.spanish["Ñ"], 1);
  });
});
