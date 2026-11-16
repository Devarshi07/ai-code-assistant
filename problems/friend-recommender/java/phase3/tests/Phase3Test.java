package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import campfire.Recommender;
import campfire.SocialGraph;
import campfire.Suggestion;
import campfire.User;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class Phase3Test {
    // Ana and Bea both know an organiser with 40 friends. Bea also knows c07 and
    // c21, and only c30 shares one of Ana's interests. The organiser's friends are
    // added in reverse id order.
    private static final List<String> ORGANISER_FRIENDS =
            IntStream.range(0, 40).mapToObj(i -> "c%02d".formatted(39 - i)).toList();

    private static final double LARGE_LIMIT_MS = 800; // for the whole batch
    private static final List<String> LARGE_ORGANISERS = List.of("m11298", "m21194", "m02945"); // the members with the most friends
    private static final long EXPECTED_FINGERPRINT = 553887438L;

    private static SocialGraph club;
    private static SocialGraph large;

    private static SocialGraph organiserNetwork(List<List<String>> blocks, List<String> inactive) {
        SocialGraph graph = new SocialGraph();
        Map<String, List<String>> members = new LinkedHashMap<>();
        members.put("ana", List.of("jazz", "film"));
        members.put("bea", List.of("film"));
        members.put("hub", List.of("chess"));
        for (String c : ORGANISER_FRIENDS) members.put(c, c.equals("c30") ? List.of("jazz") : List.of());
        members.forEach((id, interests) ->
                graph.addUser(new User(id, Character.toUpperCase(id.charAt(0)) + id.substring(1), LocalDate.of(2022, 9, 1), interests)));
        graph.addFriendship("ana", "hub");
        graph.addFriendship("ana", "bea");
        graph.addFriendship("bea", "hub");
        for (String c : ORGANISER_FRIENDS) graph.addFriendship("hub", c);
        graph.addFriendship("bea", "c21");
        graph.addFriendship("bea", "c07");
        for (List<String> pair : blocks) graph.block(pair.get(0), pair.get(1));
        for (String id : inactive) graph.deactivate(id);
        return graph;
    }

    private static SocialGraph clubNetwork() {
        if (club == null) club = NetworkGenerator.buildNetwork(5, 3000, /* organisers */ 2, /* reach */ 150, /* blocks */ 200, /* inactive */ 60);
        return club;
    }

    private static SocialGraph largeNetwork() {
        if (large == null) {
            large = NetworkGenerator.buildNetwork(11, 30000, /* organisers */ 6, /* reach */ 600, /* blocks */ 300, /* inactive */ 600);
            System.gc(); // collect the build's garbage now, not during the timed batch
        }
        return large;
    }

    private static Suggestion s(String userId, int mutual, int shared) {
        return new Suggestion(userId, mutual, shared);
    }

    /** One query of the batch and its suggestions. */
    private record Result(String userId, List<Suggestion> suggestions) {}

    /** 32-bit FNV-1a hash of every query's suggestions, in order. */
    private static long fingerprint(List<Result> results) {
        String text = results.stream()
                .map(r -> r.userId() + ">" + r.suggestions().stream()
                        .map(s -> s.userId() + ":" + s.mutual() + ":" + s.shared()).collect(Collectors.joining(",")))
                .collect(Collectors.joining("|"));
        int value = 0x811C9DC5; // 2166136261
        for (int i = 0; i < text.length(); i++) value = (value ^ text.charAt(i)) * 16777619;
        return Integer.toUnsignedLong(value);
    }

    /** Every suggestion obeys the rules, and the list is in ranking order. */
    private static void assertValid(SocialGraph graph, String userId, List<Suggestion> suggestions, int k) {
        User me = graph.user(userId);
        assertTrue(suggestions.size() <= k);
        assertEquals(suggestions.size(), suggestions.stream().map(Suggestion::userId).distinct().count(), "duplicate suggestion");
        for (Suggestion s : suggestions) {
            User other = graph.user(s.userId());
            assertNotEquals(userId, s.userId());
            assertFalse(graph.friendsOf(userId).contains(s.userId()), s.userId() + " is already a friend of " + userId);
            assertTrue(other.isActive(), s.userId() + " is deactivated");
            assertFalse(graph.blockedEither(userId, s.userId()), s.userId() + " and " + userId + " are blocked");
            long mutual = graph.friendsOf(userId).stream()
                    .filter(f -> graph.user(f).isActive() && graph.friendsOf(f).contains(s.userId())).count();
            assertEquals(mutual, s.mutual(), "mutual count for " + s.userId());
            assertTrue(s.mutual() > 0);
            long shared = me.interests().stream().filter(other.interests()::contains).count();
            assertEquals(shared, s.shared(), "shared interests for " + s.userId());
        }
        for (int i = 1; i < suggestions.size(); i++) {
            Suggestion a = suggestions.get(i - 1);
            Suggestion b = suggestions.get(i);
            boolean inOrder = a.mutual() > b.mutual() || (a.mutual() == b.mutual()
                    && (a.shared() > b.shared() || (a.shared() == b.shared() && a.userId().compareTo(b.userId()) < 0)));
            assertTrue(inOrder, a.userId() + " must not be ranked above " + b.userId());
        }
    }

    @Test
    void organiserTiesBreakOnInterestsThenId() {
        SocialGraph graph = organiserNetwork(List.of(), List.of());
        assertEquals(List.of(s("c07", 2, 0), s("c21", 2, 0), s("c30", 1, 1), s("c00", 1, 0)), Recommender.recommend(graph, "ana", 4));
        assertEquals(List.of(s("c00", 1, 0), s("c01", 1, 0), s("c02", 1, 0)), Recommender.recommend(graph, "bea", 3));
        List<Suggestion> everyone = Recommender.recommend(graph, "ana", 100);
        assertEquals(40, everyone.size());
        assertValid(graph, "ana", everyone, 100);
    }

    @Test
    void exclusionsStillApply() {
        SocialGraph graph = organiserNetwork(List.of(List.of("ana", "c01")), List.of("c00"));
        assertEquals(List.of(s("c07", 2, 0), s("c21", 2, 0), s("c30", 1, 1), s("c02", 1, 0)), Recommender.recommend(graph, "ana", 4));
        SocialGraph quiet = organiserNetwork(List.of(), List.of("hub"));
        assertEquals(List.of(s("c07", 1, 0), s("c21", 1, 0)), Recommender.recommend(quiet, "ana", 4));
        assertEquals(List.of(), Recommender.recommend(quiet, "ana", 0));
    }

    @Test
    void generatedClubNetwork() {
        SocialGraph graph = clubNetwork();
        Map<String, List<Suggestion>> expected = new LinkedHashMap<>();
        expected.put("m00004", List.of(s("m00039", 4, 0), s("m00001", 3, 2), s("m00040", 3, 1), s("m00014", 3, 0), s("m00026", 3, 0)));
        expected.put("m00006", List.of(s("m00044", 5, 0), s("m00002", 4, 1), s("m00000", 4, 0), s("m00011", 4, 0), s("m00007", 3, 2)));
        expected.put("m00146", List.of(s("m00108", 4, 0), s("m00118", 3, 0), s("m00138", 3, 0), s("m00128", 2, 2), s("m00107", 2, 1)));
        expected.put("m01230", List.of(s("m01232", 6, 0), s("m01242", 4, 1), s("m01214", 4, 0), s("m01202", 3, 1), s("m01227", 3, 0)));
        expected.put("m01945", List.of(s("m00984", 7, 1), s("m01943", 7, 0), s("m01912", 5, 1), s("m01736", 5, 0), s("m01738", 5, 0)));
        expected.put("m02718", List.of(s("m02722", 4, 1), s("m02709", 4, 0), s("m02725", 4, 0), s("m02744", 4, 0), s("m02707", 3, 1)));
        expected.forEach((userId, want) -> assertEquals(want, Recommender.recommend(graph, userId, 5), "suggestions for " + userId));
    }

    @Test
    void generatedNetworkFollowsTheRules() {
        SocialGraph graph = clubNetwork();
        for (int index = 0; index < 3000; index += 97) {
            String userId = NetworkGenerator.memberId(index);
            assertValid(graph, userId, Recommender.recommend(graph, userId, 8), 8);
        }
    }

    @Test
    void largeNetworkBatchIsFast() {
        SocialGraph graph = largeNetwork();
        List<String> queries = new ArrayList<>();
        for (int index = 0; index < 30000; index += 75) queries.add(NetworkGenerator.memberId(index));
        queries.addAll(LARGE_ORGANISERS);
        // Warm up the JIT on 400 other members first (for at most 0.3 s), so compilation isn't timed.
        long warmUntil = System.nanoTime() + 300_000_000L;
        for (int index = 37; index < 30000 && System.nanoTime() < warmUntil; index += 75) {
            Recommender.recommend(graph, NetworkGenerator.memberId(index), 10);
        }

        long start = System.nanoTime();
        List<Result> results = new ArrayList<>();
        for (String userId : queries) results.add(new Result(userId, Recommender.recommend(graph, userId, 10)));
        double elapsedMs = (System.nanoTime() - start) / 1e6;

        assertEquals(4030, results.stream().mapToInt(r -> r.suggestions().size()).sum());
        assertEquals(List.of(s("m00033", 5, 0), s("m00015", 4, 1), s("m00039", 4, 1)), results.get(0).suggestions().stream().limit(3).toList());
        for (int i = 0; i < results.size(); i++) {
            if (i % 10 == 0 || i >= results.size() - 3) assertValid(graph, results.get(i).userId(), results.get(i).suggestions(), 10);
        }
        assertEquals(EXPECTED_FINGERPRINT, fingerprint(results), "batch results differ from the reference");
        assertTrue(elapsedMs < LARGE_LIMIT_MS, "%d recommend calls took %.0fms; they must finish in under %.0fms"
                .formatted(queries.size(), elapsedMs, LARGE_LIMIT_MS));
    }
}
