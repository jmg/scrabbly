from __future__ import annotations

import re
from pathlib import Path
from random import choice

_DATA_DIR = Path(__file__).resolve().parent


class InvalidPlayError(Exception):
    pass


class ScrabbleMatrix(dict):

    def has_free_space(self, word):
        return all(tile.coords() not in self for tile in word.tiles)

    def _is_empty(self):
        return not self

    def _is_bordering_word(self, word):
        for tile in self.values():
            for word_tile in word.tiles:
                if tile.is_bordering(word_tile):
                    return True
        return False

    def is_bordering_word(self, word):
        return self._is_empty() or self._is_bordering_word(word)

    def is_valid_play(self, word):
        return self.is_bordering_word(word)

    def add_words(self, words):
        for word in words:
            self.add_word(word)

    def add_word(self, word):
        for tile in word.tiles:
            self[tile.coords()] = tile

    def _find_word(self, word, tile, border_tile):
        new_word = Word([tile, border_tile])

        if new_word.alignment == word.alignment:
            new_word.join(word)

        return new_word.find_word(self)

    def join_word(self, word):
        if self._is_empty():
            return [word]

        words = []

        new_word = word.find_word(self)
        if new_word is not None:
            words.append(new_word)

        for tile, border in word.get_borders():
            border_tile = self.get(border)
            if border_tile is not None:
                new_word = self._find_word(word, tile, border_tile)
                if new_word not in words:
                    words.append(new_word)

        return words


_TILES_QUANTITY = {
    "spanish": {
        "A": 9, "B": 2, "C": 2, "D": 4, "E": 12, "F": 2, "G": 3, "H": 2,
        "I": 9, "J": 1, "L": 4, "M": 2, "N": 6, "Ñ": 1, "O": 8, "P": 1,
        "Q": 1, "R": 6, "S": 4, "T": 6, "U": 4, "V": 2, "X": 1, "Y": 2,
        "Z": 1,
    },
    "english": {
        "A": 9, "B": 2, "C": 2, "D": 4, "E": 12, "F": 2, "G": 3, "H": 2,
        "I": 9, "J": 1, "K": 1, "L": 4, "M": 2, "N": 6, "O": 8, "P": 1,
        "Q": 1, "R": 6, "S": 4, "T": 6, "U": 4, "V": 2, "W": 2, "X": 1,
        "Y": 2, "Z": 1,
    },
}


class Board:

    def __init__(self, size, players, language="english"):
        self.height, self.width = size
        self.matrix = ScrabbleMatrix()
        self.language = language
        self.tiles_quantity = dict(_TILES_QUANTITY[language])
        self.players = players
        self.turn = 0

    def next_player(self):
        if self.turn >= len(self.players) - 1:
            self.turn = 0
        else:
            self.turn += 1

    def _get_all_letters(self):
        letters = []
        for letter, count in self.tiles_quantity.items():
            if count > 0:
                letters.extend([letter] * count)
        return letters

    def _get_random_tile(self):
        letters = self._get_all_letters()
        if not letters:
            raise InvalidPlayError("No more tiles left")

        letter = choice(letters)
        self.tiles_quantity[letter] -= 1
        return letter

    def get_random_tiles(self, quantity=7):
        return [self._get_random_tile() for _ in range(quantity)]

    def play(self, word):
        self.players[self.turn].points += self._play(word)
        self.next_player()

    def _play(self, word):
        if not word.alignment.is_valid():
            raise InvalidPlayError(f"Wrong word alignment: {word}")

        if not self.matrix.has_free_space(word):
            raise InvalidPlayError(f"Tiles don't have free space: {word}")

        words = self.matrix.join_word(word)
        points = 0

        if not words:
            raise InvalidPlayError(f"Wrong word alignment: {word}")

        for w in words:
            if not w.is_valid(self):
                raise InvalidPlayError(f"Word is not valid: {w}")

            if not self.matrix.is_valid_play(w):
                raise InvalidPlayError(f"Board is not valid play: {w}")

            points += w.get_points(self)

        self.matrix.add_words(words)
        return points


_LETTER_POINTS = {
    "spanish": {
        "A": 1, "B": 3, "C": 3, "D": 2, "E": 1, "F": 4, "G": 2, "H": 4,
        "I": 1, "J": 8, "L": 1, "M": 3, "N": 1, "Ñ": 8, "O": 1, "P": 3,
        "Q": 10, "R": 1, "S": 1, "T": 1, "U": 1, "V": 4, "X": 8, "Y": 4,
        "Z": 10,
    },
    "english": {
        "A": 1, "B": 3, "C": 3, "D": 2, "E": 1, "F": 4, "G": 2, "H": 4,
        "I": 1, "J": 8, "K": 5, "L": 1, "M": 3, "N": 1, "O": 1, "P": 3,
        "Q": 10, "R": 1, "S": 1, "T": 1, "U": 1, "W": 4, "V": 4, "X": 8,
        "Y": 4, "Z": 10,
    },
}


class Dictionary:

    _word_cache: dict[str, frozenset[str]] = {}

    def __init__(self, language="english"):
        self.language = language

    @property
    def letters(self):
        return _LETTER_POINTS[self.language]

    def _load_words(self) -> frozenset[str]:
        cached = self._word_cache.get(self.language)
        if cached is not None:
            return cached

        path = _DATA_DIR / f"{self.language}.txt"
        text = path.read_text(encoding="utf-8", errors="replace")

        if text.lstrip().startswith("words"):
            tokens = re.findall(r"'([^']+)'", text)
        else:
            tokens = text.split()

        words = frozenset(token.lower() for token in tokens)
        self._word_cache[self.language] = words
        return words

    def __contains__(self, word: str) -> bool:
        return word.lower() in self._load_words()


