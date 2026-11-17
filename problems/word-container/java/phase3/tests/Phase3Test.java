package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import wordstore.WordContainer;

class Phase3Test {
    // The whole grid-fill batch (500 queries on a 130k-word dictionary) must finish in this time.
    static final long BATCH_MS = 800;

    // Awkward shapes: leading stars, several stars, stars between blanks.
    static final List<String> TRICKY = List.of("*ing", "*a*a*", "?*?*?", "*oo*", "b*b", "*x", "???*???", "*e?e*", "s*s*s", "?");

    record Query(String pattern, Integer limit) {}

    /** Independent check: the pattern as a regular expression, tried on every word. */
    static List<String> bruteForce(List<String> words, String pattern, Integer limit) {
        java.util.regex.Pattern regex = java.util.regex.Pattern.compile(pattern.replace("?", "[a-z]").replace("*", "[a-z]*"));
        List<String> found = new ArrayList<>();
        for (String word : words) {
            if (!regex.matcher(word).matches()) continue;
            found.add(word);
            if (limit != null && found.size() == limit) break;
        }
        return found;
    }

    static List<String> listed(Iterable<String> words) {
        List<String> all = new ArrayList<>();
        for (String word : words) all.add(word);
        return all;
    }

    static List<Object> summary(List<String> found) {
        return List.of(found.size(), found.subList(0, Math.min(3, found.size())), found.subList(Math.max(0, found.size() - 3), found.size()));
    }

    @Nested
    @TestInstance(TestInstance.Lifecycle.PER_CLASS)
    class MediumDictionaryTests {
        WordContainer words;
        List<String> all;

        @BeforeAll
        void build() {
            words = new WordContainer(Generator.generateWords(11, 20000));
            all = listed(words);
        }

        @Test
        void dictionarySize() {
            assertEquals(19084, words.size());
        }

        @Test
        void knownAnswers() {
            assertEquals(List.of("brack", "brarkeetroun", "brecksilbrats", "breekour", "briekoal",
                    "briekoulls", "briekout", "brookoonts", "broxkais", "brudkaiing"), words.match("br??k*"));
            assertEquals(List.of("seaze", "slabe"), words.match("s?a?e"));
            assertEquals(List.of("boooodthoob", "liebroooop", "nooostciex", "yoooy"), words.match("*ooo*"));
            assertEquals(List.of(), words.match("?*z"));
            assertEquals(List.of(), words.match("q*"));
        }

        @Test
        void broadPatterns() {
            Map<String, List<Object>> cases = new java.util.LinkedHashMap<>();
            cases.put("?oo?", List.of(72, List.of("boog", "bool", "boom"), List.of("zoop", "zoos", "zoot")));
            cases.put("*ing", List.of(1153, List.of("ailling", "airing", "aisleating"), List.of("zydnaing", "zyllthiexing", "zyting")));
            cases.put("??????", List.of(1833, List.of("aibtai", "aichee", "ailler"), List.of("zynpie", "zyting", "zytwos")));
            cases.put("*a*e*i*", List.of(218, List.of("aisleating", "aitmeaing", "aitveeting"), List.of("zasitweasing", "zauntslenwai", "zeaketmid")));
            cases.put("??????????????????*", List.of(13, List.of("braindstougjending", "braingshaunclecking", "deantchoondclinter"),
                    List.of("speentploolconging", "stierfloackbriered", "stoungspeantpleast")));
            for (Map.Entry<String, List<Object>> expected : cases.entrySet()) {
                assertEquals(expected.getValue(), summary(words.match(expected.getKey())), "pattern " + expected.getKey());
            }
            assertEquals(all, words.match("*"));
        }

        @Test
        void limits() {
            assertEquals(List.of("sa", "sab", "sabbat", "sabot", "sabraclour"), words.match("s*", 5));
            assertEquals(List.of("ailling", "airing", "aisleating", "aitmeaing"), words.match("*ing", 4));
            assertEquals(List.of("bedeadbrall", "beeed", "beeeed", "behextecker", "bekeed", "bereater"), words.match("?e?e*", 6));
        }

