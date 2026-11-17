package wordstore;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * The in-memory word store behind the crossword helper.
 *
 * <p>Words live in a trie (prefix tree). Each node stands for a prefix, and a node
 * is <em>terminal</em> when that prefix is itself a stored word. Every node also
 * counts the stored words at or below it, so the autocomplete badge ("12 words
 * start with 'tra'") costs one walk down the prefix instead of a scan.
 *
 * <pre>
 *   (root) 3            stored words: cat, cart, cot
 *   └─ c 3              numbers are counts, * marks a terminal node
 *      ├─ a 2
 *      │  ├─ r 1
 *      │  │  └─ t 1 *
 *      │  └─ t 1 *
 *      └─ o 1
 *         └─ t 1 *
 * </pre>
 *
 * <p>A node holds one child slot per letter, so walking the slots in order gives
 * alphabetical iteration for free.
 *
 * <p>All public methods accept raw entries and normalise them first (see
 * {@link Normalize}), so "Café", "cafe" and " CAFE " are the same word.
 */
public class WordContainer implements Iterable<String> {
    static final class Node {
        final Node[] children = new Node[26]; // index = letter - 'a'
        boolean terminal; // true when the path to this node spells a stored word
        int count; // stored words at or below this node
        int longest; // length of the longest stored word at or below this node
    }

    private final Node root = new Node();
    private int size;

    public WordContainer() {}

    public WordContainer(Iterable<String> words) {
        addAll(words);
    }

    public int size() {
        return size;
    }

    public boolean has(String word) {
        String key;
        try {
            key = Normalize.normalizeWord(word);
        } catch (InvalidWordException error) {
            return false;
        }
        Node node = find(key);
        return node != null && node.terminal;
    }

    /** Every stored word in alphabetical order. */
    @Override
    public Iterator<String> iterator() {
        return withPrefix("").iterator();
    }

    /**
     * Store an entry in normalised form.
     * Returns true when the word is new and false when it was already stored.
     * Throws InvalidWordException when the entry cannot be normalised.
     */
    public boolean add(String word) {
        String key = Normalize.normalizeWord(word);
        Node[] path = new Node[key.length() + 1];
        path[0] = root;
        for (int i = 0; i < key.length(); i++) {
            int slot = key.charAt(i) - 'a';
            Node child = path[i].children[slot];
            if (child == null) {
                child = new Node();
                path[i].children[slot] = child;
            }
            path[i + 1] = child;
        }
        Node last = path[key.length()];
        if (last.terminal) return false;
        // Only a new word changes the counts along its path.
        last.terminal = true;
        for (Node node : path) {
            node.count++;
            node.longest = Math.max(node.longest, key.length());
        }
        size++;
        return true;
    }

    /** Add every entry; returns how many of them were new. */
    public int addAll(Iterable<String> words) {
        int added = 0;
        for (String word : words) if (add(word)) added++;
        return added;
    }

    /** Delete a word. Returns true if it was stored, false otherwise. */
    public boolean remove(String word) {
        String key;
        try {
            key = Normalize.normalizeWord(word);
        } catch (InvalidWordException error) {
            return false;
        }
        Node[] path = new Node[key.length() + 1];
        path[0] = root;
        for (int i = 0; i < key.length(); i++) {
            Node child = path[i].children[key.charAt(i) - 'a'];
            if (child == null) return false;
            path[i + 1] = child;
        }
        Node last = path[key.length()];
        if (!last.terminal) return false;
        last.terminal = false;
        size--;
        for (Node node : path) node.count--;
        // Drop the tail of the branch if no other word runs through it.
        for (int depth = key.length(); depth > 0; depth--) {
            if (path[depth].count != 0) break;
            path[depth - 1].children[key.charAt(depth - 1) - 'a'] = null;
        }
        // The removed word may have been the longest below some of its prefixes.
        for (int depth = key.length(); depth >= 0; depth--) {
            Node node = path[depth];
            int longest = node.terminal ? depth : 0;
            for (Node child : node.children) if (child != null && child.longest > longest) longest = child.longest;
            node.longest = longest;
        }
        return true;
    }

    /** Number of stored words that start with prefix ("" counts every word). */
    public int count(String prefix) {
        Node node = find(Normalize.normalizePrefix(prefix));
        return node == null ? 0 : node.count;
    }

    /** The stored words that start with prefix, in alphabetical order. */
    public List<String> withPrefix(String prefix) {
        String start = Normalize.normalizePrefix(prefix);
        List<String> words = new ArrayList<>();
        Node first = find(start);
        if (first != null) collect(first, new StringBuilder(start), words);
        return words;
    }

    private static void collect(Node node, StringBuilder word, List<String> into) {
        if (node.terminal) into.add(word.toString());
        for (int slot = 0; slot < 26; slot++) {
            Node child = node.children[slot];
            if (child == null) continue;
            word.append((char) ('a' + slot));
            collect(child, word, into);
            word.setLength(word.length() - 1);
        }
    }

    /**
     * Stored words that fit a crossword pattern such as "c?t" or "c?t*" (see
     * {@link Pattern}), in alphabetical order. Throws PatternException for
     * text that is not a pattern.
     */
    public List<String> match(String pattern) {
        return match(Pattern.parse(pattern), null);
    }

    /** Like {@link #match(Pattern, Integer)} for pattern text. */
    public List<String> match(String pattern, Integer limit) {
        return match(Pattern.parse(pattern), limit);
    }

    public List<String> match(Pattern pattern) {
        return match(pattern, null);
    }

    /**
     * Stored words that fit a parsed Pattern, in alphabetical order.
     *
     * <p>With limit = null every match is returned; otherwise at most {@code limit}
     * words, the alphabetically first ones. A negative limit throws an
     * IllegalArgumentException.
     *
     * <p>One depth-first walk of the trie, in letter order, that only follows edges
     * the pattern allows: a fixed letter follows a single edge, and only "?" and
     * "*" fan out. The walk carries the <em>set</em> of pattern positions still in
     * play (a bitmask), so a word reachable through several star splits is still
     * visited once. Branches whose longest word is too short for the rest of the
     * pattern are skipped.
     */
    public List<String> match(Pattern pattern, Integer limit) {
        if (limit != null && limit < 0) throw new IllegalArgumentException("limit must be zero or more, got " + limit);
        List<String> found = new ArrayList<>();
        if (limit != null && limit == 0) return found;
        new Search(pattern, limit == null ? Integer.MAX_VALUE : limit, found).visit(root, new StringBuilder(), Search.START);
        return found;
    }

    /** One pattern-directed walk of the trie. */
    private static final class Search {
        // Bit i of a state set: the next letter may be matched against symbol i.
        // Bit `size`: the whole pattern has been matched.
        static final int START = 1;

        private final String symbols;
        private final int size; // at most MAX_SYMBOLS (25), so masks fit in an int
        private final int done;
        private final int stars;
        private final int[] takes = new int[26]; // letter -> positions that accept it
        private final int[] need; // need[i]: letters still required from position i to the end
        private final int limit;
        private final List<String> found;

        Search(Pattern pattern, int limit, List<String> found) {
            this.symbols = pattern.text();
            this.size = symbols.length();
            this.done = 1 << size;
            this.limit = limit;
            this.found = found;
            int starBits = 0;
            for (int i = 0; i < size; i++) {
                int bit = 1 << i;
                char symbol = symbols.charAt(i);
                if (symbol == Pattern.ANY_RUN) {
                    starBits |= bit;
                } else if (symbol == Pattern.ANY_LETTER) {
                    for (int letter = 0; letter < 26; letter++) takes[letter] |= bit;
                } else {
                    takes[symbol - 'a'] |= bit;
                }
            }
            this.stars = starBits;
            this.need = new int[size + 1];
            for (int i = size - 1; i >= 0; i--) need[i] = need[i + 1] + (symbols.charAt(i) == Pattern.ANY_RUN ? 0 : 1);
        }

        // A star may match nothing, so the symbol after it is in play too.
        // Pattern.parse collapses runs of stars, so one step is enough.
        private int expand(int states) {
            return states | ((states & stars) << 1);
        }

        /** Returns true once the limit is reached. */
        boolean visit(Node node, StringBuilder word, int states) {
            states = expand(states);
            if (node.terminal && (states & done) != 0) {
                found.add(word.toString());
                if (found.size() == limit) return true;
            }
            int depth = word.length() + 1;
            for (int slot = 0; slot < 26; slot++) {
                Node child = node.children[slot];
                if (child == null) continue;
                // Matched symbols advance one position; stars stay put.
                int after = ((states & takes[slot]) << 1) | (states & stars);
                if (after == 0) continue; // no symbol in play accepts this letter
                // need[] shrinks left to right, so the furthest position needs the least.
                if (child.longest < depth + need[31 - Integer.numberOfLeadingZeros(expand(after))]) continue;
                word.append((char) ('a' + slot));
                boolean stop = visit(child, word, after);
                word.setLength(word.length() - 1);
                if (stop) return true;
            }
            return false;
        }
    }

    /** The node for an already-normalised prefix, or null. */
    private Node find(String key) {
        Node node = root;
        for (int i = 0; i < key.length(); i++) {
            node = node.children[key.charAt(i) - 'a'];
            if (node == null) return null;
        }
        return node;
    }

    @Override
    public String toString() {
        return "WordContainer(" + size + " words)";
    }
}
