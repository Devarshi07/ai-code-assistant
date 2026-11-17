package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import connect4.Board;
import connect4.BoardException;
import connect4.Cell;
import connect4.Game;
import connect4.GameException;
import connect4.Rules;
import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase1Test {
    static final char RED = Board.RED;
    static final char YELLOW = Board.YELLOW;

    // Move logs (1-based columns, Red first). Each one ends on the winning disc.
    static final String HORIZONTAL = "1122334";
    static final String VERTICAL = "1212121";
    static final String RISING = "12234334744"; // Red: columns 1-4, climbing to the right
    static final String FALLING = "76654554144"; // Red: column 4 row 4 down to column 7 row 1
    static final String FALLING_MIDDLE = "76654414455"; // same line, but the last disc lands in the middle of it
    static final String REPORTED = "453421332272"; // support ticket: Yellow, column 2 down to column 5

    // A saved position from the tournament archive (Red to move by disc count).
    static final String SAVED = String.join("\n",
            ".......",
            ".......",
            ".Y.....",
            ".YY....",
            ".RRY...",
            "YRRRY.R");

    // A complete game that fills the board without anyone connecting four.
    static final String DRAWN = "444777176463166564635121577135541253322232";

    static List<Cell> sorted(List<Cell> cells) {
        return cells.stream().sorted(Comparator.comparingInt(Cell::col).thenComparingInt(Cell::row)).toList();
    }

    static List<Cell> cells(int... colsAndRows) {
        java.util.ArrayList<Cell> list = new java.util.ArrayList<>();
        for (int i = 0; i < colsAndRows.length; i += 2) list.add(new Cell(colsAndRows[i], colsAndRows[i + 1]));
        return list;
    }

    static void assertWon(Game game, char winner, List<Cell> cells) {
        assertEquals(Character.valueOf(winner), game.winner(), game.status() + ": expected " + winner + " to have won");
        assertTrue(game.isOver());
        assertEquals(sorted(cells), sorted(game.winningCells()));
    }

    @Nested
    class BoardTests {
        @Test
        void discsStackFromTheBottom() {
            Board board = Board.fromMoves("4453");
            assertEquals(RED, board.cell(3, 0));
            assertEquals(YELLOW, board.cell(3, 1));
            assertEquals(RED, board.cell(4, 0));
            assertEquals(YELLOW, board.cell(2, 0));
            assertEquals(2, board.height(3));
            assertEquals(RED, board.toMove());
        }

        @Test
        void fullColumnRejectsASeventhDisc() {
            Board board = Board.fromMoves("444444");
            assertFalse(board.canPlay(3));
            assertFalse(board.legalMoves().contains(3));
            assertThrows(BoardException.class, () -> board.drop(3));
        }

        @Test
        void undoRestoresThePositionAndTheTurn() {
            Board board = Board.fromMoves("4453");
            String before = board.toGrid();
            board.drop(0);
            assertEquals(YELLOW, board.toMove());
            assertEquals(0, board.undo());
            assertEquals(before, board.toGrid());
            assertEquals(RED, board.toMove());
            assertEquals("4453", board.toMoves());
        }

        @Test
        void gridRoundTripKeepsTheSideToMove() {
            Board board = Board.fromMoves("44536");
            Board loaded = Board.fromGrid(board.toGrid());
            assertEquals(board.toGrid(), loaded.toGrid());
            assertEquals(YELLOW, loaded.toMove());
            assertEquals(List.of(0, 1, 2, 3, 4, 5, 6), loaded.legalMoves());
        }

        @Test
        void gridWithAFloatingDiscIsRejected() {
            assertThrows(BoardException.class, () -> Board.fromGrid("....\n....\n.R..\n.Y..\n....\n...."));
        }
    }

    @Nested
    class GameTests {
        @Test
        void horizontalFourWins() {
            assertWon(Game.fromMoves(HORIZONTAL), RED, cells(0, 0, 1, 0, 2, 0, 3, 0));
        }

        @Test
        void verticalFourWins() {
            assertWon(Game.fromMoves(VERTICAL), RED, cells(0, 0, 0, 1, 0, 2, 0, 3));
        }

        @Test
        void risingDiagonalWins() {
            assertWon(Game.fromMoves(RISING), RED, cells(0, 0, 1, 1, 2, 2, 3, 3));
        }

        @Test
        void fallingDiagonalWins() {
            assertWon(Game.fromMoves(FALLING), RED, cells(3, 3, 4, 2, 5, 1, 6, 0));
        }

        @Test
        void fallingDiagonalCompletedInTheMiddle() {
            assertWon(Game.fromMoves(FALLING_MIDDLE), RED, cells(3, 3, 4, 2, 5, 1, 6, 0));
        }

        @Test
        void reportedGameEndsWithYellowsDiagonal() {
            Game game = Game.fromMoves(REPORTED);
            assertWon(game, YELLOW, cells(1, 3, 2, 2, 3, 1, 4, 0));
            assertEquals("Yellow wins", game.status());
        }

        @Test
        void savedPositionShowsTheWinner() {
            Game game = Game.fromGrid(SAVED);
            assertEquals(Character.valueOf(YELLOW), game.winner(), "loaded position says '" + game.status() + "'");
            assertEquals(List.of(), game.legalMoves());
        }

        @Test
        void noMovesAfterTheGameIsWon() {
            Game game = Game.fromMoves(HORIZONTAL);
            assertThrows(GameException.class, () -> game.play(4));
        }

        @Test
        void undoReopensAWonGame() {
            Game game = Game.fromMoves(VERTICAL);
            game.undo();
            assertNull(game.winner());
            assertEquals(Character.valueOf(RED), game.toMove());
        }

        @Test
        void fullBoardWithoutFourIsADraw() {
            Game game = Game.fromMoves(DRAWN);
            assertNull(game.winner());
            assertTrue(game.isOver());
            assertEquals("Draw", game.status());
        }
    }

    @Nested
    class ThreatTests {
        @Test
        void hintSpotsADiagonalThreat() {
            // Yellow needs column 2 to finish the diagonal from the ticket.
            Board board = Board.fromMoves(REPORTED.substring(0, REPORTED.length() - 2));
            assertEquals(RED, board.toMove());
            assertEquals(List.of(1), Rules.winningColumns(board, YELLOW));
            assertEquals(List.of(), Rules.winningColumns(board, RED));
        }
    }
}