        @Test
        void generatedQueriesAgreeWithBruteForce() {
            List<String> patterns = new ArrayList<>(Generator.slotPatterns(all, 5, 30));
            patterns.addAll(Generator.searchPatterns(all, 6, 20));
            patterns.addAll(TRICKY);
            for (String pattern : patterns) assertEquals(bruteForce(all, pattern, null), words.match(pattern), "pattern " + pattern);
            for (String pattern : TRICKY) assertEquals(bruteForce(all, pattern, 7), words.match(pattern, 7), "pattern " + pattern + ", limit 7");
        }
    }

    @Nested
    class MutationTests {
        @Test
        void resultsTrackAdditionsAndRemovals() {
            WordContainer words = new WordContainer(Generator.generateWords(3, 6000));
            List<String> all = listed(words);
            List<String> queries = new ArrayList<>(Generator.slotPatterns(all, 8, 15));
            queries.addAll(Generator.searchPatterns(all, 9, 10));
            queries.addAll(TRICKY);
            queries.add("*");
            queries.add("????????????*");
            for (String pattern : queries) words.match(pattern); // warm up anything an implementation caches
            List<String> retired = new ArrayList<>();
            for (int i = 0; i < all.size(); i++) if (i % 3 == 0 || all.get(i).length() > 11) retired.add(all.get(i));
            for (String word : retired) assertTrue(words.remove(word), "remove " + word);
            List<String> newcomers = Generator.generateWords(4, 3000);
            words.addAll(newcomers);
            Set<String> gone = new HashSet<>(retired);
            TreeSet<String> kept = new TreeSet<>();
            for (String word : all) if (!gone.contains(word)) kept.add(word);
            kept.addAll(newcomers);
            List<String> current = new ArrayList<>(kept);
            assertEquals(current, listed(words));
            for (String pattern : queries) assertEquals(bruteForce(current, pattern, null), words.match(pattern), "pattern " + pattern);
            assertEquals(bruteForce(current, "*ing", 5), words.match("*ing", 5));
        }
    }

    @Nested
    @TestInstance(TestInstance.Lifecycle.PER_CLASS)
    class ScaleTests {
        WordContainer words;
        List<Query> batch;
        List<Query> warmUp;

        @BeforeAll
        void build() {
            words = new WordContainer(Generator.generateWords(2024, 150000));
            List<String> all = listed(words);
            // A grid-fill pass: slots with crossing letters known, plus solver-panel searches.
            batch = new ArrayList<>();
            for (String pattern : Generator.slotPatterns(all, 77, 400)) batch.add(new Query(pattern, null));
            for (String pattern : Generator.searchPatterns(all, 78, 100)) batch.add(new Query(pattern, 20));
            // A different pass of the same shape, run first so JIT compilation isn't timed.
            warmUp = new ArrayList<>();
            for (String pattern : Generator.slotPatterns(all, 81, 20)) warmUp.add(new Query(pattern, null));
            for (String pattern : Generator.searchPatterns(all, 82, 10)) warmUp.add(new Query(pattern, 20));
        }

        @Test
        void largeDictionarySpotChecks() {
            assertEquals(130128, words.size());
            assertEquals(List.of("thaun", "thean", "theen", "thien", "thoan", "thoon"), words.match("th??n"));
            List<String> found = words.match("b?ea?");
            assertEquals(13, found.size());
            assertEquals(List.of("beeai", "biead", "bieai", "bieas"), found.subList(0, 4));
            assertEquals(List.of("breat", "breay"), found.subList(found.size() - 2, found.size()));
            assertEquals(List.of("dran", "dranaas", "dranboobougy", "drancested"), words.match("dr?n*", 4));
        }

        @Test
        void gridFillBatchIsFast() {
            for (Query query : warmUp) words.match(query.pattern(), query.limit());
            long found = 0;
            long letters = 0;
            long start = System.nanoTime();
            for (int done = 1; done <= batch.size(); done++) {
                Query query = batch.get(done - 1);
                List<String> result = words.match(query.pattern(), query.limit());
                found += result.size();
                for (String word : result) letters += word.length();
                long elapsed = (System.nanoTime() - start) / 1_000_000;
                if (elapsed > BATCH_MS) {
                    fail("only " + done + " of " + batch.size() + " queries finished in " + elapsed
                            + "ms; the whole batch must finish in under " + BATCH_MS + "ms");
                }
            }
            assertEquals(List.of(5766L, 41753L), List.of(found, letters), "batch returned the wrong words");
        }
    }
}
