package campfire;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
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
     * Checks every member of the network: O(V * d) per call.
     */
    public static List<Suggestion> recommend(SocialGraph graph, String userId, int k) {
        graph.user(userId); // unknown members throw GraphException
        if (k <= 0) return List.of();
        Set<String> myFriends = graph.friendsOf(userId);
        List<String> activeFriends = myFriends.stream().filter(id -> graph.user(id).isActive()).toList();
        List<Suggestion> suggestions = new ArrayList<>();
        for (User other : graph.users()) {
            String candidate = other.id();
            if (candidate.equals(userId) || myFriends.contains(candidate) || !other.isActive()) continue;
            if (graph.blockedEither(userId, candidate)) continue;
            Set<String> theirs = graph.friendsOf(candidate);
            int mutual = 0;
            for (String friend : activeFriends) {
                if (theirs.contains(friend)) mutual++;
            }
            if (mutual > 0) suggestions.add(new Suggestion(candidate, mutual, sharedInterests(graph, userId, candidate)));
        }
        suggestions.sort(RANKING);
        return List.copyOf(suggestions.subList(0, Math.min(k, suggestions.size())));
    }
}
