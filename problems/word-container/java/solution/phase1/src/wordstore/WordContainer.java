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
        for (Node node : path) node.count++;
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
     */
    public List<String> match(Pattern pattern, Integer limit) {
        throw new UnsupportedOperationException("Phase 2: WordContainer.match is not implemented");
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
