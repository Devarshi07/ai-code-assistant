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

/**
 * Up to k friend suggestions for userId, best first.
 * Ranked by mutual friends, then shared interests, then member id.
 * @returns {Suggestion[]}
 */
function recommend(graph, userId, k = 5) {
  throw new Error('Not implemented: recommend (Phase 2)');
}

module.exports = { recommend, sharedInterests };
