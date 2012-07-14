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

        return self.is_bordering_word(word)

    def add_words(self, words):

        for word in words:
            self.add_word(word)

    def add_word(self, word):

        for tile in word.tiles:
            self[tile.coords()] = tile

    def _find_word(self, word, tile, border_tile):

        new_word = Word([tile, border_tile])

        if new_word.alignment.axis == word.alignment.axis:
            new_word.join(word)

        return new_word.find_word(self)

    def join_word(self, word):

        if self._is_empty():
            return [word]

        words = []
        if word.is_valid():
            words.append(word)

        for tile, border in word.get_borders():
            border_tile = self.get(border)
            if border_tile is not None:
                words.append(self._find_word(word, tile, border_tile))

        return words


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

        self.players[self.turn].points += self._play(word)
        self.next_player()

    def _play(self, word):

        if not word.alignment.is_valid():
            raise InvalidPlayError("Wrong word alignment: %s" % unicode(word))

        words = self.matrix.join_word(word)
        points = 0

        for word in words:

            if not word.is_valid():
                raise InvalidPlayError("Word is not valid: %s" % unicode(word))

            if not self.matrix.is_valid_play(word):
                raise InvalidPlayError("Board is not valid play: : %s" % unicode(word))

            points += word.get_points()

        self.matrix.add_words(words)

        return points


class Dictionary(object):

    words = ["MAKE", "A", "LIST", "OF", "WORDS", "WORD", "DO"]

    letters = {
        "A": 1, "B": 3, "C": 2, "D": 2, "E": 1, "F": 4, "G": 3, "H": 4,
        "I": 1, "J": 8, "K": 5, "L": 1, "M": 3, "N": 1, "Ñ": 8, "O": 1, "P": 3,
        "Q": 10, "R": 1, "S": 1, "T": 1, "U": 1, "W": 10, "V": 4, "X": 10,
        "Y": 8, "Z": 10,
    }


class Tile(object):

    def __init__(self, char, position):

        self.char = char
        self.x, self.y = position

    def __unicode__(self):

        return self.char

    def _is_bordering_axis(self, tile, axis):

        self_axis = getattr(self, axis)
        tile_axis = getattr(tile, axis)

        return abs(self_axis - tile_axis) <= 1

    def _is_bordering_x(self, tile):

        return self._is_bordering_axis(tile, "x") and self.y == tile.y

    def _is_bordering_y(self, tile):

        return self._is_bordering_axis(tile, "y") and self.x == tile.x

    def is_bordering(self, tile):

        return self._is_bordering_x(tile) or self._is_bordering_y(tile)

    def coords(self):

        return (self.x, self.y)

    def get_up_border(self):

        return (self.x, self.y - 1)

    def get_down_border(self):

        return (self.x, self.y + 1)

    def get_right_border(self):

        return (self.x + 1, self.y)

    def get_left_border(self):

        return (self.x - 1, self.y)

    def get_borders(self, word):

        borders = [self.get_up_border(), self.get_down_border(), self.get_right_border(), self.get_left_border()]
        return [(self, border) for border in borders if border not in word.coords()]

    def __repr__(self):

        return "%s %s" % (self.char, str(self.coords()))


class WordAlignment(object):

    def is_valid(self):

        return False

    def _finder(self, tiles, tile, increment, matrix):

        x, y = self._increment_axis((tile.x, tile.y), increment)

        while True:
            tile = matrix.get((x, y))
            if tile is None:
                break
            else:
                tiles.append(tile)
                x, y = self._increment_axis((x,y), increment)

        return tiles

    def find_word(self, word, matrix):

        word.tiles = self._finder(word.tiles, word.tiles[-1], 1, matrix)
        word.tiles = self._finder(word.tiles, word.tiles[0], -1, matrix)
        return Word(word.tiles)


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


class Word(object):

    def __init__(self, tiles):

        self.alignments = {self._is_horizontal: HorizontalAlignment, self._is_vertical: VerticalAlignment }
        self.tiles = tiles

        self.alignment = self._get_alignment()

        if self.alignment.is_valid():
            self.tiles = self._sort()

    def __unicode__(self):

        return "".join([unicode(char) for char in self.tiles])

    def __repr__(self):

        return "%s %s" % (unicode(self), str([repr(tile) for tile in self.tiles]))

    def _sort(self):

        return sorted(self.tiles, key=lambda tile: getattr(tile, self.alignment.axis))

    def _get_alignment(self):

        for function, alignment in self.alignments.iteritems():
            if function():
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

    def _get_axis_value(self, axis):

        return self._get_coord_values_set(axis)[0]

    def _is_continous(self, coord):

        coords = sorted(self._get_values(coord))

        for current, next in zip(coords[:-1], coords[1:]):
            if current != next - 1:
                return False

        return True

    def _get_values(self, coord):

        return [getattr(tile, coord) for tile in self.tiles]

    def coords(self):

        return [tile.coords() for tile in self.tiles]

    def get_points(self):

        return sum([Dictionary.letters[unicode(tile)] for tile in self.tiles])

    def is_valid(self):

        return unicode(self) in Dictionary.words and self._has_valid_position()

    def get_borders(self):

        borders = []
        for tile in self.tiles:
            borders.extend(tile.get_borders(self))

        return sorted(set(borders))

    def find_word(self, matrix):

        return self.alignment.find_word(self, matrix)

    def join(self, word):

        for tile in word.tiles:
            if tile.coords() not in self.coords():
                self.tiles.append(tile)

        self._sort()


class Player(object):

    def __init__(self, name):

        self.points = 0
        self.name = name
