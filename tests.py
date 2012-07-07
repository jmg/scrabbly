import unittest

from game import Board, Word, Tile, Player


class RulesTests(unittest.TestCase):

    def setUp(self):

        self.player1 = Player("jmbot")
        self.board = Board((10,10), [self.player1])

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
        word_2 = Word([Tile("O", (0,1)), Tile("F", (0,2))])
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

    def test_word_is_not_bordering(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)
        word_2 = Word([Tile("O", (2,1)), Tile("F", (2,2))])
        self.assertFalse(self.board.is_valid_play(word_2))

    def test_word_is_bordering(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)
        word_2 = Word([Tile("O", (2,0)), Tile("F", (2,1))])
        self.assertTrue(self.board.is_valid_play(word_2))


class PlayerTests(unittest.TestCase):

    def setUp(self):

        self.player1 = Player("jmbot")
        self.player2 = Player("ro")
        self.board = Board((15,15), [self.player1, self.player2])

    def test_sum_points(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)

        word = Word([Tile("O", (2,0)), Tile("F", (2,1))])
        self.board.play(word)

        self.assertEquals(self.player1.points, 5)
        self.assertEquals(self.player2.points, 5)


unittest.main()
