// Text rendering used by the level editor preview and the CLI.
const { directionBetween } = require('./geometry');
const { FLOOR } = require('./level');

const PATH_MARK = 'o';

/** The level as text with floor tiles on path marked. */
function render(level, path = []) {
  const grid = level.rows.map(row => row.split(''));
  for (const pos of path || []) {
    if (grid[pos.row][pos.col] === FLOOR) grid[pos.row][pos.col] = PATH_MARK;
  }
  return grid.map(row => row.join('')).join('\n');
}

/** Describe a path as compass letters, e.g. 'EESSW'. */
function toMoves(path) {
  let moves = '';
  for (let i = 1; i < path.length; i++) moves += directionBetween(path[i - 1], path[i]);
  return moves;
}

function summary(level, run) {
  if (!run) return `${level.name}: no route`;
  return `${level.name}: ${run.moves} moves  ${toMoves(run.path)}`;
}

module.exports = { render, toMoves, summary, PATH_MARK };
