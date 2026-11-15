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
 * Checks every member of the network: O(V * d) per call.
 * @returns {Suggestion[]}
 */
function recommend(graph, userId, k = 5) {
  graph.user(userId); // unknown members throw GraphError
  if (k <= 0) return [];
  const myFriends = graph.friendsOf(userId);
  const activeFriends = [...myFriends].filter(id => graph.user(id).active);
  const suggestions = [];
  for (const other of graph.users()) {
    const candidate = other.id;
    if (candidate === userId || myFriends.has(candidate) || !other.active) continue;
    if (graph.blockedEither(userId, candidate)) continue;
    const theirs = graph.friendsOf(candidate);
    let mutual = 0;
    for (const friend of activeFriends) if (theirs.has(friend)) mutual++;
    if (mutual) suggestions.push({ userId: candidate, mutual, shared: sharedInterests(graph, userId, candidate) });
  }
  suggestions.sort(compareSuggestions);
  return suggestions.slice(0, k);
}

module.exports = { recommend, sharedInterests };
