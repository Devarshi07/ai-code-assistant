"""Demo: replays a reported game, asks the computer for moves, checks the daily puzzles."""
from connect4 import NAMES, Board, Game, choose_move, solve
from connect4.render import describe_move, render, render_game
from connect4.samples import DAILY_PUZZLES, OPENING, REPORTED_GAME


def main():
    print(f"Reported game {REPORTED_GAME}")
    print(render_game(Game.from_moves(REPORTED_GAME)))
    print()

    board = Board.from_moves(OPENING)
    print(f"Opening {OPENING}")
    print(render(board))
    try:
        print(f"computer ({NAMES[board.to_move]}) plays {describe_move(choose_move(board))}")
    except NotImplementedError as exc:
        print(f"computer: {exc}")
    print()

    for puzzle in DAILY_PUZZLES:
        board = puzzle.board()
        print(f"{puzzle.name} puzzle: {NAMES[board.to_move]} to play and win in {puzzle.plies}")
        print(render(board))
        try:
            result = solve(board, puzzle.plies)
        except NotImplementedError as exc:
            print(f"solver: {exc}")
        else:
            found = f"{describe_move(result.move)} wins in {result.plies} plies" if result else "no forced win"
            print(f"solver: {found}")
        print()

    game = Game()
    try:
        while not game.is_over:
            game.play(choose_move(game.board, depth=3))
    except NotImplementedError as exc:
        print(f"computer vs computer: {exc}")
    else:
        print(f"Computer vs computer at depth 3: {game.board.to_moves()}")
        print(render_game(game))


if __name__ == "__main__":
    main()
