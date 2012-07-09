# -*- coding: utf-8 -*-

class InvalidPlayError(Exception):

    pass


class ScrabbleMatrix(dict):

    def has_free_space(self, word):

        return all([not tile.coords() in self for tile in word.tiles])

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

        return self.has_free_space(word) and self.is_bordering_word(word)

    def add_word(self, word):

        for tile in word.tiles:
            self[tile.coords()] = tile

        return word.get_points()


class Board(object):

    def __init__(self, size, players):

        self.height, self.width = size
        self.dictionary = Dictionary()
        self.matrix = ScrabbleMatrix()

        self.players = players
        self.turn = 0

    def next_player(self):

        if self.turn >= len(self.players) - 1:
            self.turn = 0
        else:
            self.turn += 1

    def play(self, word):

        if self.is_valid_play(word):
            self.players[self.turn].points += self.matrix.add_word(word)
            self.next_player()
        else:
            raise InvalidPlayError()

    def is_valid_play(self, word):

        return self.dictionary.is_valid_word(word) and word.has_valid_position() and self.matrix.is_valid_play(word)


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

    def _is_bordering_axis(self, tile, axis):

        self_axis = getattr(self, axis)
        tile_axis = getattr(tile, axis)

        return abs(self_axis - tile_axis) <= 1

    def is_bordering_x(self, tile):

        return self._is_bordering_axis(tile, "x") and self.y == tile.y

    def is_bordering_y(self, tile):

        return self._is_bordering_axis(tile, "y") and self.x == tile.x

    def is_bordering(self, tile):

        return self.is_bordering_x(tile) or self.is_bordering_y(tile)

    def __repr__(self):

        return str(self.coords()) + " " + self.char


class Word(object):

    def __init__(self, tiles):

        self.alignments = {"x": self.is_horizontal, "y": self.is_vertical }
        self.tiles = tiles

        self.alignment = self._get_alignment()
        if self.alignment is not None:
            self.tiles = self._sort_word()

    def __unicode__(self):

        return "".join([unicode(char) for char in self.tiles])

    def _sort_word(self):

        return sorted(self.tiles, key=lambda tile: getattr(tile, self.alignment))

    def _get_alignment(self):

        for axis, function in self.alignments.iteritems():
            if function():
                return axis

    def has_valid_position(self):

        return self.alignment is not None

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


class Player(object):

    def __init__(self, name):

        self.points = 0
        self.name = name
