package campfire;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The Campfire social graph: members, friendships and blocks.
 *
 * <p>Friendships are mutual: when Alice and Bob are friends, each one appears in
 * the other's friend list. Blocks are one-directional (Carol can block Dave
 * without Dave blocking Carol), but a block hides the two members from each
 * other either way. Blocking someone also ends any friendship between the two.
 */
public final class SocialGraph {
    private final Map<String, User> users = new LinkedHashMap<>();    // id -> User, in the order members were added
    private final Map<String, Set<String>> friends = new HashMap<>(); // id -> ids of their friends
    private final Map<String, Set<String>> blocks = new HashMap<>();  // id -> ids this member has blocked

    // -- members ---------------------------------------------------------------

    public User addUser(User user) {
        if (users.containsKey(user.id())) throw new GraphException("duplicate member '" + user.id() + "'");
        users.put(user.id(), user);
        friends.put(user.id(), new HashSet<>());
        blocks.put(user.id(), new HashSet<>());
        return user;
    }

    public User user(String userId) {
        User user = users.get(userId);
        if (user == null) throw new GraphException("unknown member '" + userId + "'");
        return user;
    }

    /** Every member, in the order they were added. */
    public List<User> users() {
        return List.copyOf(users.values());
    }

    public boolean has(String userId) {
        return users.containsKey(userId);
    }

    public int size() {
        return users.size();
    }

    /** Deactivated members keep their friendships but are never suggested. */
    public void deactivate(String userId) {
        user(userId).deactivate();
    }

    // -- friendships -----------------------------------------------------------

    /** Makes a and b friends. Returns false if they already were. */
    public boolean addFriendship(String a, String b) {
        checkPair(a, b);
        if (blockedEither(a, b)) throw new GraphException("'" + a + "' and '" + b + "' cannot be friends: one has blocked the other");
        if (friends.get(a).contains(b)) return false;
        friends.get(a).add(b);
        friends.get(b).add(a);
        return true;
    }

    /**
     * Ends the friendship between a and b. Either member may end it.
     * Returns false if they were not friends.
     */
    public boolean removeFriendship(String a, String b) {
        checkPair(a, b);
        if (!friends.get(a).contains(b)) return false;
        friends.get(a).remove(b);
        friends.get(b).remove(a);
        return true;
    }

    public boolean areFriends(String a, String b) {
        Set<String> ids = friends.get(a);
        return ids != null && ids.contains(b);
    }

    /** A live, read-only view of userId's friend ids. Nothing is copied. */
    public Set<String> friendsOf(String userId) {
        user(userId);
        return Collections.unmodifiableSet(friends.get(userId));
    }

    public int friendCount(String userId) {
        return friendsOf(userId).size();
    }

    /** Sorted ids of the members who are friends with both a and b. */
    public List<String> mutualFriends(String a, String b) {
        Set<String> theirs = friendsOf(b);
        return friendsOf(a).stream().filter(theirs::contains).sorted().toList();
    }

    /** Number of friendships in the network (each counted once). */
    public int friendshipCount() {
        int total = 0;
        for (Set<String> ids : friends.values()) total += ids.size();
        return total / 2;
    }

    // -- blocks ----------------------------------------------------------------

    /** blocker blocks blocked, ending any friendship between them. */
    public void block(String blocker, String blocked) {
        checkPair(blocker, blocked);
        blocks.get(blocker).add(blocked);
        removeFriendship(blocker, blocked);
    }

    /** Lifts a block. A friendship that the block ended stays ended. */
    public void unblock(String blocker, String blocked) {
        checkPair(blocker, blocked);
        blocks.get(blocker).remove(blocked);
    }

    public boolean hasBlocked(String blocker, String blocked) {
        Set<String> ids = blocks.get(blocker);
        return ids != null && ids.contains(blocked);
    }

    /** True if a has blocked b or b has blocked a. */
    public boolean blockedEither(String a, String b) {
        return hasBlocked(a, b) || hasBlocked(b, a);
    }

    public int blockCount() {
        int total = 0;
        for (Set<String> ids : blocks.values()) total += ids.size();
        return total;
    }

    private void checkPair(String a, String b) {
        user(a);
        user(b);
        if (a.equals(b)) throw new GraphException("'" + a + "' cannot befriend or block themselves");
    }
}
