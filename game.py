class Board(object):

    def __init__(self, size):

        self.height, self.width = size
        self.dictionary = Dictionary()

    def is_valid_play(self, word):

        return self.dictionary.is_valid_word(word) and word.is_valid_position()


class Dictionary(object):

    _valid_words = ["MAKE", "A", "LIST", "OF", "WORDS"]

    def is_valid_word(self, word):

        return unicode(word) in self._valid_words


class Tile(object):

    def __init__(self, char, position):

        self.char = char
        self.x, self.y = position

    def __unicode__(self):

        return self.char


class Word(object):

    def __init__(self, tiles):

        self.tiles = tiles

    def __unicode__(self):

        return "".join([unicode(char) for char in self.tiles])

    def is_valid_position(self):

        return self.is_vertical() or self.is_horizontal()

    def is_vertical(self):

        return self._get_coord_values_set("y") == 1

    def is_horizontal(self):

        return self._get_coord_values_set("x") == 1

    def _get_coord_values_set(self, coord):

        return len(set([getattr(tile, coord) for tile in self.tiles]))


if '__main__' == __name__:

    import unittest

    class WordsTest(unittest.TestCase):

        def setUp(self):

            self.board = Board((10,10))

        def test_valid_word(self):

            word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
            self.assertTrue(self.board.is_valid_play(word))

        def test_invalid_word(self):

            word = Word([Tile("A", (0,0)), Tile("S", (1,0)), Tile("F", (2,0)), Tile("G", (3,0))])
            self.assertFalse(self.board.is_valid_play(word))

        def test_invalid_word_position(self):

            word = Word([Tile("O", (0,0)), Tile("F", (1,1))])
            self.assertFalse(self.board.is_valid_play(word))

    unittest.main()
