package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import oneofeach.Selection;
import oneofeach.Solver;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase3Test {
    /** Independent check: a real board built from the candidates, honestly scored. */
    static void assertValidSelection(List<String> candidates, Selection result) {
        Set<String> pool = new HashSet<>();
        for (String c : candidates) pool.add(c.strip().toLowerCase(Locale.ROOT));
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

    static void check(List<String> candidates, List<String> words, int total) {
        Selection result = Solver.bestSelection(candidates);
        assertValidSelection(candidates, result);
        assertEquals(total, result.total());
        assertEquals(words, result.words());
    }

    static void timed(List<String> candidates, List<String> words, int total, double limitMs) {
        long start = System.nanoTime();
        Selection result = Solver.bestSelection(candidates);
        double elapsed = (System.nanoTime() - start) / 1e6;
        assertValidSelection(candidates, result);
        assertEquals(total, result.total());
        assertEquals(words, result.words());
        assertTrue(elapsed < limitMs, String.format(Locale.ROOT,
                "took %.0fms; a %d-word pack must solve in under %.0fms", elapsed, candidates.size(), limitMs));
    }

    /** Untimed practice runs so the timed packs measure the algorithm, not the JIT compiler. */
    static void warmUp() {
        for (int i = 0; i < 20; i++) {
            Solver.bestSelection(ThemePacks.shortWordPack(5, 70));
            Solver.bestSelection(ThemePacks.shortWordPack(21, 120));
            Solver.bestSelection(ThemePacks.longWordPack(6, 150));
            Solver.bestSelection(ThemePacks.longWordPack(8, 250));
        }
    }

    @Nested
    class ScaleTests {
        @Test
        void anagramSpellingsKeepTheAlphabeticalTieBreak() {
            List<String> candidates = List.of("stop", "pots", "tops", "opts", "spot", "post", "Chew", "chew", "cheww", "pod", "tan", "and", "top");
            check(candidates, List.of("and", "chew", "opts"), 11);
        }

        @Test
        void smallShortWordPack() {
            // 16 boards tie on 20 letters.
            check(ThemePacks.shortWordPack(5, 70), List.of("dqat", "ek", "fpsn", "hy", "ir", "jm", "zwlo"), 20);
        }

        @Test
        void mediumShortWordPack() {
            // 52 boards over five different letter sets tie on 21 letters.
            check(ThemePacks.shortWordPack(21, 120), List.of("cq", "eb", "gn", "iay", "mh", "oz", "srx", "tdw", "vu"), 21);
        }

        @Test
        void smallLongWordPack() {
            // 512 spellings of the same board tie on 20 letters.
            check(ThemePacks.longWordPack(6, 150), List.of("azlhmby", "cgoq", "iwju", "svdrt"), 20);
        }

        @Test
        void mediumLongWordPack() {
            check(ThemePacks.longWordPack(8, 250), List.of("abktj", "cxuonyz", "dwep", "hvqlmr"), 22);
        }

        @Test
        void largeShortWordPackIsFast() {
            warmUp();
            timed(ThemePacks.shortWordPack(11, 240), List.of("ai", "bw", "cv", "ez", "fo", "kut", "lh", "pqs", "rm", "xgd", "yn"), 25, 150);
        }

        @Test
        void largeLongWordPackIsFast() {
            warmUp();
            timed(ThemePacks.longWordPack(13, 1000), List.of("abyqjn", "csme", "dxkw", "futp", "liozghv"), 25, 150);
        }
    }
}
