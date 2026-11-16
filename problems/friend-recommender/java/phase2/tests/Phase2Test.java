package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import campfire.GraphException;
import campfire.Loader;
import campfire.Recommender;
import campfire.SocialGraph;
import campfire.Suggestion;
import campfire.User;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class Phase2Test {
    // A reading club. Ana is friends with Ben, Cai and Dev; Ben and Cai are also
    // friends with each other. Members are added out of alphabetical order on purpose.
    // Each row is a member id followed by that member's interests.
    private static final String[][] CLUB_MEMBERS = {
        {"ana", "jazz", "film", "chess"},
        {"ben", "film"},
        {"cai", "jazz"},
        {"dev", "poetry"},
        {"ida", "chess"},
        {"eve"},
        {"kim", "film", "chess"},
        {"gus", "jazz", "film"},
        {"fay", "jazz"},
        {"hal", "chess"},
        {"jon", "jazz", "film", "chess"},
        {"zed", "jazz"},
    };
    private static final String[][] CLUB_FRIENDSHIPS = {
        {"ana", "ben"}, {"ana", "cai"}, {"ana", "dev"}, {"ben", "cai"},
        {"eve", "ben"}, {"eve", "cai"}, {"eve", "dev"},
        {"fay", "ben"}, {"fay", "cai"},
        {"gus", "ben"}, {"gus", "dev"},
        {"hal", "cai"}, {"kim", "cai"}, {"ida", "dev"},
        {"jon", "eve"},
    };

    private static SocialGraph club() {
        return club(List.of(), List.of());
    }

    /** The club, after the given [blocker, blocked] pairs and deactivations. */
    private static SocialGraph club(List<List<String>> blocks, List<String> inactive) {
        SocialGraph graph = new SocialGraph();
        for (String[] row : CLUB_MEMBERS) {
            String id = row[0];
            List<String> interests = List.of(row).subList(1, row.length);
            graph.addUser(new User(id, Character.toUpperCase(id.charAt(0)) + id.substring(1), LocalDate.of(2023, 3, 1), interests));
        }
        for (String[] pair : CLUB_FRIENDSHIPS) graph.addFriendship(pair[0], pair[1]);
        for (List<String> pair : blocks) graph.block(pair.get(0), pair.get(1));
        for (String id : inactive) graph.deactivate(id);
        return graph;
    }

    private static Suggestion s(String userId, int mutual, int shared) {
        return new Suggestion(userId, mutual, shared);
    }

    private static List<String> ids(List<Suggestion> suggestions) {
        return suggestions.stream().map(Suggestion::userId).toList();
    }

    /** Every suggestion obeys the rules, and the list is in ranking order. */
    private static void assertValid(SocialGraph graph, String userId, List<Suggestion> suggestions, int k) {
        User me = graph.user(userId);
        assertNotNull(suggestions, "recommend must return a list");
        assertTrue(suggestions.size() <= Math.max(k, 0));
        assertEquals(suggestions.size(), ids(suggestions).stream().distinct().count(), "duplicate suggestion");
        for (Suggestion s : suggestions) {
            User other = graph.user(s.userId());
            assertNotEquals(userId, s.userId(), "never suggest members to themselves");
            assertFalse(graph.friendsOf(userId).contains(s.userId()), s.userId() + " is already a friend");
            assertTrue(other.isActive(), s.userId() + " is deactivated");
            assertFalse(graph.hasBlocked(userId, s.userId()) || graph.hasBlocked(s.userId(), userId),
                    s.userId() + " and " + userId + " are blocked");
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

    // -- recommend -------------------------------------------------------------

    @Test
    void ranksFriendsOfFriendsByMutualFriends() {
        SocialGraph graph = club();
        List<Suggestion> got = Recommender.recommend(graph, "ana", 10);
        assertEquals(List.of("eve", "gus", "fay"), ids(got).stream().limit(3).toList());
        assertEquals(new Suggestion("eve", 3, 0), got.get(0));
        assertValid(graph, "ana", got, 10);
    }

    @Test
    void tiesBreakOnSharedInterestsThenId() {
        assertEquals(List.of(
                s("eve", 3, 0), s("gus", 2, 2), s("fay", 2, 1),
                s("kim", 1, 2), s("hal", 1, 1), s("ida", 1, 1)), Recommender.recommend(club(), "ana", 10));
    }

    @Test
    void kLimitsTheList() {
        SocialGraph graph = club();
        assertEquals(List.of(s("eve", 3, 0), s("gus", 2, 2)), Recommender.recommend(graph, "ana", 2));
        assertEquals(List.of(), Recommender.recommend(graph, "ana", 0));
        assertEquals(6, Recommender.recommend(graph, "ana", 50).size());
        assertEquals(5, Recommender.recommend(graph, "ana").size(), "k defaults to 5");
    }

    @Test
    void selfAndExistingFriendsAreNeverSuggested() {
        SocialGraph graph = club();
        List<Suggestion> got = Recommender.recommend(graph, "ben", 10);
        assertEquals(List.of(s("dev", 3, 0), s("jon", 1, 1), s("kim", 1, 1), s("hal", 1, 0)), got);
        assertValid(graph, "ben", got, 10);
    }

    @Test
    void membersWithoutMutualFriendsAreNotSuggested() {
        SocialGraph graph = club();
        assertFalse(ids(Recommender.recommend(graph, "ana", 50)).contains("jon"));
        assertEquals(List.of(), Recommender.recommend(graph, "zed", 5), "zed has no friends yet");
    }

    @Test
    void blocksHideMembersInBothDirections() {
        SocialGraph graph = club(List.of(List.of("ana", "gus"), List.of("fay", "ana")), List.of());
        assertEquals(List.of(s("eve", 3, 0), s("kim", 1, 2), s("hal", 1, 1), s("ida", 1, 1)), Recommender.recommend(graph, "ana", 10));
        assertFalse(ids(Recommender.recommend(graph, "fay", 10)).contains("ana"));
        assertFalse(ids(Recommender.recommend(graph, "gus", 10)).contains("ana"));
    }

    @Test
    void deactivatedMembersAreNotSuggestedOrCounted() {
        SocialGraph graph = club(List.of(), List.of("eve", "dev"));
        List<Suggestion> got = Recommender.recommend(graph, "ana", 10);
        assertEquals(List.of(s("fay", 2, 1), s("gus", 1, 2), s("kim", 1, 2), s("hal", 1, 1)), got);
        assertValid(graph, "ana", got, 10);
    }

    @Test
    void unknownMemberThrows() {
        SocialGraph graph = club();
        assertThrows(GraphException.class, () -> Recommender.recommend(graph, "nobody", 3));
    }

    @Test
    void recommendDoesNotChangeTheGraph() {
        SocialGraph graph = club(List.of(List.of("fay", "ana")), List.of("dev"));
        Supplier<List<String>> snapshot = () -> graph.users().stream()
                .map(u -> u.id() + " " + String.join(",", graph.friendsOf(u.id()).stream().sorted().toList()) + " " + u.isActive())
                .toList();
        List<String> before = snapshot.get();
        for (User user : graph.users()) Recommender.recommend(graph, user.id(), 3);
        assertEquals(before, snapshot.get());
        assertTrue(graph.hasBlocked("fay", "ana"));
    }

    // -- sample network --------------------------------------------------------

    @Test
    void sampleSuggestions() throws IOException {
        SocialGraph graph = Loader.loadSample();
        assertEquals(List.of(s("judy", 3, 2), s("olivia", 2, 2), s("trent", 1, 2)), Recommender.recommend(graph, "alice", 3));
        assertEquals(List.of(
                s("alice", 2, 2), s("carol", 2, 1), s("judy", 2, 1), s("victor", 2, 1), s("bob", 1, 1), s("ivan", 1, 1)),
                Recommender.recommend(graph, "olivia", 10));
    }

    @Test
    void sampleRespectsDeactivatedAccounts() throws IOException {
        SocialGraph graph = Loader.loadSample();
        assertEquals(List.of(s("erin", 1, 1), s("sybil", 1, 1), s("heidi", 1, 0), s("mallory", 1, 0)), Recommender.recommend(graph, "dave", 10));
        assertEquals(List.of(s("bob", 1, 2), s("ivan", 1, 1)), Recommender.recommend(graph, "niaj", 10));
        assertEquals(List.of(), Recommender.recommend(graph, "peggy", 10));
    }

    @Test
    void everySampleListFollowsTheRules() throws IOException {
        SocialGraph graph = Loader.loadSample();
        for (User user : graph.users()) assertValid(graph, user.id(), Recommender.recommend(graph, user.id(), 4), 4);
    }
}
