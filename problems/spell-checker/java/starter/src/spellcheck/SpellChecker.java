package spellcheck;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Finds the misspelled words in a note.
 *
 * <p>The editor calls {@link #check(String)} on every keystroke pause, so it
 * only reports where the problems are. Suggestions are fetched separately,
 * when the user opens the right-click menu on an underlined word.
 */
public final class SpellChecker {
    private final Dictionary dictionary;
    private final boolean ignoreUppercase; // skip acronyms such as NASA
    private final Set<String> ignored = new HashSet<>();
    private Suggester suggester;

    public SpellChecker(Dictionary dictionary) {
        this(dictionary, true);
    }

    public SpellChecker(Dictionary dictionary, boolean ignoreUppercase) {
        this.dictionary = dictionary;
        this.ignoreUppercase = ignoreUppercase;
    }

    public Dictionary dictionary() {
        return dictionary;
    }

    /** "Ignore all" from the context menu: accept word for this session. */
    public void ignore(String word) {
        ignored.add(Dictionary.normalize(word));
    }

    public boolean isKnown(String word) {
        String key = Dictionary.normalize(word);
        if (ignored.contains(key) || dictionary.contains(key)) {
            return true;
        }
        // Possessives aren't listed separately: "team's" is fine if "team" is.
        return key.endsWith("'s") && dictionary.contains(key.substring(0, key.length() - 2));
    }

    /** Every misspelled word in text, in order of appearance. */
    public List<Misspelling> check(String text) {
        List<Misspelling> found = new ArrayList<>();
        for (Token token : Tokenizer.tokenize(text)) {
            if (ignoreUppercase && isShouting(token.text())) {
                continue;
            }
            if (!isKnown(token.text())) {
                found.add(new Misspelling(token.text(), token.start(), token.end()));
            }
        }
        return found;
    }

    public List<String> suggest(String word) {
        return suggest(word, Suggester.DEFAULT_LIMIT);
    }

    /** Replacements for word, capitalised the way the user wrote it. */
    public List<String> suggest(String word, int limit) {
        if (suggester == null) {
            suggester = new Suggester(dictionary);
        }
        return suggester.suggest(word, limit).stream().map(s -> matchCase(word, s)).toList();
    }

    /** Gives a suggestion the capitalisation of the word it would replace. */
    public static String matchCase(String template, String word) {
        if (isShouting(template)) {
            return word.toUpperCase(Locale.ROOT);
        }
        if (!template.isEmpty() && !word.isEmpty() && Character.isUpperCase(template.charAt(0))) {
            return Character.toUpperCase(word.charAt(0)) + word.substring(1);
        }
        return word;
    }

    /** All capitals and longer than one letter: NASA, TODO, DON'T. */
    private static boolean isShouting(String word) {
        return word.length() > 1
                && word.equals(word.toUpperCase(Locale.ROOT))
                && !word.equals(word.toLowerCase(Locale.ROOT));
    }
}
