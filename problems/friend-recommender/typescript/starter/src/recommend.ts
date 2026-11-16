// 'People you may know': friend suggestions for a member.
//
// Suggestions are friends of friends. A member is never suggested to
// themselves, to their existing friends, to anyone they have blocked or been
// blocked by, or at all once their account is deactivated.
import type { SocialGraph } from './graph.ts';

/** One entry of the 'People you may know' panel, as a plain object. */
export interface Suggestion {
  userId: string; // the suggested member
  mutual: number; // active friends the two members have in common
  shared: number; // interests the two members have in common
}

/** Number of interests members a and b have in common. */
export function sharedInterests(graph: SocialGraph, a: string, b: string): number {
  const theirs = graph.user(b).interests;
  let count = 0;
  for (const tag of graph.user(a).interests) if (theirs.has(tag)) count++;
  return count;
}

/**
 * Up to k friend suggestions for userId, best first.
 * Ranked by mutual friends, then shared interests, then member id.
 */
export function recommend(graph: SocialGraph, userId: string, k = 5): Suggestion[] {
  throw new Error('Not implemented: recommend (Phase 2)');
}
