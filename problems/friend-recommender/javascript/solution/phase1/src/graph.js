// The Campfire social graph: members, friendships and blocks.
//
// Friendships are mutual: when Alice and Bob are friends, each one appears in
// the other's friend list. Blocks are one-directional (Carol can block Dave
// without Dave blocking Carol), but a block hides the two members from each
// other either way. Blocking someone also ends any friendship between the two.

/** Raised for operations that would break the graph's rules. */
class GraphError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GraphError';
  }
}

class SocialGraph {
  constructor() {
    this._users = new Map();    // id -> User, in the order members were added
    this._friends = new Map();  // id -> Set of friend ids
    this._blocked = new Map();  // id -> Set of ids this member has blocked
  }

  // -- members -------------------------------------------------------------

  addUser(user) {
    if (this._users.has(user.id)) throw new GraphError(`duplicate member '${user.id}'`);
    this._users.set(user.id, user);
    this._friends.set(user.id, new Set());
    this._blocked.set(user.id, new Set());
    return user;
  }

  user(userId) {
    const user = this._users.get(userId);
    if (!user) throw new GraphError(`unknown member '${userId}'`);
    return user;
  }

  /** Every member, in the order they were added. */
  users() {
    return [...this._users.values()];
  }

  has(userId) {
    return this._users.has(userId);
  }

  get size() {
    return this._users.size;
  }

  /** Deactivated members keep their friendships but are never suggested. */
  deactivate(userId) {
    this.user(userId).active = false;
  }

  // -- friendships ---------------------------------------------------------

  /** Make a and b friends. Returns false if they already were. */
  addFriendship(a, b) {
    this._checkPair(a, b);
    if (this.blockedEither(a, b)) throw new GraphError(`'${a}' and '${b}' cannot be friends: one has blocked the other`);
    if (this._friends.get(a).has(b)) return false;
    this._friends.get(a).add(b);
    this._friends.get(b).add(a);
    return true;
  }

  /**
   * End the friendship between a and b. Either member may end it.
   * Returns false if they were not friends.
   */
  removeFriendship(a, b) {
    this._checkPair(a, b);
    if (!this._friends.get(a).has(b)) return false;
    this._friends.get(a).delete(b);
    this._friends.get(b).delete(a);
    return true;
  }

  areFriends(a, b) {
    const friends = this._friends.get(a);
    return Boolean(friends && friends.has(b));
  }

  /** The live Set of userId's friend ids. Treat it as read-only. */
  friendsOf(userId) {
    this.user(userId);
    return this._friends.get(userId);
  }

  friendCount(userId) {
    return this.friendsOf(userId).size;
  }

  /** Sorted ids of the members who are friends with both a and b. */
  mutualFriends(a, b) {
    const theirs = this.friendsOf(b);
    return [...this.friendsOf(a)].filter(id => theirs.has(id)).sort();
  }

  /** Number of friendships in the network (each counted once). */
  friendshipCount() {
    let total = 0;
    for (const friends of this._friends.values()) total += friends.size;
    return Math.floor(total / 2);
  }

  // -- blocks --------------------------------------------------------------

  /** blocker blocks blocked, ending any friendship between them. */
  block(blocker, blocked) {
    this._checkPair(blocker, blocked);
    this._blocked.get(blocker).add(blocked);
    this.removeFriendship(blocker, blocked);
  }

  /** Lift a block. A friendship that the block ended stays ended. */
  unblock(blocker, blocked) {
    this._checkPair(blocker, blocked);
    this._blocked.get(blocker).delete(blocked);
  }

  hasBlocked(blocker, blocked) {
    const set = this._blocked.get(blocker);
    return Boolean(set && set.has(blocked));
  }

  /** True if a has blocked b or b has blocked a. */
  blockedEither(a, b) {
    return this.hasBlocked(a, b) || this.hasBlocked(b, a);
  }

  blockCount() {
    let total = 0;
    for (const blocked of this._blocked.values()) total += blocked.size;
    return total;
  }

  _checkPair(a, b) {
    this.user(a);
    this.user(b);
    if (a === b) throw new GraphError(`'${a}' cannot befriend or block themselves`);
  }
}

module.exports = { SocialGraph, GraphError };
