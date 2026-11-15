"""'People you may know': friend suggestions for a member.

Suggestions are friends of friends. A member is never suggested to
themselves, to their existing friends, to anyone they have blocked or been
blocked by, or at all once their account is deactivated.
"""
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
    Checks every member of the network: O(V * d) per call.
    """
    graph.user(user_id)  # unknown members raise GraphError
    if k <= 0:
        return []
    my_friends = graph.friends_of(user_id)
    active_friends = {friend for friend in my_friends if graph.user(friend).active}
    suggestions = []
    for other in graph.users():
        candidate = other.id
        if candidate == user_id or candidate in my_friends or not other.active:
            continue
        if graph.blocked_either(user_id, candidate):
            continue
        mutual = len(active_friends & graph.friends_of(candidate))
        if mutual:
            suggestions.append(Suggestion(candidate, mutual, shared_interests(graph, user_id, candidate)))
    suggestions.sort(key=_rank)
    return suggestions[:k]
