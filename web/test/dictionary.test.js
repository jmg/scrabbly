import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isWord, loadDictionary } from "../server/dictionary.js";

describe("loadDictionary('english')", () => {
  it("returns a Set of words", async () => {
    const words = await loadDictionary("english");
    assert.ok(words instanceof Set);
    assert.ok(words.size > 1000, `expected many words, got ${words.size}`);
  });

  it("contains common words", async () => {
    const words = await loadDictionary("english");
    assert.ok(words.has("duck"));
    assert.ok(words.has("hello"));
    assert.ok(words.has("of"));
  });

  it("does not contain obvious nonsense", async () => {
    const words = await loadDictionary("english");
    assert.ok(!words.has("xyzzy"));
    assert.ok(!words.has("zzzzzz"));
  });
});

describe("loadDictionary('spanish')", () => {
  it("returns a Set with many words", async () => {
    const words = await loadDictionary("spanish");
    assert.ok(words instanceof Set);
    assert.ok(words.size > 50000, `expected many words, got ${words.size}`);
  });

  it("contains common Spanish words", async () => {
    const words = await loadDictionary("spanish");
    assert.ok(words.has("pato"));
    assert.ok(words.has("perro"));
    assert.ok(words.has("casa"));
  });

  it("decodes accented characters from the source file", async () => {
    const words = await loadDictionary("spanish");
    // Try a few common accented words. At least one should be present.
    const accented = ["café", "más", "está", "perdón", "canción", "niña"];
    const found = accented.filter((w) => words.has(w));
    assert.ok(
      found.length > 0,
      `expected some accented words to be present (tried ${accented.join(", ")})`,
    );
  });
});

describe("loadDictionary() caching", () => {
  it("returns the same Set on repeated calls", async () => {
    const a = await loadDictionary("english");
    const b = await loadDictionary("english");
    assert.equal(a, b);
  });
});

describe("isWord()", () => {
  it("does case-insensitive lookups", async () => {
    const words = await loadDictionary("english");
    assert.ok(isWord(words, "DUCK"));
    assert.ok(isWord(words, "Duck"));
    assert.ok(isWord(words, "duck"));
  });
});
