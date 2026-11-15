// Deterministic level generator for large test levels (mulberry32 PRNG).
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function generate(seed, size, gems, loops = 0.08) {
  const random = mulberry32(seed);
  const pick = n => Math.floor(random() * n);
  const grid = Array.from({ length: size }, () => new Array(size).fill('#'));
  grid[1][1] = '.';
  const stack = [[1, 1]];
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const options = [[-2, 0], [2, 0], [0, -2], [0, 2]]
      .map(([dr, dc]) => [r + dr, c + dc])
      .filter(([nr, nc]) => nr > 0 && nr < size - 1 && nc > 0 && nc < size - 1 && grid[nr][nc] === '#');
    if (!options.length) { stack.pop(); continue; }
    const [nr, nc] = options[pick(options.length)];
    grid[(r + nr) / 2][(c + nc) / 2] = '.';
    grid[nr][nc] = '.';
    stack.push([nr, nc]);
  }
  for (let i = 0; i < Math.floor(size * size * loops); i++) {
    const r = 1 + pick(size - 2), c = 1 + pick(size - 2);
    if (grid[r][c] === '#' && ((grid[r - 1][c] === '.' && grid[r + 1][c] === '.') || (grid[r][c - 1] === '.' && grid[r][c + 1] === '.'))) grid[r][c] = '.';
  }
  const cells = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (grid[r][c] === '.') cells.push([r, c]);
  for (let i = 0; i < gems + 2; i++) {
    const j = i + pick(cells.length - i);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const [[sr, sc], [er, ec]] = cells;
  grid[sr][sc] = 'S';
  grid[er][ec] = 'E';
  for (const [r, c] of cells.slice(2, gems + 2)) grid[r][c] = '$';
  return grid.map(row => row.join('')).join('\n');
}
module.exports = { generate, mulberry32 };
