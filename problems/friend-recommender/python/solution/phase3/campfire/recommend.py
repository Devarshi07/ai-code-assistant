"""'People you may know': friend suggestions for a member.

Suggestions are friends of friends. A member is never suggested to
themselves, to their existing friends, to anyone they have blocked or been
blocked by, or at all once their account is deactivated.
"""
import heapq
from typing import NamedTuple


class Suggestion(NamedTuple):
    user_id: str   # the suggested member
    mutual: int    # active friends the two members have in common
    shared: int    # interests the two members have in common


def shared_interests(graph, a, b):
    """Number of interests members a and b have in common."""
    return len(graph.user(a).interests & graph.user(b).interests)


def _rank(suggestion):
    return (-suggestion.mutual, -suggestion.shared, suggestion.user_id)


def recommend(graph, user_id, k=5):
    """Up to k friend suggestions for user_id, best first.

    Ranked by mutual friends, then shared interests, then member id.

    Only friends of friends can have a mutual friend, so instead of checking
    every member we walk two hops out from user_id. The number of times a
    member is reached through an active friend is exactly their mutual count.
    Cost per call: O(sum of the friends' friend counts + C log k).
    """
    graph.user(user_id)  # unknown members raise GraphError
    if k <= 0:
        return []
    my_friends = graph.friends_of(user_id)
    reached = {}
    for friend in my_friends:
        if not graph.user(friend).active:
            continue
        for candidate in graph.friends_of(friend):
            reached[candidate] = reached.get(candidate, 0) + 1

    suggestions = []
    for candidate, mutual in reached.items():
        if candidate == user_id or candidate in my_friends:
            continue
        if not graph.user(candidate).active or graph.blocked_either(user_id, candidate):
            continue
        suggestions.append(Suggestion(candidate, mutual, shared_interests(graph, user_id, candidate)))
    return heapq.nsmallest(k, suggestions, key=_rank)