class Tile:

    def __init__(self, char, position):
        self.char = char
        self.x, self.y = position

    def __eq__(self, other):
        return (
            isinstance(other, Tile)
            and self.coords() == other.coords()
            and self.char == other.char
        )

    def __hash__(self):
        return hash((self.char, self.x, self.y))

    def __lt__(self, other):
        if not isinstance(other, Tile):
            return NotImplemented
        return (self.x, self.y, self.char) < (other.x, other.y, other.char)

    def __str__(self):
        return self.char

    def _is_bordering_axis(self, tile, axis):
        return abs(getattr(self, axis) - getattr(tile, axis)) <= 1

    def _is_bordering_x(self, tile):
        return self._is_bordering_axis(tile, "x") and self.y == tile.y

    def _is_bordering_y(self, tile):
        return self._is_bordering_axis(tile, "y") and self.x == tile.x

    def is_bordering(self, tile):
        return self._is_bordering_x(tile) or self._is_bordering_y(tile)

    def coords(self):
        return (self.x, self.y)

    def get_borders(self, word):
        borders = []
        word_coords = word.coords()
        for x_offset, y_offset in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
            border = (self.x + x_offset, self.y + y_offset)
            if border not in word_coords:
                borders.append((self, border))
        return borders

    def __repr__(self):
        return f"{self.char} {self.coords()}"


class WordAlignment:

    axis: str = ""
    opposite_axis: str = ""

    def __eq__(self, other):
        return isinstance(other, WordAlignment) and self.axis == other.axis

    def __hash__(self):
        return hash(self.axis)

    def is_valid(self):
        return False

    def _finder(self, tile, increment, matrix):
        tiles = []
        x, y = self._increment_axis((tile.x, tile.y), increment)
        while True:
            found = matrix.get((x, y))
            if found is None:
                break
            tiles.append(found)
            x, y = self._increment_axis((x, y), increment)
        return tiles

    def find_word(self, word, matrix):
        tiles = []
        for index, increment in [(-1, 1), (-1, -1), (0, -1), (0, 1)]:
            tiles.extend(self._finder(word.tiles[index], increment, matrix))

        word.join_tiles(tiles)

        if len(word.tiles) == 1:
            return None

        return word

    def _increment_axis(self, coords, increment):
        raise InvalidPlayError("Invalid word alignment")


class HorizontalAlignment(WordAlignment):

    axis = "x"
    opposite_axis = "y"

    def is_valid(self):
        return True

    def _increment_axis(self, coords, increment):
        x, y = coords
        return x + increment, y


class VerticalAlignment(WordAlignment):

    axis = "y"
    opposite_axis = "x"

    def is_valid(self):
        return True

    def _increment_axis(self, coords, increment):
        x, y = coords
        return x, y + increment


class Word:

    def __init__(self, tiles):
        self._alignment_resolvers = (
            (self._is_horizontal, HorizontalAlignment),
            (self._is_vertical, VerticalAlignment),
        )
        self.tiles = tiles
        self.alignment = self._get_alignment()

        if self.alignment.is_valid():
            self._sort()

    def __str__(self):
        return "".join(str(tile) for tile in self.tiles).lower()

    def __repr__(self):
        return f"{self} {[repr(tile) for tile in self.tiles]}"

    def __eq__(self, other):
        return (
            isinstance(other, Word)
            and self.coords() == other.coords()
            and self.tiles == other.tiles
        )

    def __hash__(self):
        return hash(tuple(self.tiles))

    def _sort(self):
        self.tiles = sorted(
            self.tiles, key=lambda tile: getattr(tile, self.alignment.axis)
        )

    def _get_alignment(self):
        for predicate, alignment in self._alignment_resolvers:
            if predicate():
                return alignment()
        return WordAlignment()

    def _is_vertical(self):
        return len(self._get_coord_values_set("x")) == 1

    def _is_horizontal(self):
        return len(self._get_coord_values_set("y")) == 1

    def _has_valid_position(self):
        return self.alignment.is_valid() and self._is_continous(self.alignment.axis)

    def _get_coord_values_set(self, coord):
        return set(self._get_values(coord))

    def _is_continous(self, coord):
        coords = sorted(self._get_values(coord))
        return all(b - a == 1 for a, b in zip(coords[:-1], coords[1:]))

    def _get_values(self, coord):
        return [getattr(tile, coord) for tile in self.tiles]

    def coords(self):
        return [tile.coords() for tile in self.tiles]

    def get_points(self, board):
        letters = Dictionary(board.language).letters
        return sum(letters[str(tile)] for tile in self.tiles)

    def is_valid(self, board):
        return str(self) in Dictionary(board.language) and self._has_valid_position()

    def get_borders(self):
        borders = []
        for tile in self.tiles:
            borders.extend(tile.get_borders(self))
        return sorted(set(borders))

    def find_word(self, matrix):
        return self.alignment.find_word(self, matrix)

    def join(self, word):
        self.join_tiles(word.tiles)

    def join_tiles(self, tiles):
        existing = set(self.coords())
        for tile in tiles:
            if tile.coords() not in existing:
                self.tiles.append(tile)
                existing.add(tile.coords())
        self._sort()


class Player:

    def __init__(self, name):
        self.points = 0
        self.name = name
