package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import connect4.Ai;
import connect4.Board;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase2Test {
    // Positions as 1-based move strings (Red first). Columns in assertions are 0-based.
    static final String WIN_OR_BLOCK = "171717"; // Red wins in column 1 (index 0); Yellow threatens column 7
    static final String DIAGONAL_THREAT = "4534213322"; // Yellow threatens column 2 (index 1) along a falling diagonal
    static final String POISONED_CENTRE = "6613572513"; // a disc in the centre lets Yellow win on top of it
    static final String FORK = "216646"; // Red forks with column 5 (index 4): win in 3
    static final String WIN_IN_3 = "3211275371645"; // Yellow wins in 3, only with column 1 (index 0)
    static final String WIN_IN_5 = "36566312253"; // Red wins in 5 with column 3 (index 2); column 5 only wins in 7
    static final String WIN_IN_5_TWO_WAYS = "4711574655"; // Red wins in 5 with either column 2 or 3 (index 1 or 2)
    static final String CENTRE_IS_SLOWER = "431654242273522"; // the centre wins in 5, column 3 (index 2) wins in 3
    static final String DOUBLE_THREAT = "131475"; // Yellow threatens columns 2 and 6; Red cannot stop both
    static final String DRAWN = "444777176463166564635121577135541253322232";

    static void assertForcedWin(String moves, int maxPlies, int plies, List<Integer> answers) {
        Board board = Board.fromMoves(moves);
        Optional<Ai.ForcedWin> result = Ai.solve(board, maxPlies);
        assertTrue(result.isPresent(), moves + ": expected a win in " + plies);
        Ai.ForcedWin win = result.get();
        assertEquals(plies, win.plies(), moves + ": wrong distance");
        assertTrue(answers.contains(win.move()), moves + ": column " + (win.move() + 1) + " does not win in " + plies);
        assertTrue(BruteForce.moveForcesWin(board.copy(), win.move(), plies), "the reported move does not force a win");
        assertEquals(moves, board.toMoves(), "solve must not change the board");
    }

    @Nested
    class ChooseMoveTests {
        @Test
        void takesAWinBeforeBlocking() {
            assertEquals(0, Ai.chooseMove(Board.fromMoves(WIN_OR_BLOCK)));
        }

        @Test
        void blocksTheOnlyThreat() {
            assertEquals(1, Ai.chooseMove(Board.fromMoves(DIAGONAL_THREAT)));
        }

        @Test
        void doesNotDropUnderAnOpponentThreat() {
            Board board = Board.fromMoves(POISONED_CENTRE);
            int move = Ai.chooseMove(board);
            assertTrue(board.legalMoves().contains(move));
            assertNotEquals(3, move, "column 4 lets Yellow complete four on top of it");
        }

        @Test
        void depthTwoAlreadySeesTheReply() {
            assertNotEquals(3, Ai.chooseMove(Board.fromMoves(POISONED_CENTRE), 2));
        }

        @Test
        void findsTheFork() {
            assertEquals(4, Ai.chooseMove(Board.fromMoves(FORK)), "column 5 makes two threats at once");
        }

        @Test
        void opensInTheCentre() {
            assertEquals(3, Ai.chooseMove(new Board()));
        }

        @Test
        void leavesTheBoardUnchanged() {
            Board board = Board.fromMoves(FORK);
            String grid = board.toGrid();
            Ai.chooseMove(board);
            assertEquals(grid, board.toGrid());
            assertEquals(FORK, board.toMoves());
        }

        @Test
        void fullBoardThrows() {
            assertThrows(RuntimeException.class, () -> Ai.chooseMove(Board.fromMoves(DRAWN)));
        }
    }

    @Nested
    class SolveTests {
        @Test
        void immediateWinIsOnePly() {
            assertForcedWin(WIN_OR_BLOCK, 5, 1, List.of(0));
        }

        @Test
        void winInThree() {
            assertForcedWin(WIN_IN_3, 3, 3, List.of(0));
        }

        @Test
        void forkIsAWinInThree() {
            assertForcedWin(FORK, 5, 3, List.of(4));
        }

        @Test
        void prefersTheFastestWin() {
            assertForcedWin(CENTRE_IS_SLOWER, 5, 3, List.of(2));
        }

        @Test
        void winInFive() {
            assertForcedWin(WIN_IN_5, 5, 5, List.of(2));
        }

        @Test
        void winInFiveWithTwoAnswers() {
            assertForcedWin(WIN_IN_5_TWO_WAYS, 5, 5, List.of(1, 2));
        }

        @Test
        void horizonTooShortMeansNoWin() {
            assertTrue(Ai.solve(Board.fromMoves(WIN_IN_5), 3).isEmpty());
            assertTrue(Ai.solve(Board.fromMoves(WIN_IN_3), 1).isEmpty());
        }

        @Test
        void losingSideHasNoForcedWin() {
            Board board = Board.fromMoves(DOUBLE_THREAT);
            assertFalse(BruteForce.canForceWin(board, 5));
            assertTrue(Ai.solve(board, 5).isEmpty());
        }

        @Test
        void quietOpeningHasNoForcedWin() {
            assertTrue(Ai.solve(new Board(), 5).isEmpty());
        }

        @Test
        void fullBoardHasNoForcedWin() {
            assertTrue(Ai.solve(Board.fromMoves(DRAWN), 5).isEmpty());
        }
    }
}
