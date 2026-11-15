"""Writes the test files for Warehouse Grid Path. Run from this folder: python generator.py"""
import random
from collections import deque
from pathlib import Path


def solve(grid):
    rows, cols = len(grid), len(grid[0])
    flat = "".join(grid)
    start, end = flat.index("S"), flat.index("E")
    dist = [-1] * (rows * cols)
    dist[start] = 0
    queue = deque([start])
    while queue:
        cell = queue.popleft()
        r, c = divmod(cell, cols)
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < rows and 0 <= nc < cols:
                nxt = nr * cols + nc
                if dist[nxt] < 0 and flat[nxt] != "#":
                    dist[nxt] = dist[cell] + 1
                    queue.append(nxt)
    return dist[end]


def write(index, grid):
    grid = ["".join(row) for row in grid]
    rows, cols = len(grid), len(grid[0])
    flat = "".join(grid)
    assert 1 <= rows <= 1000 and 1 <= cols <= 1000 and all(len(row) == cols for row in grid)
    assert flat.count("S") == 1 and flat.count("E") == 1 and set(flat) <= set(".#SE")
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{rows} {cols}\n" + "".join(row + "\n" for row in grid), newline="\n")
    answer = solve(grid)
    (tests / f"output{index:02d}.txt").write_text(f"{answer}\n", newline="\n")
    return answer


rng = random.Random(3070)


def random_grid(rows, cols, shelf_rate, start, end):
    grid = [["#" if rng.random() < shelf_rate else "." for _ in range(cols)] for _ in range(rows)]
    for r in range(max(0, start[0] - 1), min(rows, start[0] + 2)):  # keep the start out of a pocket
        for c in range(max(0, start[1] - 1), min(cols, start[1] + 2)):
            grid[r][c] = "."
    grid[start[0]][start[1]] = "S"
    grid[end[0]][end[1]] = "E"
    return grid


def reachable_grid(rows, cols, shelf_rate, start, end):
    while True:
        grid = random_grid(rows, cols, shelf_rate, start, end)
        if solve(["".join(row) for row in grid]) > 0:
            return grid


def wall_in(grid, r, c):
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr or dc:
                grid[r + dr][c + dc] = "#"


write(0, ["S..#.", ".#...", ".#.#.", "...#E"])
write(1, ["S#.", "##.", "..E"])
write(2, ["SE"])
write(3, ["S..#..E"])
write(4, ["S"] + ["."] * 998 + ["E"])
write(5, ["S" + "." * 49] + ["." * 50] * 48 + ["." * 49 + "E"])
grid = random_grid(30, 40, 0.35, (10, 10), (11, 10))
write(6, grid)  # neighbours
grid = random_grid(100, 100, 0.2, (0, 0), (50, 50))
wall_in(grid, 50, 50)
write(7, grid)  # the dock is boxed in by shelves
write(8, [
    "S.#.......#....",
    ".##.#####.#.##.",
    "....#...#...#..",
    "###.#.#.#####.#",
    "#...#.#.....#..",
    "#.###.#####.##.",
    "#.....#...#..#.",
    "#######.#.##.#.",
    "E.......#....#.",
])
write(9, reachable_grid(200, 200, 0.35, (0, 0), (199, 199)))
write(10, reachable_grid(1000, 1000, 0.36, (0, 0), (999, 999)))
# A serpentine: 350 corridors joined at alternating ends, so the only path is about 245,000 moves long.
grid = []
for r in range(700):
    row = ["." if r % 2 == 0 else "#"] * 700
    if r % 2 == 1 and r < 699:
        row[699 if r % 4 == 1 else 0] = "."
    grid.append(row)
grid[0][0], grid[698][0] = "S", "E"
write(11, grid)
grid = random_grid(700, 700, 0.25, (5, 5), (690, 690))
wall_in(grid, 690, 690)
write(12, grid)  # the robot explores the whole floor before giving up
print("wrote 13 tests")
