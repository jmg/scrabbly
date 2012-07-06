class Board(object):

    def __init__(self, size):

        self.height, self.width = size
        self.dictionary = Dictionary()

    def is_valid_play(self, word):

        return self.dictionary.is_valid_word(word) and self.is_valid_position(word)

    def is_valid_position(self, word):

        return True


class Dictionary(object):

    _valid_words = ["MAKE", "A", "LIST", "OF", "WORDS"]

    def is_valid_word(self, word):

        return self._list_to_string(word) in self._valid_words

    def _list_to_string(self, word):

        return "".join([unicode(char) for char in word])


class Tile(object):

    def __init__(self, char, position):

        self.char = char
        self.x, self.y = position

    def __unicode__(self):

        return self.char


if '__main__' == __name__:

    import unittest

    class WordsTest(unittest.TestCase):

        def setUp(self):

            self.board = Board((10,10))

        def test_first_word(self):

            word = [Tile("O", (0,0)), Tile("F", (1,0))]
            self.assertTrue(self.board.is_valid_play(word))

    unittest.main()
