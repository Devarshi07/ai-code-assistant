// Independent brute-force checker for forced wins, used by the phase 2 and 3 tests.
//
// It plays every line out on the Board with its own four-in-a-row test, so it
// does not rely on rules.js or ai.js.

function completesFour(board, col, player) {
  const row = board.height(col);
  for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let count = 1;
    for (const sign of [1, -1]) {
      let c = col + sign * dc;
      let r = row + sign * dr;
      while (c >= 0 && c < board.columns && r >= 0 && r < board.rows && board.cell(c, r) === player) {
        count += 1;
        c += sign * dc;
        r += sign * dr;
      }
    }
    if (count >= 4) return true;
  }
  return false;
}

function openColumns(board) {
  const columns = [];
  for (let c = 0; c < board.columns; c++) if (board.height(c) < board.rows) columns.push(c);
  return columns;
}

/** Does playing col force a four within plies plies, whatever the reply? */
function moveForcesWin(board, col, plies) {
  if (completesFour(board, col, board.toMove)) return true;
  if (plies < 3) return false;
  board.drop(col);
  try {
    const replies = openColumns(board);
    if (!replies.length || replies.some(r => completesFour(board, r, board.toMove))) return false;
    for (const reply of replies) {
      board.drop(reply);
      const ok = canForceWin(board, plies - 2);
      board.undo();
      if (!ok) return false;
    }
    return true;
  } finally {
    board.undo();
  }
}

function canForceWin(board, plies) {
  return openColumns(board).some(col => moveForcesWin(board, col, plies));
}

module.exports = { canForceWin, moveForcesWin };
