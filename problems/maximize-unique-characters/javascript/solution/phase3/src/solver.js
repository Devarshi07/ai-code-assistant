// Suggests boards: the best set of candidate words for a puzzle.
const { popcount } = require('./letters');
const { asWords } = require('./models');

/**
 * Candidates that could appear on a board at all, one per spelling.
 *
 * Words that repeat a letter are dropped, and so are exact duplicates (the
 * same word often appears in several themes). Order is preserved.
 */
function playableWords(items) {
  const seen = new Set();
  const playable = [];
  for (const word of asWords(items)) {
    if (word.hasRepeats || seen.has(word.text)) continue;
    seen.add(word.text);
    playable.push(word);
  }
  return playable;
}

const byText = (a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0);

/**
 * The board that covers the most letters without repeating any.
 *
 * Returns { words, total }: the chosen words in alphabetical order and the
 * number of letters they cover. Ties go to the alphabetically first word list.
 *
 * 1. Keep one spelling per letter set (anagrams are interchangeable), and keep
 *    the alphabetically first one so the tie-break is unaffected.
 * 2. Branch and bound, longest words first, finds the best total.
 * 3. A second search in alphabetical order stops at the first board that
 *    reaches that total. Alphabetical depth-first order visits boards in
 *    tie-break order, so that board is the answer.
 */
function bestSelection(items) {
  const firstSpelling = new Map();
  for (const word of playableWords(items)) {
    const current = firstSpelling.get(word.mask);
    if (current === undefined || word.text < current.text) firstSpelling.set(word.mask, word);
  }
  const entries = [...firstSpelling.values()];
  const target = bestTotal(entries.slice().sort((a, b) => b.text.length - a.text.length || byText(a, b)));
  const words = firstBoard(entries.slice().sort(byText), target);
  return { words, total: target };
}

/** reach[p] is every letter that candidates[p..] could still add to the board. */
function reachOf(masks, candidates) {
  const reach = new Array(candidates.length + 1).fill(0);
  for (let p = candidates.length - 1; p >= 0; p--) reach[p] = reach[p + 1] | masks[candidates[p]];
  return reach;
}

/** Candidates after position p that share no letter with mask. */
function compatible(masks, candidates, p, mask) {
  const rest = [];
  for (let q = p + 1; q < candidates.length; q++) if ((masks[candidates[q]] & mask) === 0) rest.push(candidates[q]);
  return rest;
}

/** Most letters any board can cover, using entries in the given search order. */
function bestTotal(entries) {
  const masks = entries.map(word => word.mask);
  const sizes = entries.map(word => word.text.length);
  let best = 0;

  // candidates: indexes of words that fit the current board, in search order.
  function grow(candidates, total) {
    if (total > best) best = total;
    const reach = reachOf(masks, candidates);
    for (let p = 0; p < candidates.length; p++) {
      if (total + popcount(reach[p]) <= best) return; // even every remaining letter could not beat the best board
      const i = candidates[p];
      grow(compatible(masks, candidates, p, masks[i]), total + sizes[i]);
    }
  }

  grow(entries.map((_, i) => i), 0);
  return best;
}

/** First board, in alphabetical depth-first order, that covers target letters. */
function firstBoard(entries, target) {
  const masks = entries.map(word => word.mask);
  const chosen = [];

  function extend(candidates, total) {
    if (total === target) return true;
    const reach = reachOf(masks, candidates);
    for (let p = 0; p < candidates.length; p++) {
      if (total + popcount(reach[p]) < target) return false;
      const word = entries[candidates[p]];
      chosen.push(word.text);
      if (extend(compatible(masks, candidates, p, word.mask), total + word.text.length)) return true;
      chosen.pop();
    }
    return false;
  }

  extend(entries.map((_, i) => i), 0);
  return chosen;
}

module.exports = { playableWords, bestSelection };
