import unittest

from game import Board, Word, Tile, Player, InvalidPlayError


class RulesTests(unittest.TestCase):

    def setUp(self):

        self.player1 = Player("jmbot")
        self.board = Board((10,10), [self.player1])

    def test_valid_word(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)

    def test_invalid_word(self):

        word = Word([Tile("A", (0,0)), Tile("S", (1,0)), Tile("F", (2,0)), Tile("G", (3,0))])
        self.assertRaises(InvalidPlayError, self.board.play, word)

    def test_invalid_word_position(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,1))])
        self.assertRaises(InvalidPlayError, self.board.play, word)

    def test_invalid_word_position(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,1))])
        self.assertRaises(InvalidPlayError, self.board.play, word)

    def test_is_not_continous_word(self):

        word = Word([Tile("O", (0,0)), Tile("F", (3,0))])
        self.assertRaises(InvalidPlayError, self.board.play, word)

    def test_is_continous_word(self):

        word = Word([Tile("O", (1,0)), Tile("F", (2,0))])
        self.board.play(word)

    def test_get_word_points(self):

        word = Word([Tile("O", (1,0)), Tile("F", (2,0))])
        self.assertEquals(word.get_points(), 5)

    def test_word_is_not_bordering(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)
        word_2 = Word([Tile("O", (2,1)), Tile("F", (2,2))])
        self.assertRaises(InvalidPlayError, self.board.play, word_2)

    def test_word_is_bordering(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)
        word_2 = Word([Tile("W", (0,-1)), Tile("R", (0,1)), Tile("D", (0,2))])
        self.board.play(word_2)

    def test_word_invalid_2nd_word_position(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)
        word_2 = Word([Tile("W", (1,-2)), Tile("R", (0,1)), Tile("D", (0,2))])
        self.assertRaises(InvalidPlayError, self.board.play, word_2)

    def test_word_invalid_2nd_word_incontinuos(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)
        word_2 = Word([Tile("W", (0,-6)), Tile("R", (0,1)), Tile("D", (0,2))])
        self.assertRaises(InvalidPlayError, self.board.play, word_2)

    def test_is_right_horizontal_inverted_word(self):

        word = Word([Tile("F", (1,0)), Tile("O", (0,0))])
        self.board.play(word)

    def test_is_wrong_horizontal_inverted_word(self):

        word = Word([Tile("F", (0,0)), Tile("O", (1,0))])
        self.assertRaises(InvalidPlayError, self.board.play, word)

    def test_is_right_vertical_inverted_word(self):

        word = Word([Tile("M", (1,1)), Tile("E", (1,4)), Tile("K", (1,3)), Tile("A", (1,2))])
        self.board.play(word)

    def test_is_wrong_vertical_inverted_word(self):

        word = Word([Tile("M", (1,-4)), Tile("A", (1,-3)), Tile("K", (1,-1)), Tile("E", (1,-2))])
        self.assertRaises(InvalidPlayError, self.board.play, word)

    def _test_word_is_extended_word(self):

        word = Word([Tile("W", (0,0)), Tile("O", (1,0)), Tile("R", (2,0)), Tile("D", (3,0))])
        self.board.play(word)
        word_2 = Word([Tile("S", (4,0))])
        self.board.play(word_2)

    def test_word_is_crossed_word(self):

        word = Word([Tile("W", (0,0)), Tile("O", (1,0)), Tile("R", (2,0)), Tile("D", (3,0))])
        self.board.play(word)
        word_2 = Word([Tile("F", (1,1))])
        self.board.play(word_2)


class WordTests(unittest.TestCase):

    def test_get_word_borders(self):

        word = Word([Tile("O", (1,0)), Tile("F", (2,0))])
        borders = sorted([(0,0), (3,0), (1,-1), (1,1), (2,-1), (2,1)])
        self.assertEquals(word.get_borders(), borders)

    def test_get_word_borders_2(self):

        word = Word([Tile("O", (1,0))])
        borders = sorted([(0,0), (2,0), (1,-1), (1,1)])
        self.assertEquals(word.get_borders(), borders)


class PlayerTests(unittest.TestCase):

    def setUp(self):

        self.player1 = Player("jmbot")
        self.player2 = Player("ro")
        self.board = Board((15,15), [self.player1, self.player2])

    def test_sum_points(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)

        word_2 = Word([Tile("O", (1,-1))])
        self.board.play(word_2)

        self.assertEquals(self.player1.points, 5)
        self.assertEquals(self.player2.points, 5)


unittest.main()
