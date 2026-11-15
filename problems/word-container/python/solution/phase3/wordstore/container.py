"""WordContainer: the in-memory word store behind the crossword helper.

Words live in a trie (prefix tree). Each node stands for a prefix, and a node
is *terminal* when that prefix is itself a stored word. Every node also counts
the stored words at or below it, so the autocomplete badge ("12 words start
with 'tra'") costs one walk down the prefix instead of a scan.

    (root) 3            stored words: cat, cart, cot
    └─ c 3              numbers are counts, * marks a terminal node
       ├─ a 2
       │  ├─ r 1
       │  │  └─ t 1 *
       │  └─ t 1 *
       └─ o 1
          └─ t 1 *

All public methods accept raw entries and normalise them first (see
normalize.py), so "Café", "cafe" and " CAFE " are the same word.
"""
from .normalize import LETTERS, InvalidWord, normalize_prefix, normalize_word
from .pattern import ANY_LETTER, ANY_RUN, parse_pattern


class _Node:
    __slots__ = ("children", "terminal", "count", "longest")

    def __init__(self):
        self.children = {}      # letter -> _Node
        self.terminal = False   # True when the path to this node spells a stored word
        self.count = 0          # stored words at or below this node
        self.longest = 0        # length of the longest stored word at or below this node


class WordContainer:
    """A set of normalised words with prefix counts and alphabetical iteration."""

    def __init__(self, words=()):
        self._root = _Node()
        self._size = 0
        self.add_all(words)

    def __len__(self):
        return self._size

    def __contains__(self, word):
        try:
            key = normalize_word(word)
        except InvalidWord:
            return False
        node = self._find(key)
        return node is not None and node.terminal

    def __iter__(self):
        return self.with_prefix("")

    def __repr__(self):
        return f"WordContainer({self._size} words)"

    def add(self, word):
        """Store an entry in normalised form.

        Returns True when the word is new and False when it was already stored.
        Raises InvalidWord when the entry cannot be normalised.
        """
        key = normalize_word(word)
        path = [self._root]
        for letter in key:
            child = path[-1].children.get(letter)
            if child is None:
                child = path[-1].children[letter] = _Node()
            path.append(child)
        if path[-1].terminal:
            return False
        # Only a new word changes the counts along its path.
        path[-1].terminal = True
        size = len(key)
        for node in path:
            node.count += 1
            if node.longest < size:
                node.longest = size
        self._size += 1
        return True

    def add_all(self, words):
        """Add every entry; returns how many of them were new."""
        added = 0
        for word in words:
            if self.add(word):
                added += 1
        return added

    def remove(self, word):
        """Delete a word. Returns True if it was stored, False otherwise."""
        try:
            key = normalize_word(word)
        except InvalidWord:
            return False
        path = [self._root]
        for letter in key:
            child = path[-1].children.get(letter)
            if child is None:
                return False
            path.append(child)
        if not path[-1].terminal:
            return False
        path[-1].terminal = False
        self._size -= 1
        for node in path:
            node.count -= 1
        # Drop the tail of the branch if no other word runs through it.
        for depth in range(len(key), 0, -1):
            if path[depth].count:
                break
            del path[depth - 1].children[key[depth - 1]]
        # The removed word may have been the longest below some of its prefixes.
        for depth in range(len(key), -1, -1):
            node = path[depth]
            longest = depth if node.terminal else 0
            for child in node.children.values():
                if child.longest > longest:
                    longest = child.longest
            node.longest = longest
        return True

    def count(self, prefix=""):
        """Number of stored words that start with prefix ("" counts every word)."""
        node = self._find(normalize_prefix(prefix))
        return node.count if node is not None else 0

    def with_prefix(self, prefix=""):
        """Yield the stored words that start with prefix, in alphabetical order.

        Don't add or remove words while iterating.
        """
        start = normalize_prefix(prefix)
        node = self._find(start)
        if node is None:
            return
        stack = [(node, start)]
        while stack:
            node, word = stack.pop()
            if node.terminal:
                yield word
            # Push in reverse so the alphabetically first child is popped next.
            for letter in sorted(node.children, reverse=True):
                stack.append((node.children[letter], word + letter))

    def match(self, pattern, limit=None):
        """Stored words that fit a crossword pattern, in alphabetical order.

        pattern is a string such as "c?t" or "c?t*" (see pattern.py) or a parsed
        Pattern. With limit=None every match is returned; otherwise at most
        `limit` words, the alphabetically first ones. A negative limit is a
        ValueError.

        One depth-first walk of the trie, in letter order, that only follows
        edges the pattern allows: a fixed letter follows a single edge, and only
        "?" and "*" fan out. The walk carries the *set* of pattern positions
        still in play (a bitmask), so a word reachable through several star
        splits is still visited once. Branches whose longest word is too short
        for the rest of the pattern are skipped.
        """
        pattern = parse_pattern(pattern)
        if limit is not None and limit < 0:
            raise ValueError(f"limit must be zero or more, got {limit}")
        found = []
        if limit == 0:
            return found

        symbols = pattern.text
        size = len(symbols)
        # Bit i of a state set: the next letter may be matched against symbols[i].
        # Bit `size`: the whole pattern has been matched.
        done = 1 << size
        stars = wild = 0
        takes = dict.fromkeys(LETTERS, 0)  # letter -> positions that accept it
        for i, symbol in enumerate(symbols):
            bit = 1 << i
            if symbol == ANY_RUN:
                stars |= bit
                wild |= bit
            elif symbol == ANY_LETTER:
                wild |= bit
                for letter in takes:
                    takes[letter] |= bit
            else:
                takes[symbol] |= bit
        # need[i]: letters still required from position i to the end.
        need = [0] * (size + 1)
        for i in range(size - 1, -1, -1):
            need[i] = need[i + 1] + (symbols[i] != ANY_RUN)

        def expand(states):
            # A star may match nothing, so the symbol after it is in play too.
            # parse_pattern collapses runs of stars, so one step is enough.
            return states | (states & stars) << 1

        def visit(node, word, states):
            if node.terminal and states & done:
                found.append(word)
                if len(found) == limit:
                    return True
            if states & wild:
                letters = sorted(node.children)
            else:
                # Only fixed letters are in play: follow just those edges.
                letters = sorted({symbols[i] for i in range(size) if states >> i & 1})
            depth = len(word) + 1
            for letter in letters:
                child = node.children.get(letter)
                if child is None:
                    continue
                # Matched symbols advance one position; stars stay put.
                after = (states & takes[letter]) << 1 | (states & stars)
                if not after:
                    continue
                after = expand(after)
                # need[] shrinks left to right, so the furthest position needs the least.
                if child.longest < depth + need[after.bit_length() - 1]:
                    continue
                if visit(child, word + letter, after):
                    return True
            return False

        visit(self._root, "", expand(1))
        return found

    def _find(self, key):
        """The node for an already-normalised prefix, or None."""
        node = self._root
        for letter in key:
            node = node.children.get(letter)
            if node is None:
                return None
        return node
