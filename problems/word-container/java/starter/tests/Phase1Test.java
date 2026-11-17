package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import wordstore.InvalidWordException;
import wordstore.LoadReport;
import wordstore.Loader;
import wordstore.Normalize;
import wordstore.Report;
import wordstore.WordContainer;

class Phase1Test {
    // Every bundled list, normalised and de-duplicated, holds this many words.
    static final int BUNDLED_TOTAL = 447;
    static final Map<String, Integer> BUNDLED_FIRST_LETTERS = firstLetters(
            "a", 27, "b", 48, "c", 50, "d", 18, "e", 9, "f", 23, "g", 20, "h", 14, "i", 6,
            "j", 14, "k", 10, "l", 15, "m", 18, "n", 10, "o", 9, "p", 31, "q", 3, "r", 24,
            "s", 45, "t", 21, "u", 4, "v", 6, "w", 15, "y", 4, "z", 3);

    static Map<String, Integer> firstLetters(Object... pairs) {
        Map<String, Integer> map = new TreeMap<>();
        for (int i = 0; i < pairs.length; i += 2) map.put((String) pairs[i], (Integer) pairs[i + 1]);
        return map;
    }

    static WordContainer bundledStore() {
        WordContainer words = new WordContainer();
        Loader.loadBundled(words);
        return words;
    }

    static WordContainer sample() {
        return new WordContainer(List.of("cat", "cart", "cot"));
    }

    static List<String> listed(Iterable<String> words) {
        List<String> all = new ArrayList<>();
        for (String word : words) all.add(word);
        return all;
    }

    @Nested
    class NormalizeWordTests {
        @Test
        void lowercasesAndStripsAccents() {
            assertEquals("cafe", Normalize.normalizeWord("Café"));
            assertEquals("naive", Normalize.normalizeWord("  NAÏVE "));
            assertEquals("jalapeno", Normalize.normalizeWord("Jalapeño"));
        }

        @Test
        void dropsSpacesHyphensAndApostrophes() {
            assertEquals("icecream", Normalize.normalizeWord("ice cream"));
            assertEquals("jiujitsu", Normalize.normalizeWord("Jiu-Jitsu"));
            assertEquals("oclock", Normalize.normalizeWord("o'clock"));
            assertEquals("rocknroll", Normalize.normalizeWord("rock ’n’ roll"));
        }

        @Test
        void rejectsEntriesThatAreNotWords() {
            for (String raw : List.of("r2d2", "24/7", "c++", "", "   ", "-")) {
                assertThrows(InvalidWordException.class, () -> Normalize.normalizeWord(raw), "\"" + raw + "\" should be rejected");
            }
        }
    }

    @Nested
    class WordContainerTests {
        @Test
        void addReportsNewAndRepeatedWords() {
            WordContainer words = sample();
            assertTrue(words.add("coat"));
            assertFalse(words.add("Cat"));
            assertEquals(4, words.size());
        }

        @Test
        void lookupsIgnoreCaseAndAccents() {
            WordContainer words = sample();
            assertTrue(words.has("CAT"));
            words.add("Café");
            assertTrue(words.has("cafe"));
            assertTrue(words.has(" CAFÉ "));
            assertFalse(words.has("r2d2"));
        }

        @Test
        void aPrefixIsNotA_Word() {
            WordContainer words = sample();
            assertFalse(words.has("car"));
            assertFalse(words.has("ca"));
            assertFalse(words.has("carts"));
        }

        @Test
        void iteratesInAlphabeticalOrder() {
            WordContainer words = sample();
            words.addAll(List.of("act", "cut", "a", "coat"));
            assertEquals(List.of("a", "act", "cart", "cat", "coat", "cot", "cut"), listed(words));
        }

        @Test
        void withPrefixListsCompletions() {
            WordContainer words = sample();
            assertEquals(List.of("cart", "cat"), words.withPrefix("CA"));
            assertEquals(List.of(), words.withPrefix("dog"));
        }

        @Test
        void countByPrefix() {
            WordContainer words = sample();
            assertEquals(2, words.count("ca"));
            assertEquals(1, words.count("cot"));
            assertEquals(0, words.count("x"));
            assertEquals(3, words.count(""));
        }

        @Test
        void removeForgetsTheWord() {
            WordContainer words = sample();
            assertTrue(words.remove("cart"));
            assertFalse(words.has("cart"));
            assertFalse(words.remove("cart"));
            assertEquals(0, words.count("car"));
            assertEquals(List.of("cat", "cot"), listed(words));
        }

        @Test
        void reAddingA_WordLeavesCountsAlone() {
            WordContainer words = sample();
            words.add("Cat");
            words.add("cat ");
            assertEquals(3, words.size());
            assertEquals(3, words.count(""), "count() must agree with size()");
            assertEquals(2, words.count("ca"), "only cat and cart start with 'ca'");
        }

        @Test
        void retiringA_WordThatWasImportedTwice() {
            WordContainer words = sample();
            words.add("squash");
            words.add("Squash");
            assertTrue(words.remove("squash"));
            assertFalse(words.has("squash"));
            assertEquals(List.of(), words.withPrefix("squ"));
            assertEquals(0, words.count("squ"), "no stored word starts with 'squ' any more");
        }
    }

    @Nested
    class LoaderTests {
        @Test
        void loadTextReportsDuplicatesAndRejects() {
            WordContainer words = new WordContainer();
            LoadReport report = Loader.loadText(words, "# fruit\napple\nApple\n\n24/7\nbanana;40\n  pear  \n", "fruit.txt");
            assertEquals(List.of(3, 1), List.of(report.added, report.duplicates));
            assertEquals(1, report.rejected.size());
            assertEquals(5, report.rejected.get(0).line());
            assertEquals("24/7", report.rejected.get(0).entry());
            assertEquals(List.of("apple", "banana", "pear"), listed(words));
        }

        @Test
        void bundledListsImportSummary() {
            WordContainer words = new WordContainer();
            List<LoadReport> reports = Loader.loadBundled(words);
            List<List<Integer>> summary = reports.stream().map(r -> List.of(r.added, r.duplicates, r.rejected.size())).toList();
            assertEquals(List.of(List.of(339, 1, 2), List.of(67, 10, 0), List.of(41, 18, 0)), summary);
            assertEquals(BUNDLED_TOTAL, words.size());
        }

        @Test
        void letterBreakdownAddsUpToTheTotal() {
            WordContainer words = bundledStore();
            Map<String, Integer> breakdown = Report.letterBreakdown(words);
            int sum = breakdown.values().stream().mapToInt(Integer::intValue).sum();
            assertEquals(words.size(), sum, "the A-Z rows must add up to the headline total");
            assertEquals(BUNDLED_FIRST_LETTERS, breakdown);
        }

        @Test
        void prefixBadgesMatchTheListedCompletions() {
            WordContainer words = bundledStore();
            for (String prefix : List.of("bowl", "squ", "ba", "ca", "s")) {
                assertEquals(words.withPrefix(prefix).size(), words.count(prefix), "badge for '" + prefix + "'");
            }
        }
    }
}
