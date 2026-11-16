package campfire;

import java.util.ArrayList;
import java.util.List;

/** Plain-text views used by the CLI and the support desk. */
public final class Report {
    private Report() {}

    public static String plural(int count, String noun) {
        return count == 1 ? count + " " + noun : count + " " + noun + "s";
    }

    /** "18 members (1 deactivated), 32 friendships, 3 blocks". */
    public static String networkSummary(SocialGraph graph) {
        List<User> members = graph.users();
        long inactive = members.stream().filter(user -> !user.isActive()).count();
        return "%s (%d deactivated), %s, %s".formatted(plural(members.size(), "member"), inactive,
                plural(graph.friendshipCount(), "friendship"), plural(graph.blockCount(), "block"));
    }

    /** "Alice Moreno (@alice) has 2 friends: Carol Lindqvist, Erin Walsh". */
    public static String friendList(SocialGraph graph, String userId) {
        User user = graph.user(userId);
        List<String> names = graph.friendsOf(userId).stream().map(id -> graph.user(id).name()).sorted().toList();
        String listing = names.isEmpty() ? "nobody yet" : String.join(", ", names);
        return "%s has %s: %s".formatted(user, plural(names.size(), "friend"), listing);
    }

    /** How userId's profile looks to viewerId. */
    public static String profileCard(SocialGraph graph, String viewerId, String userId) {
        User user = graph.user(userId);
        List<String> lines = new ArrayList<>(List.of(user.toString(), "  member since " + user.memberSince()));
        if (!user.interests().isEmpty()) lines.add("  into " + String.join(", ", user.interests().stream().sorted().toList()));
        lines.add("  " + plural(graph.friendCount(userId), "friend"));
        if (!viewerId.equals(userId)) {
            List<String> mutual = graph.mutualFriends(viewerId, userId);
            if (!mutual.isEmpty()) {
                String names = String.join(", ", mutual.stream().map(id -> graph.user(id).firstName()).toList());
                lines.add("  %s with %s: %s".formatted(plural(mutual.size(), "mutual friend"), graph.user(viewerId).firstName(), names));
            }
        }
        if (!user.isActive()) lines.add("  (account deactivated)");
        return String.join("\n", lines);
    }

    /** The "People you may know" panel as text. */
    public static String suggestionLines(SocialGraph graph, String userId, List<Suggestion> suggestions) {
        String title = "People " + graph.user(userId).firstName() + " may know:";
        if (suggestions.isEmpty()) return title + " no suggestions yet";
        List<String> lines = new ArrayList<>(List.of(title));
        for (int i = 0; i < suggestions.size(); i++) {
            Suggestion suggestion = suggestions.get(i);
            User other = graph.user(suggestion.userId());
            lines.add("  %d. %s  %s, %s".formatted(i + 1, other, plural(suggestion.mutual(), "mutual friend"),
                    plural(suggestion.shared(), "shared interest")));
        }
        return String.join("\n", lines);
    }
}
