import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "scrabbly");

function decodePythonEscapes(text) {
  // The Spanish file stores accented characters as literal "\xc3\xa9" sequences.
  // Convert those back to the proper UTF-8 bytes, then decode as UTF-8.
  const bytes = [];
  let i = 0;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (
      text[i] === "\\" &&
      text[i + 1] === "x" &&
      /[0-9a-fA-F]/.test(text[i + 2] ?? "") &&
      /[0-9a-fA-F]/.test(text[i + 3] ?? "")
    ) {
      bytes.push(parseInt(text.slice(i + 2, i + 4), 16));
      i += 4;
    } else if (c < 0x80) {
      bytes.push(c);
      i += 1;
    } else {
      // Already-multibyte char: re-encode as UTF-8.
      const utf8 = Buffer.from(text[i], "utf-8");
      for (const b of utf8) bytes.push(b);
      i += 1;
    }
  }
  return Buffer.from(bytes).toString("utf-8");
}

function parseWordList(language, raw) {
  if (language === "spanish") {
    const decoded = decodePythonEscapes(raw);
    const tokens = decoded.match(/'([^']+)'/g) ?? [];
    return tokens.map((t) => t.slice(1, -1).toLowerCase());
  }
  return raw
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

const cache = new Map();

export async function loadDictionary(language) {
  if (cache.has(language)) return cache.get(language);

  const path = join(DATA_DIR, `${language}.txt`);
  const raw = await readFile(path, "utf-8");
  const words = new Set(parseWordList(language, raw));
  cache.set(language, words);
  return words;
}

export function isWord(words, candidate) {
  return words.has(candidate.toLowerCase());
}
