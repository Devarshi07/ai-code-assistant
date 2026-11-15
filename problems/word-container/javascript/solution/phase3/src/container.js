// WordContainer: the in-memory word store behind the crossword helper.
//
// Words live in a trie (prefix tree). Each node stands for a prefix, and a node
// is *terminal* when that prefix is itself a stored word. Every node also counts
// the stored words at or below it, so the autocomplete badge ("12 words start
// with 'tra'") costs one walk down the prefix instead of a scan.
//
//   (root) 3            stored words: cat, cart, cot
//   └─ c 3              numbers are counts, * marks a terminal node
//      ├─ a 2
//      │  ├─ r 1
//      │  │  └─ t 1 *
//      │  └─ t 1 *
//      └─ o 1
//         └─ t 1 *
//
// All public methods accept raw entries and normalise them first (see
// normalize.js), so "Café", "cafe" and " CAFE " are the same word.
const { InvalidWord, LETTERS, normalizePrefix, normalizeWord } = require('./normalize');
const { ANY_LETTER, ANY_RUN, parsePattern } = require('./pattern');

class Node {
  constructor() {
    this.children = new Map(); // letter -> Node
    this.terminal = false; // true when the path to this node spells a stored word
    this.count = 0; // stored words at or below this node
    this.longest = 0; // length of the longest stored word at or below this node
  }
}

/** A set of normalised words with prefix counts and alphabetical iteration. */
class WordContainer {
  constructor(words = []) {
    this._root = new Node();
    this._size = 0;
    this.addAll(words);
  }

  get size() {
    return this._size;
  }

  has(word) {
    let key;
    try {
      key = normalizeWord(word);
    } catch (error) {
      if (error instanceof InvalidWord) return false;
      throw error;
    }
    const node = this._find(key);
    return node !== null && node.terminal;
  }

  [Symbol.iterator]() {
    return this.withPrefix('');
  }

  /**
   * Store an entry in normalised form.
   * Returns true when the word is new and false when it was already stored.
   * Throws InvalidWord when the entry cannot be normalised.
   */
  add(word) {
    const key = normalizeWord(word);
    const path = [this._root];
    for (const letter of key) {
      const parent = path[path.length - 1];
      let child = parent.children.get(letter);
      if (!child) {
        child = new Node();
        parent.children.set(letter, child);
      }
      path.push(child);
    }
    const last = path[path.length - 1];
    if (last.terminal) return false;
    // Only a new word changes the counts along its path.
    last.terminal = true;
    for (const node of path) {
      node.count++;
      if (node.longest < key.length) node.longest = key.length;
    }
    this._size++;
    return true;
  }

  /** Add every entry; returns how many of them were new. */
  addAll(words) {
    let added = 0;
    for (const word of words) if (this.add(word)) added++;
    return added;
  }

  /** Delete a word. Returns true if it was stored, false otherwise. */
  remove(word) {
    let key;
    try {
      key = normalizeWord(word);
    } catch (error) {
      if (error instanceof InvalidWord) return false;
      throw error;
    }
    const path = [this._root];
    for (const letter of key) {
      const child = path[path.length - 1].children.get(letter);
      if (!child) return false;
      path.push(child);
    }
    const last = path[path.length - 1];
    if (!last.terminal) return false;
    last.terminal = false;
    this._size--;
    for (const node of path) node.count--;
    // Drop the tail of the branch if no other word runs through it.
    for (let depth = key.length; depth > 0; depth--) {
      if (path[depth].count) break;
      path[depth - 1].children.delete(key[depth - 1]);
    }
    // The removed word may have been the longest below some of its prefixes.
    for (let depth = key.length; depth >= 0; depth--) {
      const node = path[depth];
      let longest = node.terminal ? depth : 0;
      for (const child of node.children.values()) if (child.longest > longest) longest = child.longest;
      node.longest = longest;
    }
    return true;
  }

  /** Number of stored words that start with prefix ('' counts every word). */
  count(prefix = '') {
    const node = this._find(normalizePrefix(prefix));
    return node ? node.count : 0;
  }

