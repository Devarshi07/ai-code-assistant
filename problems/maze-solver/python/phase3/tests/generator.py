"""Deterministic level generator for large test levels."""
import random


def generate(seed, size, gems, loops=0.08):
    """Carve a maze of size x size tiles, open extra loops, scatter gems."""
    rng = random.Random(seed)
    grid = [["#"] * size for _ in range(size)]
    grid[1][1] = "."
    stack = [(1, 1)]
    while stack:
        r, c = stack[-1]
        options = [(r + dr, c + dc) for dr, dc in ((-2, 0), (2, 0), (0, -2), (0, 2))
                   if 0 < r + dr < size - 1 and 0 < c + dc < size - 1 and grid[r + dr][c + dc] == "#"]
        if not options:
            stack.pop()
            continue
        nr, nc = rng.choice(options)
        grid[(r + nr) // 2][(c + nc) // 2] = "."
        grid[nr][nc] = "."
        stack.append((nr, nc))
    for _ in range(int(size * size * loops)):
        r, c = rng.randrange(1, size - 1), rng.randrange(1, size - 1)
        if grid[r][c] == "#" and ((grid[r - 1][c] == "." == grid[r + 1][c]) or (grid[r][c - 1] == "." == grid[r][c + 1])):
            grid[r][c] = "."
    cells = [(r, c) for r in range(size) for c in range(size) if grid[r][c] == "."]
    chosen = rng.sample(cells, gems + 2)
    (sr, sc), (er, ec) = chosen[0], chosen[1]
    grid[sr][sc], grid[er][ec] = "S", "E"
    for r, c in chosen[2:]:
        grid[r][c] = "$"
    return "\n".join("".join(row) for row in grid)
