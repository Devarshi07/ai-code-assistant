package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import oneofeach.Selection;
import oneofeach.Solver;
import oneofeach.Word;
import oneofeach.WordList;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase2Test {
    /** Independent check: a real board built from the candidates, honestly scored. */
    static void assertValidSelection(Collection<?> candidates, Selection result) {
        Set<String> pool = new HashSet<>();
        for (Object c : candidates) pool.add(c instanceof Word word ? word.text() : ((String) c).strip().toLowerCase());
        List<String> words = new ArrayList<>(result.words());
        assertEquals(words.stream().sorted().toList(), words, "words must be in alphabetical order");
        Set<Character> seen = new HashSet<>();
        int tiles = 0;
        for (String word : words) {
            assertTrue(pool.contains(word), "'" + word + "' is not one of the candidates");
            Set<Character> letters = new HashSet<>();
            for (char ch : word.toCharArray()) letters.add(ch);
            assertEquals(word.length(), letters.size(), "'" + word + "' repeats a letter");
            for (char ch : word.toCharArray()) {
                assertFalse(seen.contains(ch), "'" + word + "' reuses '" + ch + "', which is already on the board");
                seen.add(ch);
            }
            tiles += word.length();
        }
        assertEquals(tiles, result.total(), "total must count every tile");
    }

    static void check(Collection<?> candidates, List<String> words, int total, String message) {
        Selection result = Solver.bestSelection(candidates);
        assertValidSelection(candidates, result);
        assertEquals(total, result.total(), message);
        assertEquals(words, result.words(), message);
    }

    static void check(Collection<?> candidates, List<String> words, int total) {
        check(candidates, words, total, null);
    }

    @Nested
    class BestSelectionTests {
        @Test
        void threeAnimalsFitTogether() {
            check(List.of("cat", "dog", "bird", "fish"), List.of("cat", "dog", "fish"), 10);
        }

        @Test
        void wordsWithRepeatedLettersAreNeverUsed() {
            check(List.of("letter", "otter", "cab", "dim"), List.of("cab", "dim"), 6);
        }

        @Test
        void longestWordFirstIsNotOptimal() {
            check(List.of("blanket", "trophy", "jumbled", "fix"), List.of("fix", "jumbled", "trophy"), 16,
                    "two medium words beat the longest word");
        }

        @Test
        void tieGoesToTheAlphabeticallyFirstWordList() {
            // 'pod tan' and 'and top' both cover the same six letters.
            check(List.of("tan", "pod", "top", "and"), List.of("and", "top"), 6);
        }

        @Test
        void anagramTiePicksTheFirstSpelling() {
            check(List.of("pot", "top", "opt", "and"), List.of("and", "opt"), 6);
        }

        @Test
        void wordsAreNormalizedAndDeduplicated() {
            check(List.of("Tango", "tango", " FLY ", "jinx"), List.of("fly", "tango"), 8);
        }

        @Test
        void nothingPlayableGivesAnEmptyBoard() {
            check(List.of(), List.of(), 0);
            check(List.of("otter", "llama", "kiwi"), List.of(), 0);
        }

        @Test
        void sixteenCandidatesWithFiveTiedBoards() {
            List<String> candidates = List.of("quiz", "jumpy", "vex", "fjord", "glyph", "brick", "wealth", "stomp", "dwarf", "nymph",
                    "sculpt", "garden", "volcano", "kiosk", "whisky", "zebra");
            check(candidates, List.of("dwarf", "glyph", "quiz", "vex"), 17);
        }

        @Test
        void acceptsWordsFromTheLoader() {
            check(WordList.parse("Banjo 2 music\nharp 1 music\nsax 2 music\nflute 1 music\n"), List.of("banjo", "flute"), 10);
        }

        @Test
        void musicThemeFromTheWordList() {
            check(WordList.filter(WordList.load(), "music", 2), List.of("chord", "flute", "jam"), 13);
        }

        @Test
        void kitchenThemeFromTheWordList() {
            check(WordList.filter(WordList.load(), "kitchen", 2), List.of("bread", "fig", "plum", "wok"), 15);
        }
    }
}
