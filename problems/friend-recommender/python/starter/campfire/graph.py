"""The Campfire social graph: members, friendships and blocks.

Friendships are mutual: when Alice and Bob are friends, each one appears in
the other's friend list. Blocks are one-directional (Carol can block Dave
without Dave blocking Carol), but a block hides the two members from each
other either way. Blocking someone also ends any friendship between the two.
"""


class GraphError(ValueError):
    """Raised for operations that would break the graph's rules."""


class SocialGraph:
    def __init__(self):
        self._users = {}      # id -> User, in the order members were added
        self._friends = {}    # id -> set of friend ids
        self._blocked = {}    # id -> set of ids this member has blocked

    # -- members ---------------------------------------------------------

    def add_user(self, user):
        if user.id in self._users:
            raise GraphError(f"duplicate member {user.id!r}")
        self._users[user.id] = user
        self._friends[user.id] = set()
        self._blocked[user.id] = set()
        return user

    def user(self, user_id):
        try:
            return self._users[user_id]
        except KeyError:
            raise GraphError(f"unknown member {user_id!r}") from None

    def users(self):
        """Every member, in the order they were added."""
        return list(self._users.values())

    def __contains__(self, user_id):
        return user_id in self._users

    def __len__(self):
        return len(self._users)

    def deactivate(self, user_id):
        """Deactivated members keep their friendships but are never suggested."""
        self.user(user_id).active = False

    # -- friendships -----------------------------------------------------

    def add_friendship(self, a, b):
        """Make a and b friends. Returns False if they already were."""
        self._check_pair(a, b)
        if self.blocked_either(a, b):
            raise GraphError(f"{a!r} and {b!r} cannot be friends: one has blocked the other")
        if b in self._friends[a]:
            return False
        self._friends[a].add(b)
        self._friends[b].add(a)
        return True

    def remove_friendship(self, a, b):
        """End the friendship between a and b. Either member may end it.

        Returns False if they were not friends.
        """
        self._check_pair(a, b)
        friends = self._friends[a]
        if b not in friends:
            return False
        friends.remove(b)
        return True

    def are_friends(self, a, b):
        return b in self._friends.get(a, ())

    def friends_of(self, user_id):
        """The live set of user_id's friend ids. Treat it as read-only."""
        self.user(user_id)
        return self._friends[user_id]

    def friend_count(self, user_id):
        return len(self.friends_of(user_id))

    def mutual_friends(self, a, b):
        """Sorted ids of the members who are friends with both a and b."""
        return sorted(self.friends_of(a) & self.friends_of(b))

    def friendship_count(self):
        """Number of friendships in the network (each counted once)."""
        return sum(len(friends) for friends in self._friends.values()) // 2

    # -- blocks ----------------------------------------------------------

    def block(self, blocker, blocked):
        """blocker blocks blocked, ending any friendship between them."""
        self._check_pair(blocker, blocked)
        self._blocked[blocker].add(blocked)
        self.remove_friendship(blocker, blocked)

    def unblock(self, blocker, blocked):
        """Lift a block. A friendship that the block ended stays ended."""
        self._check_pair(blocker, blocked)
        self._blocked[blocker].discard(blocked)

    def has_blocked(self, blocker, blocked):
        return blocked in self._blocked.get(blocker, ())

    def blocked_either(self, a, b):
        """True if a has blocked b or b has blocked a."""
        return self.has_blocked(a, b) or self.has_blocked(b, a)

    def block_count(self):
        return sum(len(blocked) for blocked in self._blocked.values())

    def _check_pair(self, a, b):
        self.user(a)
        self.user(b)
        if a == b:
            raise GraphError(f"{a!r} cannot befriend or block themselves")
