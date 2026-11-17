import connect4.Ai;
import connect4.Board;
import connect4.Game;
import connect4.Render;
import connect4.Samples;
import java.util.Optional;
import java.util.function.Supplier;

/** Replays a reported game, asks the computer for moves, checks the daily puzzles. */
public class Main {
    /** Runs fn, printing a note instead when the feature is not written yet. */
    static <T> T attempt(String label, Supplier<T> fn) {
        try {
            return fn.get();
        } catch (UnsupportedOperationException error) {
            System.out.println(label + ": " + error.getMessage());
            return null;
        }
    }

    public static void main(String[] args) {
        System.out.println("Reported game " + Samples.REPORTED_GAME);
        System.out.println(Render.renderGame(Game.fromMoves(Samples.REPORTED_GAME)));
        System.out.println();

        Board board = Board.fromMoves(Samples.OPENING);
        System.out.println("Opening " + Samples.OPENING);
        System.out.println(Render.render(board));
        Integer col = attempt("computer", () -> Ai.chooseMove(board));
        if (col != null) System.out.println("computer (" + Board.name(board.toMove()) + ") plays " + Render.describeMove(col));
        System.out.println();

        for (Samples.Puzzle puzzle : Samples.DAILY_PUZZLES) {
            Board position = puzzle.board();
            System.out.println(puzzle.name() + " puzzle: " + Board.name(position.toMove()) + " to play and win in " + puzzle.plies());
            System.out.println(Render.render(position));
            Optional<Ai.ForcedWin> result = attempt("solver", () -> Ai.solve(position, puzzle.plies()));
            if (result != null) {
                System.out.println("solver: " + result
                        .map(win -> Render.describeMove(win.move()) + " wins in " + win.plies() + " plies")
                        .orElse("no forced win"));
            }
            System.out.println();
        }

        Game game = new Game();
        Boolean finished = attempt("computer vs computer", () -> {
            while (!game.isOver()) game.play(Ai.chooseMove(game.board(), 3));
            return true;
        });
        if (finished != null) {
            System.out.println("Computer vs computer at depth 3: " + game.board().toMoves());
            System.out.println(Render.renderGame(game));
        }
    }
}
