package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import spellcheck.Dictionary;
import spellcheck.Suggester;

class Phase3Test {
    static final int SIZE = 20_000; // entries in the full dictionary
    static final int BATCH = 1_000; // right-click lookups in the timed test
    static final long LIMIT_MS = 1_000; // allowed for the whole batch
    static final int WARM_UP = 2_000; // untimed lookups first, so the JIT has compiled the lookup code

    static Dictionary dictionary;
    static Suggester suggester;

    /** The large dictionary and one Suggester over it, built once per run. */
    @BeforeAll
    static void setUp() {
        dictionary = Corpus.largeDictionary(SIZE);
        suggester = new Suggester(dictionary);
        // Warm the JVM up on a different batch (and let lazy indexes finish
        // building); a slow solution stops warming up after a second.
        long until = System.nanoTime() + 1_000_000_000L;
        for (String word : Corpus.typoBatch(dictionary, WARM_UP, 99)) {
            suggester.suggest(word);
            if (System.nanoTime() > until) {
                break;
            }
        }
    }

    static double millisSince(long start) {
        return (System.nanoTime() - start) / 1e6;
    }

    @Test
    void dictionarySize() {
        assertEquals(SIZE, dictionary.size());
    }

    @Test
    void typosOfRealWords() {
        assertEquals(List.of("relieve", "receive", "believe"), suggester.suggest("recieve"));
        assertEquals(List.of("tea", "tel", "te", "ted", "tee", "tech", "ten", "the"), suggester.suggest("teh", 8));
        assertEquals(List.of("unfortunately"), suggester.suggest("unfortunatelly"));
    }

    @Test
    void apostrophesAndAccents() {
        assertEquals(List.of("don't", "done", "don", "dout", "dond", "dong", "dot"), suggester.suggest("dont", 7));
        assertEquals(List.of("came", "pafe", "ceafe", "cale", "eafe", "café"), suggester.suggest("cafe", 6));
    }

    @Test
    void veryShortWords() {
        assertEquals(List.of("e", "be", "a", "i", "he", "we", "me", "pe", "em", "je", "fe", "ne"), suggester.suggest("e", 12));
        assertEquals(List.of("a", "as", "at", "an", "ad", "ar", "am", "al", "ai", "be", "to", "of"), suggester.suggest("ab", 12));
    }

    @Test
    void generatedWords() {
        assertEquals(List.of("siling", "kiling", "miling", "riling", "tiling", "iling", "liling", "niling",
                "saling", "griling", "soing", "sudiling"), suggester.suggest("siling", 12));
        assertEquals(List.of("leck", "neck", "weck", "lecks", "deck", "peck", "beck", "leeck", "cleck",
                "jeck", "seck", "fleck"), suggester.suggest("leck", 12));
        assertEquals(List.of("tond", "thad", "thand", "tand", "tynd", "thond", "thind", "thed", "tind",
                "the", "and", "that"), suggester.suggest("thnd", 12));
        assertEquals(List.of("tad", "had", "bad", "lad", "thad", "zad", "ad", "tas", "tand", "dad", "tat", "tal"),
                suggester.suggest("tad", 12));
    }

    @Test
    void longAndUnmatchedWords() {
        assertEquals(List.of("plumtobued"), suggester.suggest("plumtobued"));
        assertEquals(List.of(), suggester.suggest("xqzvbnm"));
    }

    @Test
    void batchOfLookupsIsFast() {
        List<String> batch = Corpus.typoBatch(dictionary, BATCH);
        List<List<String>> results = new ArrayList<>();
        long start = System.nanoTime();
        for (String word : batch) {
            results.add(suggester.suggest(word));
            if (millisSince(start) > 3 * LIMIT_MS) {
                break; // far too slow already; stop early
            }
        }
        double elapsed = millisSince(start);
        assertEquals(BATCH, results.size(), () -> String.format(
                "only %d of %d lookups finished in %.0fms; all %d must finish in under %dms",
                results.size(), BATCH, elapsed, BATCH, LIMIT_MS));
        assertEquals(List.of("view", "voai", "vis", "vist", "viga"), results.get(0));
        assertEquals(List.of("zond", "foud", "zou", "loud", "noud"), results.get(2));
        assertEquals(List.of(), results.get(49));
        assertEquals(List.of("valing", "vanding", "tanging", "vatreing", "nanging"), results.get(500));
        assertEquals(List.of("lon", "lose", "lost", "los", "on"), results.get(999));
        assertEquals(2306, results.stream().mapToInt(List::size).sum(), "total suggestions across the batch");
        assertTrue(elapsed < LIMIT_MS, () -> String.format(
                "%d lookups took %.0fms; they must finish in under %dms", BATCH, elapsed, LIMIT_MS));
    }
}
