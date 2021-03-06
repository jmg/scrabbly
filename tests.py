import unittest

from scrabbly.engine import Board, Word, Tile, Player, Dictionary, InvalidPlayError


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
        self.assertEquals(word.get_points(self.board), 5)

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

    def test_word_is_extended_word(self):

        word = Word([Tile("W", (0,0)), Tile("O", (1,0)), Tile("R", (2,0)), Tile("D", (3,0))])
        self.board.play(word)
        word_2 = Word([Tile("S", (4,0))])
        self.board.play(word_2)

    def test_word_is_crossed_word(self):

        word = Word([Tile("W", (0,0)), Tile("O", (1,0)), Tile("R", (2,0)), Tile("D", (3,0))])
        self.board.play(word)
        word_2 = Word([Tile("F", (1,1))])
        self.board.play(word_2)

    def test_has_no_free_space_word(self):

        word = Word([Tile("F", (1,0)), Tile("O", (0,0))])
        self.board.play(word)
        self.assertRaises(InvalidPlayError, self.board.play, word)

    def test_no_words_formed(self):

        word = Word([Tile("F", (1,0)), Tile("O", (0,0))])
        self.board.play(word)
        word_2 = Word([Tile("J", (9,9))])
        self.assertRaises(InvalidPlayError, self.board.play, word_2)

    def test_valid_3_words(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)

        word_2 = Word([Tile("D", (0,-1))])
        self.board.play(word_2)

        word_3 = Word([Tile("O", (1,-1))])
        self.board.play(word_3)


class WordTests(unittest.TestCase):

    def test_get_word_borders(self):

        o = Tile("O", (1,0))
        f = Tile("F", (2,0))
        word = Word([o,f])
        borders = sorted([(o,(0,0)), (f,(3,0)), (o,(1,-1)), (o,(1,1)), (f,(2,-1)), (f,(2,1))])
        self.assertEquals(word.get_borders(), borders)

    def test_get_word_borders_2(self):

        o = Tile("O", (1,0))
        word = Word([o])
        borders = sorted([(o,(0,0)), (o,(2,0)), (o,(1,-1)), (o,(1,1))])
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

        self.assertEquals(self.player1.points, Dictionary(self.board.language).letters["O"] + Dictionary(self.board.language).letters["F"])
        self.assertEquals(self.player2.points, Dictionary(self.board.language).letters["O"] + Dictionary(self.board.language).letters["F"])

    def test_extend_vertical_word_points(self):

        word = Word([Tile("W", (1,1)), Tile("O", (1,2)), Tile("R", (1,3)), Tile("D", (1,4))])
        self.board.play(word)

        word_2 = Word([Tile("S", (1,5))])
        self.board.play(word_2)

        self.assertEquals(self.player1.points, word.get_points(self.board))
        self.assertEquals(self.player2.points, word.get_points(self.board) + Dictionary(self.board.language).letters["S"])

    def test_extend_horizontal_word_points(self):

        word = Word([Tile("W", (1,-1)), Tile("O", (2,-1)), Tile("R", (3,-1)), Tile("D", (4,-1))])
        self.board.play(word)

        word_2 = Word([Tile("S", (5,-1))])
        self.board.play(word_2)

        self.assertEquals(self.player1.points, word.get_points(self.board))
        self.assertEquals(self.player2.points, word.get_points(self.board) + Dictionary(self.board.language).letters["S"])

    def test_two_words_points(self):

        word = Word([Tile("O", (0,0)), Tile("F", (1,0))])
        self.board.play(word)

        word_2 = Word([Tile("D", (0,-1)), Tile("O", (1,-1))])
        self.board.play(word_2)

        self.assertEquals(self.player1.points, word.get_points(self.board))
        self.assertEquals(self.player2.points, word_2.get_points(self.board) * 2 + word.get_points(self.board))

    def test_double_extend_word_points(self):

        word = Word([Tile("W", (0,0)), Tile("A", (1,0)), Tile("R", (2,0))])
        self.board.play(word)

        word_2 = Word([Tile("A", (-1,0)), Tile("D", (3,0))])
        self.board.play(word_2)

        self.assertEquals(self.player1.points, word.get_points(self.board))
        self.assertEquals(self.player2.points, word_2.get_points(self.board))


class DictTests(unittest.TestCase):

    def test_word_in_dict(self):

        self.assertTrue("duck" in Dictionary())

    def test_word_not_in_dict(self):

        self.assertFalse("pato" in Dictionary())

    def test_word_in_dict_spanish(self):

        self.assertTrue("pato" in Dictionary("spanish"))

    def test_word_not_in_dict_spanish(self):

        self.assertFalse("duck" in Dictionary("spanish"))


class RandomTilesTests(unittest.TestCase):

    def setUp(self):

        self.player1 = Player("jmbot")
        self.player2 = Player("ro")
        self.board = Board((15,15), [self.player1, self.player2])

    def test_random_tiles(self):

        self.assertEquals(7, len(self.board.get_random_tiles()))
        self.assertEquals(1, len(self.board.get_random_tiles(1)))

    def test_no_more_tiles_left(self):

        for i in range(13):
            self.board.get_random_tiles()

        self.assertRaises(InvalidPlayError, self.board.get_random_tiles, 7)

    def test_all_tiles(self):

        letters = self.board._get_all_letters()
        for letter, quantity in self.board.tiles_quantity.iteritems():
            self.assertEquals(letters.count(letter), quantity)


unittest.main()
