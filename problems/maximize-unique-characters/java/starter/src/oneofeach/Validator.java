package oneofeach;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Checks a board against the puzzle rules before it is published.
 *
 * <p>The rules of One of Each:
 * <ol>
 *   <li>a word may not use any letter twice ("otter" is out);</li>
 *   <li>no letter may appear in more than one word on the board.</li>
 * </ol>
 */
public final class Validator {
    private Validator() {}

    /** Human-readable rule violations for a board; empty when it is valid. */
    public static List<String> selectionProblems(Collection<?> items) {
        List<Word> words = Word.asWords(items);
        List<String> problems = new ArrayList<>();
        List<Word> placed = new ArrayList<>();
        int used = 0;
        for (Word word : words) {
            if (word.hasRepeats()) {
                StringBuilder doubled = new StringBuilder();
                for (char ch : word.letters().toCharArray()) {
                    if (word.text().chars().filter(c -> c == ch).count() > 1) doubled.append(ch);
                }
                problems.add("'" + word.text() + "' uses '" + doubled + "' more than once");
            }
            int clash = used & word.mask();
            if (clash != 0) {
                String others = placed.stream()
                        .filter(other -> (other.mask() & clash) != 0)
                        .map(other -> "'" + other.text() + "'")
                        .collect(Collectors.joining(", "));
                problems.add("'" + word.text() + "' shares '" + Letters.maskLetters(clash) + "' with " + others);
            }
            used |= word.mask();
            placed.add(word);
        }
        return problems;
    }

    public static boolean isValidSelection(Collection<?> items) {
        return selectionProblems(items).isEmpty();
    }
}
