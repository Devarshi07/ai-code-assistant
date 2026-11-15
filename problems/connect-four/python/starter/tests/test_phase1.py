import unittest

from connect4 import RED, YELLOW, Board, BoardError, Game, GameError, winning_columns

# Move logs (1-based columns, Red first). Each one ends on the winning disc.
HORIZONTAL = "1122334"
VERTICAL = "1212121"
RISING = "12234334744"          # Red: columns 1-4, climbing to the right
FALLING = "76654554144"         # Red: column 4 row 4 down to column 7 row 1
FALLING_MIDDLE = "76654414455"  # same line, but the last disc lands in the middle of it
REPORTED = "453421332272"       # support ticket: Yellow, column 2 down to column 5

# A saved position from the tournament archive (Red to move by disc count).
SAVED = """
.......
.......
.Y.....
.YY....
.RRY...
YRRRY.R
"""

# A complete game that fills the board without anyone connecting four.
DRAWN = "444777176463166564635121577135541253322232"


class BoardTests(unittest.TestCase):
    def test_discs_stack_from_the_bottom(self):
        board = Board.from_moves("4453")
        self.assertEqual(board.cell(3, 0), RED)
        self.assertEqual(board.cell(3, 1), YELLOW)
        self.assertEqual(board.cell(4, 0), RED)
        self.assertEqual(board.cell(2, 0), YELLOW)
        self.assertEqual(board.height(3), 2)
        self.assertEqual(board.to_move, RED)

    def test_full_column_rejects_a_seventh_disc(self):
        board = Board.from_moves("444444")
        self.assertFalse(board.can_play(3))
        self.assertNotIn(3, board.legal_moves())
        with self.assertRaises(BoardError):
            board.drop(3)

    def test_undo_restores_the_position_and_the_turn(self):
        board = Board.from_moves("4453")
        before = board.to_grid()
        board.drop(0)
        self.assertEqual(board.to_move, YELLOW)
        self.assertEqual(board.undo(), 0)
        self.assertEqual(board.to_grid(), before)
        self.assertEqual(board.to_move, RED)
        self.assertEqual(board.to_moves(), "4453")

    def test_grid_round_trip_keeps_the_side_to_move(self):
        board = Board.from_moves("44536")
        loaded = Board.from_grid(board.to_grid())
        self.assertEqual(loaded.to_grid(), board.to_grid())
        self.assertEqual(loaded.to_move, YELLOW)
        self.assertEqual(loaded.legal_moves(), list(range(7)))

    def test_grid_with_a_floating_disc_is_rejected(self):
        with self.assertRaises(BoardError):
            Board.from_grid("....\n....\n.R..\n.Y..\n....\n....")


class GameTests(unittest.TestCase):
    def assert_won(self, game, winner, cells):
        self.assertEqual(game.winner, winner, f"{game.status}: expected {winner} to have won")
        self.assertTrue(game.is_over)
        self.assertEqual(sorted(game.winning_cells), sorted(cells))

    def test_horizontal_four_wins(self):
        self.assert_won(Game.from_moves(HORIZONTAL), RED, [(0, 0), (1, 0), (2, 0), (3, 0)])

    def test_vertical_four_wins(self):
        self.assert_won(Game.from_moves(VERTICAL), RED, [(0, 0), (0, 1), (0, 2), (0, 3)])

    def test_rising_diagonal_wins(self):
        self.assert_won(Game.from_moves(RISING), RED, [(0, 0), (1, 1), (2, 2), (3, 3)])

    def test_falling_diagonal_wins(self):
        self.assert_won(Game.from_moves(FALLING), RED, [(3, 3), (4, 2), (5, 1), (6, 0)])

    def test_falling_diagonal_completed_in_the_middle(self):
        self.assert_won(Game.from_moves(FALLING_MIDDLE), RED, [(3, 3), (4, 2), (5, 1), (6, 0)])

    def test_reported_game_ends_with_yellows_diagonal(self):
        game = Game.from_moves(REPORTED)
        self.assert_won(game, YELLOW, [(1, 3), (2, 2), (3, 1), (4, 0)])
        self.assertEqual(game.status, "Yellow wins")

    def test_saved_position_shows_the_winner(self):
        game = Game.from_grid(SAVED)
        self.assertEqual(game.winner, YELLOW, f"loaded position says {game.status!r}")
        self.assertEqual(game.legal_moves(), [])

    def test_no_moves_after_the_game_is_won(self):
        game = Game.from_moves(HORIZONTAL)
        with self.assertRaises(GameError):
            game.play(4)

    def test_undo_reopens_a_won_game(self):
        game = Game.from_moves(VERTICAL)
        game.undo()
        self.assertIsNone(game.winner)
        self.assertEqual(game.to_move, RED)

    def test_full_board_without_four_is_a_draw(self):
        game = Game.from_moves(DRAWN)
        self.assertIsNone(game.winner)
        self.assertTrue(game.is_over)
        self.assertEqual(game.status, "Draw")


class ThreatTests(unittest.TestCase):
    def test_hint_spots_a_diagonal_threat(self):
        # Yellow needs column 2 to finish the diagonal from the ticket.
        board = Board.from_moves(REPORTED[:-2])
        self.assertEqual(board.to_move, RED)
        self.assertEqual(winning_columns(board, YELLOW), [1])
        self.assertEqual(winning_columns(board, RED), [])


if __name__ == "__main__":
    unittest.main()