  /**
   * The stored words that start with prefix, in alphabetical order.
   * Don't add or remove words while iterating.
   */
  *withPrefix(prefix = '') {
    const start = normalizePrefix(prefix);
    const first = this._find(start);
    if (!first) return;
    const stack = [[first, start]];
    while (stack.length) {
      const [node, word] = stack.pop();
      if (node.terminal) yield word;
      // Push in reverse so the alphabetically first child is popped next.
      const letters = [...node.children.keys()].sort().reverse();
      for (const letter of letters) stack.push([node.children.get(letter), word + letter]);
    }
  }

  /**
   * Stored words that fit a crossword pattern, in alphabetical order.
   *
   * pattern is a string such as "c?t" or "c?t*" (see pattern.js) or a parsed
   * Pattern. With limit = null every match is returned; otherwise at most
   * `limit` words, the alphabetically first ones. A negative limit throws a
   * RangeError.
   *
   * One depth-first walk of the trie, in letter order, that only follows edges
   * the pattern allows: a fixed letter follows a single edge, and only "?" and
   * "*" fan out. The walk carries the *set* of pattern positions still in play
   * (a bitmask), so a word reachable through several star splits is still
   * visited once. Branches whose longest word is too short for the rest of the
   * pattern are skipped.
   */
  match(pattern, limit = null) {
    const parsed = parsePattern(pattern);
    if (limit !== null && limit < 0) throw new RangeError(`limit must be zero or more, got ${limit}`);
    const found = [];
    if (limit === 0) return found;

    const symbols = parsed.text;
    const size = symbols.length; // at most MAX_SYMBOLS (25), so masks fit in 32 bits
    // Bit i of a state set: the next letter may be matched against symbols[i].
    // Bit `size`: the whole pattern has been matched.
    const done = 1 << size;
    let stars = 0;
    let wild = 0;
    const takes = {}; // letter -> positions that accept it
    for (const letter of LETTERS) takes[letter] = 0;
    for (let i = 0; i < size; i++) {
      const bit = 1 << i;
      if (symbols[i] === ANY_RUN) {
        stars |= bit;
        wild |= bit;
      } else if (symbols[i] === ANY_LETTER) {
        wild |= bit;
        for (const letter of LETTERS) takes[letter] |= bit;
      } else {
        takes[symbols[i]] |= bit;
      }
    }
    // need[i]: letters still required from position i to the end.
    const need = new Array(size + 1).fill(0);
    for (let i = size - 1; i >= 0; i--) need[i] = need[i + 1] + (symbols[i] === ANY_RUN ? 0 : 1);
    // A star may match nothing, so the symbol after it is in play too.
    // parsePattern collapses runs of stars, so one step is enough.
    const expand = states => states | ((states & stars) << 1);
    const highest = states => 31 - Math.clz32(states);

    const visit = (node, word, states) => {
      if (node.terminal && (states & done)) {
        found.push(word);
        if (found.length === limit) return true;
      }
      let letters;
      if (states & wild) {
        letters = [...node.children.keys()].sort();
      } else {
        // Only fixed letters are in play: follow just those edges.
        letters = [];
        for (let i = 0; i < size; i++) if ((states >> i) & 1 && !letters.includes(symbols[i])) letters.push(symbols[i]);
        letters.sort();
      }
      const depth = word.length + 1;
      for (const letter of letters) {
        const child = node.children.get(letter);
        if (!child) continue;
        // Matched symbols advance one position; stars stay put.
        let after = ((states & takes[letter]) << 1) | (states & stars);
        if (!after) continue;
        after = expand(after);
        // need[] shrinks left to right, so the furthest position needs the least.
        if (child.longest < depth + need[highest(after)]) continue;
        if (visit(child, word + letter, after)) return true;
      }
      return false;
    };

    visit(this._root, '', expand(1));
    return found;
  }

  /** The node for an already-normalised prefix, or null. */
  _find(key) {
    let node = this._root;
    for (const letter of key) {
      node = node.children.get(letter);
      if (!node) return null;
    }
    return node;
  }

  toString() {
    return `WordContainer(${this._size} words)`;
  }
}

module.exports = { WordContainer };
