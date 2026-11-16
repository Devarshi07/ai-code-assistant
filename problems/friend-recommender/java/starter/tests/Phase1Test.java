package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import campfire.GraphException;
import campfire.LoadException;
import campfire.Loader;
import campfire.Report;
import campfire.SocialGraph;
import campfire.User;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class Phase1Test {
    private static SocialGraph makeGraph(String... ids) {
        SocialGraph graph = new SocialGraph();
        for (String id : ids) {
            graph.addUser(new User(id, Character.toUpperCase(id.charAt(0)) + id.substring(1), LocalDate.of(2022, 5, 1)));
        }
        return graph;
    }

    private static List<String> friends(SocialGraph graph, String id) {
        return graph.friendsOf(id).stream().sorted().toList();
    }

    // -- friendships -----------------------------------------------------------

    @Test
    void friendshipIsMutual() {
        SocialGraph graph = makeGraph("alice", "bob");
        assertTrue(graph.addFriendship("alice", "bob"));
        assertEquals(List.of("bob"), friends(graph, "alice"));
        assertEquals(List.of("alice"), friends(graph, "bob"));
        assertTrue(graph.areFriends("bob", "alice"));
    }

    @Test
    void addingAFriendshipTwiceIsHarmless() {
        SocialGraph graph = makeGraph("alice", "bob");
        graph.addFriendship("alice", "bob");
        assertFalse(graph.addFriendship("bob", "alice"));
        assertEquals(1, graph.friendCount("alice"));
        assertEquals(1, graph.friendshipCount());
    }

    @Test
    void membersCannotBefriendThemselves() {
        SocialGraph graph = makeGraph("alice");
        assertThrows(GraphException.class, () -> graph.addFriendship("alice", "alice"));
    }

    @Test
    void unfriendingClearsBothFriendLists() {
        SocialGraph graph = makeGraph("alice", "bob", "carol");
        graph.addFriendship("alice", "bob");
        graph.addFriendship("alice", "carol");
        assertTrue(graph.removeFriendship("bob", "alice"));
        assertEquals(List.of(), friends(graph, "bob"));
        assertEquals(List.of("carol"), friends(graph, "alice"), "Bob unfriended Alice, so he must leave her list too");
        assertFalse(graph.areFriends("alice", "bob"));
    }

    @Test
    void friendingAgainAfterAnUnfriend() {
        SocialGraph graph = makeGraph("alice", "bob");
        graph.addFriendship("alice", "bob");
        graph.removeFriendship("bob", "alice");
        assertTrue(graph.addFriendship("alice", "bob"), "they were no longer friends");
        assertEquals(List.of("bob"), friends(graph, "alice"));
        assertEquals(List.of("alice"), friends(graph, "bob"));
    }

    @Test
    void mutualFriendsSkipEndedFriendships() {
        SocialGraph graph = makeGraph("alice", "bob", "carol", "erin");
        for (String[] pair : new String[][] {{"alice", "bob"}, {"alice", "carol"}, {"erin", "bob"}, {"erin", "carol"}}) {
            graph.addFriendship(pair[0], pair[1]);
        }
        assertEquals(List.of("bob", "carol"), graph.mutualFriends("erin", "alice"));
        graph.removeFriendship("bob", "alice");
        assertEquals(List.of("carol"), graph.mutualFriends("erin", "alice"));
        assertEquals(List.of("carol"), graph.mutualFriends("alice", "erin"));
    }

    // -- blocks ----------------------------------------------------------------

    @Test
    void blocksAreOneDirectional() {
        SocialGraph graph = makeGraph("carol", "dave");
        graph.block("carol", "dave");
        assertTrue(graph.hasBlocked("carol", "dave"));
        assertFalse(graph.hasBlocked("dave", "carol"));
        assertTrue(graph.blockedEither("dave", "carol"));
    }

    @Test
    void blockedMembersCannotBecomeFriends() {
        SocialGraph graph = makeGraph("carol", "dave");
        graph.block("dave", "carol");
        assertThrows(GraphException.class, () -> graph.addFriendship("carol", "dave"));
    }

    @Test
    void blockingAFriendEndsTheFriendshipForBoth() {
        SocialGraph graph = makeGraph("judy", "peggy", "rupert");
        graph.addFriendship("judy", "peggy");
        graph.addFriendship("peggy", "rupert");
        graph.block("judy", "peggy");
        assertEquals(List.of(), friends(graph, "judy"));
        assertEquals(List.of("rupert"), friends(graph, "peggy"), "Judy blocked Peggy, so she must leave Peggy's list");
    }

    @Test
    void unblockingDoesNotRestoreTheFriendship() {
        SocialGraph graph = makeGraph("frank", "heidi");
        graph.addFriendship("frank", "heidi");
        graph.block("heidi", "frank");
        graph.unblock("heidi", "frank");
        assertFalse(graph.blockedEither("frank", "heidi"));
        assertFalse(graph.areFriends("frank", "heidi"));
        assertFalse(graph.areFriends("heidi", "frank"));
    }

    // -- loader ----------------------------------------------------------------

    @Test
    void membersCsvReadsNamesDatesAndInterests() {
        SocialGraph graph = Loader.loadMembersCsv("id,name,joined,interests\n"
                + "dana,\"Dana Park, PhD\",2021-11-30,Board Games; jazz\n"
                + "eli,Eli Stone,2022-01-02,\n");
        User dana = graph.user("dana");
        assertEquals("Dana Park, PhD", dana.name());
        assertEquals(LocalDate.of(2021, 11, 30), dana.joined());
        assertEquals(Set.of("board-games", "jazz"), dana.interests());
        assertEquals(Set.of(), graph.user("eli").interests());
    }

    @Test
    void activityErrorsNameTheLine() {
        SocialGraph graph = makeGraph("alice", "bob");
        LoadException error = assertThrows(LoadException.class,
                () -> Loader.applyActivity(graph, "# header\nfriend alice bob\n\nfriend alice zoe\n"));
        assertTrue(error.getMessage().contains("line 4"), error.getMessage());
    }

    @Test
    void sampleFriendLists() throws IOException {
        SocialGraph graph = Loader.loadSample();
        assertEquals("Bob Okafor (@bob) has 3 friends: Dave Ferreira, Erin Walsh, Ivan Petrov", Report.friendList(graph, "bob"));
        assertEquals("Alice Moreno (@alice) has 3 friends: Carol Lindqvist, Erin Walsh, Grace Kim", Report.friendList(graph, "alice"));
        assertEquals("Peggy Sousa (@peggy) has 1 friend: Rupert Hale", Report.friendList(graph, "peggy"));
        assertEquals("Frank Osei (@frank) has 2 friends: Carol Lindqvist, Mallory Quinn", Report.friendList(graph, "frank"));
    }

    @Test
    void sampleFriendListsAgreeBothWays() throws IOException {
        SocialGraph graph = Loader.loadSample();
        for (User user : graph.users()) {
            for (String friend : graph.friendsOf(user.id())) {
                assertTrue(graph.areFriends(friend, user.id()),
                        user.id() + " lists " + friend + " as a friend, but " + friend + " does not list " + user.id());
            }
        }
    }

    @Test
    void sampleSummaryAndProfile() throws IOException {
        SocialGraph graph = Loader.loadSample();
        assertEquals("18 members (1 deactivated), 28 friendships, 2 blocks", Report.networkSummary(graph));
        String card = Report.profileCard(graph, "erin", "alice");
        assertTrue(card.contains("  3 friends"), card);
        assertTrue(card.contains("2 mutual friends with Erin: Carol, Grace"), card);
    }
}
