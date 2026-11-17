package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import connect4.Ai;
import connect4.Board;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class Phase3Test {
    /** A position as a 1-based move string, and the 0-based columns that win in the stated plies. */
    record Puzzle(String moves, int plies, List<Integer> answers) {}

    // Puzzles as 1-based move strings. Answers are 0-based columns: every column
    // that wins in the stated number of plies, checked offline by exhaustive search.
    static final List<Puzzle> WIN_IN_7 = List.of(
            new Puzzle("164773774571", 7, List.of(3, 4, 5)),
            new Puzzle("6361444236654215", 7, List.of(3, 4)));
    static final String SLOW_WINS_FIRST = "2575261113446722"; // columns 4 and 5 win in 7; only column 1 wins in 5
    static final String WIN_IN_9 = "6161344754142623353";
    static final String DEFENDER = "1647737745714"; // Yellow to move after Red's winning first move

    // Today's batch from the puzzle generator, easiest first.
    static final List<Puzzle> BATCH = List.of(
            new Puzzle("657657347227", 9, List.of(3)),
            new Puzzle("7145742714611", 11, List.of(4)),
            new Puzzle("45321456414517", 11, List.of(2)),
            new Puzzle("7677526775225755", 11, List.of(5)));
    static final double BATCH_BUDGET_MS = 120;

    @Test
    void winInSevenReportsTheExactDistance() {
        for (Puzzle puzzle : WIN_IN_7) {
            Board board = Board.fromMoves(puzzle.moves());
            Optional<Ai.ForcedWin> result = Ai.solve(board, 7);
            assertTrue(result.isPresent(), puzzle.moves() + ": expected a win in 7");
            Ai.ForcedWin win = result.get();
            assertEquals(7, win.plies(), puzzle.moves() + ": wrong distance");
            assertTrue(puzzle.answers().contains(win.move()), puzzle.moves() + ": column " + (win.move() + 1) + " does not win in 7");
            assertTrue(BruteForce.moveForcesWin(board.copy(), win.move(), 7));
            assertFalse(BruteForce.canForceWin(board.copy(), 5), "fixture check: no faster win exists");
        }
    }

    @Test
    void longerHorizonStillFindsTheFastestWin() {
        Optional<Ai.ForcedWin> result = Ai.solve(Board.fromMoves(SLOW_WINS_FIRST), 9);
        assertTrue(result.isPresent());
        assertEquals(List.of(0, 5), List.of(result.get().move(), result.get().plies()));
    }

    @Test
    void deeperWinIsNotReportedInsideAShorterHorizon() {
        assertTrue(Ai.solve(Board.fromMoves(WIN_IN_9), 7).isEmpty());
    }

    @Test
    void defenderHasNoForcedWin() {
        assertTrue(Ai.solve(Board.fromMoves(DEFENDER), 8).isEmpty());
    }

    @Test
    void puzzleBatchIsCheckedWithinBudget() {
        // Warm up on shallower puzzles first, so the timed batch below measures the
        // algorithm rather than the JIT compiler.
        for (int i = 0; i < 12; i++) {
            for (Puzzle puzzle : WIN_IN_7) Ai.solve(Board.fromMoves(puzzle.moves()), 7);
        }
        double elapsed = 0;
        for (int index = 0; index < BATCH.size(); index++) {
            Puzzle puzzle = BATCH.get(index);
            Board board = Board.fromMoves(puzzle.moves());
            long start = System.nanoTime();
            Optional<Ai.ForcedWin> result = Ai.solve(board, puzzle.plies());
            elapsed += (System.nanoTime() - start) / 1e6;
            // Checked after every puzzle, so a slow solution fails quickly instead of
            // grinding through the deepest ones.
            double total = elapsed;
            int done = index + 1;
            assertTrue(total < BATCH_BUDGET_MS, () -> String.format(Locale.ROOT,
                    "%.0fms after %d of %d puzzles; the batch must be checked in under %.0fms",
                    total, done, BATCH.size(), BATCH_BUDGET_MS));
            assertTrue(result.isPresent(), puzzle.moves() + ": expected a win in " + puzzle.plies());
            Ai.ForcedWin win = result.get();
            assertEquals(puzzle.plies(), win.plies(), puzzle.moves() + ": wrong distance");
            assertTrue(puzzle.answers().contains(win.move()), puzzle.moves() + ": column " + (win.move() + 1) + " does not win in " + puzzle.plies());
            assertEquals(puzzle.moves(), board.toMoves(), "solve must not change the board");
        }
    }
}
