import unittest

from game import Board, Word, Tile


class ValidPlayTest(unittest.TestCase):

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

    def test_invalid_word_position(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,1))])
        self.assertFalse(self.board.is_valid_play(word))

    def test_word_has_no_free_space(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)
        self.assertFalse(self.board.is_valid_play(word))

    def test_word_has_free_space(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)
        word_2 = Word([Tile("O", (2,0)), Tile("F", (3,0))])
        self.assertTrue(self.board.is_valid_play(word_2))

    def test_is_not_continous_word(self):

        word = Word([Tile("O", (0,0)), Tile("F", (3,0))])
        self.assertFalse(self.board.is_valid_play(word))

    def test_is_continous_word(self):

        word = Word([Tile("O", (1,0)), Tile("F", (2,0))])
        self.assertTrue(self.board.is_valid_play(word))

    def test_get_word_points(self):

        word = Word([Tile("O", (1,0)), Tile("F", (2,0))])
        self.assertEquals(word.get_points(), 5)


unittest.main()
