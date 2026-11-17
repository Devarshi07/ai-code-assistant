package tests;

import connect4.Board;
import java.util.ArrayList;
import java.util.List;

/**
 * Independent brute-force checker for forced wins, used by the phase 2 and 3 tests.
 *
 * <p>It plays every line out on the Board with its own four-in-a-row test, so it
 * does not rely on Rules or Ai.
 */
final class BruteForce {
    private BruteForce() {}

    private static final int[][] DIRECTIONS = {{1, 0}, {0, 1}, {1, 1}, {1, -1}};

    static boolean completesFour(Board board, int col, char player) {
        int row = board.height(col);
        for (int[] direction : DIRECTIONS) {
            int count = 1;
            for (int sign : new int[] {1, -1}) {
                int c = col + sign * direction[0];
                int r = row + sign * direction[1];
                while (c >= 0 && c < board.columns() && r >= 0 && r < board.rows() && board.cell(c, r) == player) {
                    count += 1;
                    c += sign * direction[0];
                    r += sign * direction[1];
                }
            }
            if (count >= 4) return true;
        }
        return false;
    }

    static List<Integer> openColumns(Board board) {
        List<Integer> columns = new ArrayList<>();
        for (int c = 0; c < board.columns(); c++) if (board.height(c) < board.rows()) columns.add(c);
        return columns;
    }

    /** Does playing col force a four within plies plies, whatever the reply? */
    static boolean moveForcesWin(Board board, int col, int plies) {
        if (completesFour(board, col, board.toMove())) return true;
        if (plies < 3) return false;
        board.drop(col);
        try {
            List<Integer> replies = openColumns(board);
            if (replies.isEmpty()) return false;
            for (int reply : replies) if (completesFour(board, reply, board.toMove())) return false;
            for (int reply : replies) {
                board.drop(reply);
                boolean ok = canForceWin(board, plies - 2);
                board.undo();
                if (!ok) return false;
            }
            return true;
        } finally {
            board.undo();
        }
    }

    static boolean canForceWin(Board board, int plies) {
        for (int col : openColumns(board)) if (moveForcesWin(board, col, plies)) return true;
        return false;
    }
}
