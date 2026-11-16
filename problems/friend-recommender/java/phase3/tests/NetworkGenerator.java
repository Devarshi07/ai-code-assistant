package tests;

import campfire.SocialGraph;
import campfire.User;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Seeded generator for large Campfire-like networks.
 *
 * <p>Members belong to clubs of {@code CLUB_SIZE} consecutive ids and make most of
 * their friends inside their club, so friends of friends overlap the way they do
 * in real communities. A few organisers have hundreds of friends across the whole
 * network. The generator uses a Park-Miller random number generator so the copies
 * of this file in the other languages build exactly the same network.
 */
final class NetworkGenerator {
    private static final List<String> TAGS = List.of("climbing", "jazz", "film", "cooking", "cycling", "photography",
            "board-games", "running", "chess", "gardening", "poetry", "baking", "hiking", "anime", "knitting",
            "surfing", "podcasts", "yoga", "sci-fi", "vinyl", "pottery", "birding", "coding", "dance");
    private static final int FRIEND_PICKS = 7; // friend picks per member
    private static final int CLUB_SIZE = 50;   // members per club
    private static final int LOCAL_PCT = 85;   // percent of picks made inside the member's club

    private NetworkGenerator() {}

    /** Park-Miller "minimal standard" random numbers. */
    private static final class Rng {
        private long state;

        Rng(long seed) {
            state = seed % 2147483647L;
            if (state == 0) state = 1;
        }

        /** A pseudo-random integer in [0, n). */
        int below(int n) {
            state = state * 48271 % 2147483647L; // exact: the product stays below 2^63
            return (int) (state % n);
        }
    }

    /** 12 -> "m00012". */
    static String memberId(int index) {
        String digits = Integer.toString(index);
        return "m" + "0".repeat(Math.max(0, 5 - digits.length())) + digits;
    }

    /**
     * A network of size members.
     *
     * @param organisers members who befriend people all over the network
     * @param reach friend picks per organiser
     * @param blocks block attempts between friends of friends
     * @param inactive deactivation picks
     */
    static SocialGraph buildNetwork(int seed, int size, int organisers, int reach, int blocks, int inactive) {
        Rng rng = new Rng(seed);
        SocialGraph graph = new SocialGraph();
        for (int i = 0; i < size; i++) {
            List<String> tags = new ArrayList<>();
            for (int t = 0; t < 3; t++) tags.add(TAGS.get(rng.below(TAGS.size())));
            graph.addUser(new User(memberId(i), "Member " + i, LocalDate.of(2021, 1, 1), tags));
        }

        List<List<Integer>> links = new ArrayList<>();
        for (int i = 0; i < size; i++) links.add(new ArrayList<>());

        for (int i = 0; i < size; i++) {
            int start = i - i % CLUB_SIZE;
            int span = Math.min(CLUB_SIZE, size - start);
            for (int f = 0; f < FRIEND_PICKS; f++) {
                if (rng.below(100) < LOCAL_PCT) link(graph, links, i, start + rng.below(span));
                else link(graph, links, i, rng.below(size));
            }
        }
        for (int h = 0; h < organisers; h++) {
            int hub = rng.below(size);
            for (int r = 0; r < reach; r++) link(graph, links, hub, rng.below(size));
        }
        for (int b = 0; b < blocks; b++) {
            int a = rng.below(size);
            if (links.get(a).isEmpty()) continue;
            int via = links.get(a).get(rng.below(links.get(a).size()));
            int c = links.get(via).get(rng.below(links.get(via).size()));
            if (c != a) {
                if (rng.below(2) == 1) graph.block(memberId(a), memberId(c));
                else graph.block(memberId(c), memberId(a));
            }
        }
        for (int d = 0; d < inactive; d++) graph.deactivate(memberId(rng.below(size)));
        return graph;
    }

    private static void link(SocialGraph graph, List<List<Integer>> links, int a, int b) {
        if (a != b && graph.addFriendship(memberId(a), memberId(b))) {
            links.get(a).add(b);
            links.get(b).add(a);
        }
    }
}
