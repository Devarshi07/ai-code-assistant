package campfire;

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
     */
    public static List<Suggestion> recommend(SocialGraph graph, String userId, int k) {
        throw new UnsupportedOperationException("Phase 2: recommend is not implemented yet");
    }
}
