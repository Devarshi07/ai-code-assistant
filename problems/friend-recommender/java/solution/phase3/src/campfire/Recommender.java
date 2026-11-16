package campfire;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;

/**
 * "People you may know": friend suggestions for a member.
 *
 * <p>Suggestions are friends of friends. A member is never suggested to
 * themselves, to their existing friends, to anyone they have blocked or been
 * blocked by, or at all once their account is deactivated.
 */
public final class Recommender {
    /** How many suggestions the panel asks for by default. */
    public static final int DEFAULT_K = 5;

    /** More mutual friends first, then more shared interests, then id ascending. */
    private static final Comparator<Suggestion> RANKING = Comparator.comparingInt(Suggestion::mutual).reversed()
            .thenComparing(Comparator.comparingInt(Suggestion::shared).reversed())
            .thenComparing(Suggestion::userId);

    private Recommender() {}

    /** Number of interests members a and b have in common. */
    public static int sharedInterests(SocialGraph graph, String a, String b) {
        Set<String> theirs = graph.user(b).interests();
        int count = 0;
        for (String tag : graph.user(a).interests()) {
            if (theirs.contains(tag)) count++;
        }
        return count;
    }

    /** Up to {@link #DEFAULT_K} friend suggestions for userId, best first. */
    public static List<Suggestion> recommend(SocialGraph graph, String userId) {
        return recommend(graph, userId, DEFAULT_K);
    }

    /**
     * Up to k friend suggestions for userId, best first.
     * Ranked by mutual friends, then shared interests, then member id.
     *
     * <p>Only friends of friends can have a mutual friend, so instead of checking
     * every member we walk two hops out from userId. The number of times a member
     * is reached through an active friend is exactly their mutual count. A heap
     * of size k keeps the best candidates instead of sorting all of them.
     * Cost per call: O(sum of the friends' friend counts + C log k).
     */
    public static List<Suggestion> recommend(SocialGraph graph, String userId, int k) {
        graph.user(userId); // unknown members throw GraphException
        if (k <= 0) return List.of();
        Set<String> myFriends = graph.friendsOf(userId);
        Map<String, Integer> reached = new HashMap<>();
        for (String friend : myFriends) {
            if (!graph.user(friend).isActive()) continue;
            for (String candidate : graph.friendsOf(friend)) reached.merge(candidate, 1, Integer::sum);
        }

        PriorityQueue<Suggestion> best = new PriorityQueue<>(RANKING.reversed()); // the weakest of the best k on top
        for (Map.Entry<String, Integer> entry : reached.entrySet()) {
            String candidate = entry.getKey();
            if (candidate.equals(userId) || myFriends.contains(candidate)) continue;
            if (!graph.user(candidate).isActive() || graph.blockedEither(userId, candidate)) continue;
            Suggestion suggestion = new Suggestion(candidate, entry.getValue(), sharedInterests(graph, userId, candidate));
            if (best.size() < k) {
                best.add(suggestion);
            } else if (RANKING.compare(suggestion, best.peek()) < 0) {
                best.poll();
                best.add(suggestion);
            }
        }
        List<Suggestion> top = new ArrayList<>(best);
        top.sort(RANKING);
        return top;
    }
}
