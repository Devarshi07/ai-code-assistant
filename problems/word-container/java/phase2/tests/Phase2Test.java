package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import wordstore.Pattern;
import wordstore.PatternException;
import wordstore.WordContainer;

class Phase2Test {
    static final List<String> SAMPLE = List.of("cat", "cot", "cut", "cute", "cuts", "coat", "cart", "chart", "comet",
            "act", "at", "a", "scat", "tact", "cactus");

    static boolean fits(String pattern, String word) {
        return Pattern.parse(pattern).matches(word);
    }

    static WordContainer sample() {
        return new WordContainer(SAMPLE);
    }

    @Nested
    class PatternMatchesTests {
        @Test
        void questionMarkIsExactlyOneLetter() {
            assertTrue(fits("c?t", "cat"));
            assertTrue(fits("c?t", "cot"));
            for (String word : List.of("ct", "coat", "scat", "cats")) assertFalse(fits("c?t", word), "c?t should not match " + word);
        }

        @Test
        void starMatchesAnyRunIncludingNone() {
            for (String word : List.of("ct", "cat", "chart")) assertTrue(fits("c*t", word), "c*t should match " + word);
            assertFalse(fits("c*t", "cats"));
            assertFalse(fits("c*t", "act"));
            assertTrue(fits("*", "a"));
            assertTrue(fits("cat*", "cat"));
        }

        @Test
        void starsCanGiveLettersBack() {
            assertTrue(fits("*ab", "aab"));
            assertTrue(fits("*ab", "abab"));
            assertFalse(fits("*ab", "aba"));
            assertTrue(fits("a*b*c", "aabbcc"));
            assertFalse(fits("a*b*c", "acb"));
            assertTrue(fits("*a*a", "banana"));
            assertTrue(fits("*s*s*s*", "mississippi"));
        }

        @Test
        void questionMarksAndStarsTogether() {
            assertFalse(fits("?*?", "a"));
            assertTrue(fits("?*?", "ab"));
            assertTrue(fits("?*?", "abc"));
            assertTrue(fits("ba??na*", "banana"));
            assertFalse(fits("ba??na*", "bandana"));
            assertFalse(fits("*a*a", "a"));
        }
    }

    @Nested
    class WordContainerMatchTests {
        @Test
        void crosswordClue() {
            assertEquals(List.of("cat", "cot", "cut"), sample().match("c?t"));
        }

        @Test
        void trailingStarKeepsAlphabeticalOrder() {
            assertEquals(List.of("cat", "cot", "cut", "cute", "cuts"), sample().match("c?t*"));
        }

        @Test
        void starsAnywhere() {
            WordContainer words = sample();
            assertEquals(List.of("cart", "cat", "chart", "coat", "comet", "cot", "cut"), words.match("c*t"));
            assertEquals(List.of("at", "cat", "coat", "scat"), words.match("*at"));
            assertEquals(List.of("act", "at", "cactus", "cart", "cat", "chart", "coat", "scat", "tact"), words.match("*a*t*"));
            assertEquals(List.of("cactus"), words.match("*c*c*"));
        }

        @Test
        void wholeStoreAndFixedLengths() {
            WordContainer words = sample();
            List<String> everything = new ArrayList<>(SAMPLE);
            Collections.sort(everything);
            assertEquals(everything, words.match("*"));
            assertEquals(List.of("cart", "coat", "cute", "cuts", "scat", "tact"), words.match("????"));
            assertEquals(List.of("a"), words.match("?"));
            assertEquals(List.of("cute", "cuts"), words.match("*t?"));
        }

        @Test
        void noMatches() {
            WordContainer words = sample();
            assertEquals(List.of(), words.match("q??"));
            assertEquals(List.of(), words.match("??????????"));
        }

        @Test
        void limitReturnsTheAlphabeticallyFirstMatches() {
            WordContainer words = sample();
            assertEquals(List.of("cactus", "cart", "cat"), words.match("c*", 3));
            assertEquals(List.of("act", "at"), words.match("*t", 2));
            assertEquals(List.of(), words.match("c?t", 0));
            assertEquals(List.of("cat", "cot", "cut"), words.match("c?t", 50));
        }

        @Test
        void negativeLimitIsRejected() {
            assertThrows(IllegalArgumentException.class, () -> sample().match("c?t", -1));
        }

        @Test
        void patternsAreNormalised() {
            WordContainer words = sample();
            assertEquals(List.of("cat", "cot", "cut"), words.match("C.T"));
            assertEquals(List.of("cat", "cot", "cut"), words.match("c_t"));
            assertEquals(List.of("cat", "cot", "cut"), words.match(Pattern.parse("C?T")));
            words.add("Café");
            assertEquals(List.of("cafe"), words.match("CAF?"));
        }

        @Test
        void invalidPatternsThrow() {
            WordContainer words = sample();
            for (String raw : List.of("c4t", "", "c+t")) {
                assertThrows(PatternException.class, () -> words.match(raw), "\"" + raw + "\" is not a pattern");
            }
        }

        @Test
        void resultsFollowAdditionsAndRemovals() {
            WordContainer words = sample();
            words.remove("cot");
            words.add("KIT");
            words.add("Cat");
            assertEquals(List.of("cat", "cut"), words.match("c?t"));
            assertEquals(List.of("kit"), words.match("?it"));
        }
    }

    @Nested
    class BundledListsTests {
        @Test
        void solverPanelSearches() {
            WordContainer words = Phase1Test.bundledStore();
            assertEquals(List.of("ball", "bell", "boil", "bowl"), words.match("b??l"));
            assertEquals(List.of("ball", "baseball", "basketball", "football", "netball", "tball", "volleyball"), words.match("*ball"));
            assertEquals(List.of("bowling", "boxing", "curling", "cycling", "diving", "fencing", "king", "rowing", "wing"), words.match("*ing"));
            assertEquals(List.of("cafe", "cake", "candle", "canoe", "castle", "cave"), words.match("c*e", 6));
        }

        @Test
        void fiveLetterSlot() {
            List<String> found = Phase1Test.bundledStore().match("??a??");
            assertEquals(28, found.size());
            assertEquals(List.of("alarm", "beach", "blade", "brain"), found.subList(0, 4));
            assertEquals(List.of("toast", "train", "whale"), found.subList(found.size() - 3, found.size()));
        }
    }
}
