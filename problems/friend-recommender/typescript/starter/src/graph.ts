// The Campfire social graph: members, friendships and blocks.
//
// Friendships are mutual: when Alice and Bob are friends, each one appears in
// the other's friend list. Blocks are one-directional (Carol can block Dave
// without Dave blocking Carol), but a block hides the two members from each
// other either way. Blocking someone also ends any friendship between the two.
import type { User } from './models.ts';

/** Raised for operations that would break the graph's rules. */
export class GraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphError';
  }
}

export class SocialGraph {
  private readonly members = new Map<string, User>();        // id -> User, in the order members were added
  private readonly friends = new Map<string, Set<string>>(); // id -> Set of friend ids
  private readonly blocked = new Map<string, Set<string>>(); // id -> Set of ids this member has blocked

  // -- members -------------------------------------------------------------

  addUser(user: User): User {
    if (this.members.has(user.id)) throw new GraphError(`duplicate member '${user.id}'`);
    this.members.set(user.id, user);
    this.friends.set(user.id, new Set());
    this.blocked.set(user.id, new Set());
    return user;
  }

  user(userId: string): User {
    const user = this.members.get(userId);
    if (!user) throw new GraphError(`unknown member '${userId}'`);
    return user;
  }

  /** Every member, in the order they were added. */
  users(): User[] {
    return [...this.members.values()];
  }

  has(userId: string): boolean {
    return this.members.has(userId);
  }

  get size(): number {
    return this.members.size;
  }

  /** Deactivated members keep their friendships but are never suggested. */
  deactivate(userId: string): void {
    this.user(userId).active = false;
  }

  // -- friendships ---------------------------------------------------------

  /** Make a and b friends. Returns false if they already were. */
  addFriendship(a: string, b: string): boolean {
    this.checkPair(a, b);
    if (this.blockedEither(a, b)) throw new GraphError(`'${a}' and '${b}' cannot be friends: one has blocked the other`);
    if (this.friends.get(a)!.has(b)) return false;
    this.friends.get(a)!.add(b);
    this.friends.get(b)!.add(a);
    return true;
  }

  /**
   * End the friendship between a and b. Either member may end it.
   * Returns false if they were not friends.
   */
  removeFriendship(a: string, b: string): boolean {
    this.checkPair(a, b);
    const friends = this.friends.get(a)!;
    if (!friends.has(b)) return false;
    friends.delete(b);
    return true;
  }

  areFriends(a: string, b: string): boolean {
    return this.friends.get(a)?.has(b) ?? false;
  }

  /** The live Set of userId's friend ids. Treat it as read-only. */
  friendsOf(userId: string): ReadonlySet<string> {
    this.user(userId);
    return this.friends.get(userId)!;
  }

  friendCount(userId: string): number {
    return this.friendsOf(userId).size;
  }

  /** Sorted ids of the members who are friends with both a and b. */
  mutualFriends(a: string, b: string): string[] {
    const theirs = this.friendsOf(b);
    return [...this.friendsOf(a)].filter(id => theirs.has(id)).sort();
  }

  /** Number of friendships in the network (each counted once). */
  friendshipCount(): number {
    let total = 0;
    for (const friends of this.friends.values()) total += friends.size;
    return Math.floor(total / 2);
  }

  // -- blocks --------------------------------------------------------------

  /** blocker blocks blocked, ending any friendship between them. */
  block(blocker: string, blocked: string): void {
    this.checkPair(blocker, blocked);
    this.blocked.get(blocker)!.add(blocked);
    this.removeFriendship(blocker, blocked);
  }

  /** Lift a block. A friendship that the block ended stays ended. */
  unblock(blocker: string, blocked: string): void {
    this.checkPair(blocker, blocked);
    this.blocked.get(blocker)!.delete(blocked);
  }

  hasBlocked(blocker: string, blocked: string): boolean {
    return this.blocked.get(blocker)?.has(blocked) ?? false;
  }

  /** True if a has blocked b or b has blocked a. */
  blockedEither(a: string, b: string): boolean {
    return this.hasBlocked(a, b) || this.hasBlocked(b, a);
  }

  blockCount(): number {
    let total = 0;
    for (const blocked of this.blocked.values()) total += blocked.size;
    return total;
  }

  private checkPair(a: string, b: string): void {
    this.user(a);
    this.user(b);
    if (a === b) throw new GraphError(`'${a}' cannot befriend or block themselves`);
  }
}
