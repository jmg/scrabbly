# -*- coding: utf-8 -*-

class InvalidPlayError(Exception):

    pass


class ScrabbleMatrix(dict):

    def has_free_space(self, word):

        return all([not tile.coords() in self for tile in word.tiles])

    def add_word(self, word):

        for tile in word.tiles:
            self[tile.coords()] = tile


class Board(object):

    def __init__(self, size):

        self.height, self.width = size
        self.dictionary = Dictionary()
        self.matrix = ScrabbleMatrix()

    def play(self, word):

        if self.is_valid_play(word):
            self.matrix.add_word(word)
        else:
            raise InvalidPlayError()

    def is_valid_play(self, word):

        return self.dictionary.is_valid_word(word) and word.has_valid_position() and self.matrix.has_free_space(word)


class Dictionary(object):

    _valid_words = ["MAKE", "A", "LIST", "OF", "WORDS"]

    letters = {
        "A": 1, "B": 3, "C": 2, "D": 2, "E": 1, "F": 4, "G": 3, "H": 4,
        "I": 1, "J": 8, "L": 1, "M": 3, "N": 1, "Ñ": 8, "O": 1, "P": 3,
        "Q": 10, "R": 1, "S": 1, "T": 1, "U": 1, "V": 4, "X": 10, "Y": 8,
        "Z": 10,
    }

    def is_valid_word(self, word):

        return unicode(word) in self._valid_words


class Tile(object):

    def __init__(self, char, position):

        self.char = char
        self.x, self.y = position

    def __unicode__(self):

        return self.char

    def coords(self):

        return self.x, self.y


class Word(object):

    def __init__(self, tiles):

        self.tiles = tiles

    def __unicode__(self):

        return "".join([unicode(char) for char in self.tiles])

    def has_valid_position(self):

        return self.is_vertical() or self.is_horizontal()

    def is_vertical(self):

        return self._get_coord_values_set("x") == 1 and self.is_continous("y")

    def is_horizontal(self):

        return self._get_coord_values_set("y") == 1 and self.is_continous("x")

    def _get_coord_values_set(self, coord):

        return len(set(self._get_values(coord)))

    def is_continous(self, coord):

        coords = sorted(self._get_values(coord))

        for current, next in zip(coords[:-1], coords[1:]):
            if current != next - 1:
                return False

        return True

    def _get_values(self, coord):

        return [getattr(tile, coord) for tile in self.tiles]

    def get_points(self):

        return sum([Dictionary().letters[unicode(tile)] for tile in self.tiles])
