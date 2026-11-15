"""Demo: publish the designers' drawings, then build answer keys for contributor puzzles."""
import os
import time

from nonogram import (PuzzleError, is_solution, load_puzzle, parse_grid,
                      puzzle_from_picture, render, solve)

SAMPLES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples")
DRAWINGS = ["heart.pic", "mug.pic", "lighthouse.pic"]
CONTRIBUTED = ["sailboat.non", "starfield.non"]


def read_sample(name):
    with open(os.path.join(SAMPLES, name), encoding="utf-8") as handle:
        return handle.read()


def publish_drawings():
    print("== Publishing drawings ==")
    for name in DRAWINGS:
        title = name.rsplit(".", 1)[0].title()
        picture = parse_grid(read_sample(name))
        try:
            puzzle = puzzle_from_picture(picture, title=title)
        except PuzzleError as exc:
            print(f"{name}: cannot publish: {exc}\n")
            continue
        status = "ok" if is_solution(puzzle, picture) else "drawing does not match its own clues"
        print(f"{name}: {puzzle.width}x{puzzle.height}, {puzzle.filled_cells} filled cells, self-check {status}")
        print(render(puzzle))
        print()


def build_answer_keys():
    print("== Answer keys for contributed puzzles ==")
    for name in CONTRIBUTED:
        puzzle = load_puzzle(os.path.join(SAMPLES, name))
        started = time.perf_counter()
        try:
            grid = solve(puzzle)
        except NotImplementedError as exc:
            print(f"{puzzle.title}: {exc}\n")
            continue
        elapsed = (time.perf_counter() - started) * 1000
        if grid is None:
            print(f"{puzzle.title}: no grid fits these clues\n")
            continue
        verdict = "verified" if is_solution(puzzle, grid) else "FAILED verification"
        print(f"{puzzle.title} by {puzzle.author}: solved in {elapsed:.1f} ms, {verdict}")
        print(render(puzzle, grid))
        print()


def main():
    publish_drawings()
    build_answer_keys()


if __name__ == "__main__":
    main()
