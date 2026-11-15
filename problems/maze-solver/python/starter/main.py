"""Prints the solver's routes for the sample levels."""
from maze import collect_all_gems, solve
from maze.levels import load_samples
from maze.render import render, summary


def main():
    for level in load_samples():
        run = solve(level)
        print(summary(level, run))
        print(render(level, run.path if run else None))
        if level.gems:
            try:
                gem_run = collect_all_gems(level)
            except NotImplementedError as exc:
                print(f"  gem run: {exc}")
            else:
                print(f"  gem run: {gem_run.moves if gem_run else 'impossible'} moves")
        print()


if __name__ == "__main__":
    main()
