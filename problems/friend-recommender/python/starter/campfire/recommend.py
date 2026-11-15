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


def recommend(graph, user_id, k=5):
    """Up to k friend suggestions for user_id, best first.

    Ranked by mutual friends, then shared interests, then member id.
    """
    raise NotImplementedError("Phase 2: recommend is not implemented yet")
