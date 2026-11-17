package connect4;

import java.util.List;
import java.util.Optional;

/** One game of Connect Four: a board plus the result so far, and the replay of stored move logs. */
public class Game {
    public static final String DRAW = "Draw";

    private final Board board;
    private Character winner;
    private List<Cell> winningCells;

    public Game() {
        this(new Board());
    }

    public Game(Board board) {
        this.board = board;
        Optional<Rules.Winner> found = Rules.findWinner(board);
        this.winner = found.map(Rules.Winner::player).orElse(null);
        this.winningCells = found.map(Rules.Winner::cells).orElse(null);
    }

    /** Replay a stored move log, e.g. "4453". Fails if a move is illegal. */
    public static Game fromMoves(String moves) {
        return fromMoves(moves, 7, 6);
    }

    public static Game fromMoves(String moves, int columns, int rows) {
        Game game = new Game(new Board(columns, rows));
        String text = moves.replace(" ", "");
        for (int index = 0; index < text.length(); index++) {
            char symbol = text.charAt(index);
            if (symbol < '0' || symbol > '9') {
                throw new GameException("move " + (index + 1) + ": '" + symbol + "' is not a column number");
            }
            try {
                game.play(symbol - '0' - 1);
            } catch (BoardException | GameException error) {
                throw new GameException("move " + (index + 1) + " (column " + symbol + "): " + error.getMessage());
            }
        }
        return game;
    }

    /** Load a saved position, e.g. from a puzzle file or a bug report. */
    public static Game fromGrid(String text) {
        return new Game(Board.fromGrid(text));
    }

    public Board board() {
        return board;
    }

    /** The winner, or null while nobody has connected four. */
    public Character winner() {
        return winner;
    }

    /** The cells of the winning line, or null while nobody has won. */
    public List<Cell> winningCells() {
        return winningCells;
    }

    public boolean isOver() {
        return winner != null || board.isFull();
    }

    /** The player to move, or null once the game is over. */
    public Character toMove() {
        return isOver() ? null : board.toMove();
    }

    public String status() {
        if (winner != null) return Board.name(winner) + " wins";
        if (board.isFull()) return DRAW;
        return Board.name(board.toMove()) + " to move";
    }

    public List<Integer> legalMoves() {
        return isOver() ? List.of() : board.legalMoves();
    }

    /** Drop the current player's disc into col (0-based). Returns the row. */
    public int play(int col) {
        if (isOver()) throw new GameException("the game is over: " + status());
        char player = board.toMove();
        int row = board.drop(col);
        Optional<List<Cell>> cells = Rules.winningLine(board, col, row);
        if (cells.isPresent()) {
            winner = player;
            winningCells = cells.get();
        }
        return row;
    }

    /** Take back the last move, reopening the game if it had just been won. */
    public int undo() {
        int col = board.undo();
        winner = null;
        winningCells = null;
        return col;
    }

    @Override
    public String toString() {
        return "Game('" + board.toMoves() + "', " + status() + ")";
    }
}
