// 'People you may know': friend suggestions for a member.
//
// Suggestions are friends of friends. A member is never suggested to
// themselves, to their existing friends, to anyone they have blocked or been
// blocked by, or at all once their account is deactivated.

/**
 * @typedef {{ userId: string, mutual: number, shared: number }} Suggestion
 * userId is the suggested member; mutual counts the active friends the two
 * members have in common; shared counts the interests they have in common.
 */

/** Number of interests members a and b have in common. */
function sharedInterests(graph, a, b) {
  const theirs = graph.user(b).interests;
  let count = 0;
  for (const tag of graph.user(a).interests) if (theirs.has(tag)) count++;
  return count;
}

/** More mutual friends first, then more shared interests, then id ascending. */
function compareSuggestions(x, y) {
  return y.mutual - x.mutual || y.shared - x.shared || (x.userId < y.userId ? -1 : x.userId > y.userId ? 1 : 0);
}

/**
 * Up to k friend suggestions for userId, best first.
 * Ranked by mutual friends, then shared interests, then member id.
 *
 * Only friends of friends can have a mutual friend, so instead of checking
 * every member we walk two hops out from userId. The number of times a member
 * is reached through an active friend is exactly their mutual count. The best
 * k are kept in a small sorted array instead of sorting every candidate.
 * Cost per call: O(sum of the friends' friend counts + C * k).
 * @returns {Suggestion[]}
 */
function recommend(graph, userId, k = 5) {
  graph.user(userId); // unknown members throw GraphError
  if (k <= 0) return [];
  const myFriends = graph.friendsOf(userId);
  const reached = new Map();
  for (const friend of myFriends) {
    if (!graph.user(friend).active) continue;
    for (const candidate of graph.friendsOf(friend)) reached.set(candidate, (reached.get(candidate) || 0) + 1);
  }

  const best = [];
  for (const [candidate, mutual] of reached) {
    if (candidate === userId || myFriends.has(candidate)) continue;
    if (!graph.user(candidate).active || graph.blockedEither(userId, candidate)) continue;
    const suggestion = { userId: candidate, mutual, shared: sharedInterests(graph, userId, candidate) };
    if (best.length === k && compareSuggestions(suggestion, best[k - 1]) >= 0) continue;
    let i = Math.min(best.length, k - 1);
    best[i] = suggestion;
    while (i > 0 && compareSuggestions(best[i], best[i - 1]) < 0) {
      [best[i], best[i - 1]] = [best[i - 1], best[i]];
      i--;
    }
  }
  return best;
}

module.exports = { recommend, sharedInterests };
