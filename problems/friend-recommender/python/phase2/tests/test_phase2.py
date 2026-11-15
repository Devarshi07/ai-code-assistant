import unittest
from datetime import date

from campfire.graph import GraphError, SocialGraph
from campfire.loader import load_sample
from campfire.models import User
from campfire.recommend import Suggestion, recommend

# A reading club. Ana is friends with Ben, Cai and Dev; Ben and Cai are also
# friends with each other. Members are added out of alphabetical order on purpose.
CLUB_MEMBERS = [
    ("ana", ["jazz", "film", "chess"]),
    ("ben", ["film"]),
    ("cai", ["jazz"]),
    ("dev", ["poetry"]),
    ("ida", ["chess"]),
    ("eve", []),
    ("kim", ["film", "chess"]),
    ("gus", ["jazz", "film"]),
    ("fay", ["jazz"]),
    ("hal", ["chess"]),
    ("jon", ["jazz", "film", "chess"]),
    ("zed", ["jazz"]),
]
CLUB_FRIENDSHIPS = [
    ("ana", "ben"), ("ana", "cai"), ("ana", "dev"), ("ben", "cai"),
    ("eve", "ben"), ("eve", "cai"), ("eve", "dev"),
    ("fay", "ben"), ("fay", "cai"),
    ("gus", "ben"), ("gus", "dev"),
    ("hal", "cai"), ("kim", "cai"), ("ida", "dev"),
    ("jon", "eve"),
]


def club(blocks=(), inactive=()):
    graph = SocialGraph()
    for user_id, interests in CLUB_MEMBERS:
        graph.add_user(User(user_id, user_id.title(), date(2023, 3, 1), frozenset(interests)))
    for a, b in CLUB_FRIENDSHIPS:
        graph.add_friendship(a, b)
    for blocker, blocked in blocks:
        graph.block(blocker, blocked)
    for user_id in inactive:
        graph.deactivate(user_id)
    return graph


def as_tuples(suggestions):
    return [tuple(s) for s in suggestions]


def assert_valid(test, graph, user_id, suggestions, k):
    """Every suggestion obeys the rules, and the list is in ranking order."""
    me = graph.user(user_id)
    test.assertLessEqual(len(suggestions), max(k, 0))
    seen = set()
    for s in suggestions:
        test.assertIsInstance(s, Suggestion)
        other = graph.user(s.user_id)
        test.assertNotIn(s.user_id, seen, f"{s.user_id} suggested twice")
        seen.add(s.user_id)
        test.assertNotEqual(s.user_id, user_id, "never suggest members to themselves")
        test.assertNotIn(s.user_id, graph.friends_of(user_id), f"{s.user_id} is already a friend")
        test.assertTrue(other.active, f"{s.user_id} is deactivated")
        test.assertFalse(graph.has_blocked(user_id, s.user_id) or graph.has_blocked(s.user_id, user_id),
                         f"{s.user_id} and {user_id} are blocked")
        mutual = [f for f in graph.friends_of(user_id)
                  if graph.user(f).active and user_id in graph.friends_of(f) and s.user_id in graph.friends_of(f)]
        test.assertEqual(s.mutual, len(mutual), f"mutual count for {s.user_id}")
        test.assertGreater(s.mutual, 0)
        test.assertEqual(s.shared, len(me.interests & other.interests), f"shared interests for {s.user_id}")
    keys = [(-s.mutual, -s.shared, s.user_id) for s in suggestions]
    test.assertEqual(keys, sorted(keys), "suggestions must be in ranking order")


class RecommendTests(unittest.TestCase):
    def test_ranks_friends_of_friends_by_mutual_friends(self):
        graph = club()
        got = recommend(graph, "ana", 10)
        self.assertEqual([s.user_id for s in got][:3], ["eve", "gus", "fay"])
        self.assertEqual(got[0], Suggestion("eve", 3, 0))
        assert_valid(self, graph, "ana", got, 10)

    def test_ties_break_on_shared_interests_then_id(self):
        got = recommend(club(), "ana", 10)
        self.assertEqual(as_tuples(got), [
            ("eve", 3, 0), ("gus", 2, 2), ("fay", 2, 1),
            ("kim", 1, 2), ("hal", 1, 1), ("ida", 1, 1),
        ])

    def test_k_limits_the_list(self):
        graph = club()
        self.assertEqual(as_tuples(recommend(graph, "ana", 2)), [("eve", 3, 0), ("gus", 2, 2)])
        self.assertEqual(recommend(graph, "ana", 0), [])
        self.assertEqual(len(recommend(graph, "ana", 50)), 6)
        self.assertEqual(len(recommend(graph, "ana")), 5, "k defaults to 5")

    def test_self_and_existing_friends_are_never_suggested(self):
        graph = club()
        got = recommend(graph, "ben", 10)
        self.assertEqual(as_tuples(got), [("dev", 3, 0), ("jon", 1, 1), ("kim", 1, 1), ("hal", 1, 0)])
        assert_valid(self, graph, "ben", got, 10)

    def test_members_without_mutual_friends_are_not_suggested(self):
        graph = club()
        self.assertNotIn("jon", [s.user_id for s in recommend(graph, "ana", 50)])
        self.assertEqual(recommend(graph, "zed", 5), [], "zed has no friends yet")

    def test_blocks_hide_members_in_both_directions(self):
        graph = club(blocks=[("ana", "gus"), ("fay", "ana")])
        got = recommend(graph, "ana", 10)
        self.assertEqual(as_tuples(got), [("eve", 3, 0), ("kim", 1, 2), ("hal", 1, 1), ("ida", 1, 1)])
        self.assertNotIn("ana", [s.user_id for s in recommend(graph, "fay", 10)])
        self.assertNotIn("ana", [s.user_id for s in recommend(graph, "gus", 10)])

    def test_deactivated_members_are_not_suggested_or_counted(self):
        graph = club(inactive=["eve", "dev"])
        got = recommend(graph, "ana", 10)
        self.assertEqual(as_tuples(got), [("fay", 2, 1), ("gus", 1, 2), ("kim", 1, 2), ("hal", 1, 1)])
        assert_valid(self, graph, "ana", got, 10)

    def test_unknown_member_raises(self):
        with self.assertRaises(GraphError):
            recommend(club(), "nobody", 3)

    def test_recommend_does_not_change_the_graph(self):
        graph = club(blocks=[("fay", "ana")], inactive=["dev"])
        before = {u.id: (frozenset(graph.friends_of(u.id)), u.active) for u in graph.users()}
        for user in graph.users():
            recommend(graph, user.id, 3)
        after = {u.id: (frozenset(graph.friends_of(u.id)), u.active) for u in graph.users()}
        self.assertEqual(after, before)
        self.assertTrue(graph.has_blocked("fay", "ana"))


class SampleNetworkTests(unittest.TestCase):
    def test_sample_suggestions(self):
        graph = load_sample()
        self.assertEqual(as_tuples(recommend(graph, "alice", 3)),
                         [("judy", 3, 2), ("olivia", 2, 2), ("trent", 1, 2)])
        self.assertEqual(as_tuples(recommend(graph, "olivia", 10)), [
            ("alice", 2, 2), ("carol", 2, 1), ("judy", 2, 1), ("victor", 2, 1), ("bob", 1, 1), ("ivan", 1, 1),
        ])

    def test_sample_respects_deactivated_accounts(self):
        graph = load_sample()
        self.assertEqual(as_tuples(recommend(graph, "dave", 10)),
                         [("erin", 1, 1), ("sybil", 1, 1), ("heidi", 1, 0), ("mallory", 1, 0)])
        self.assertEqual(as_tuples(recommend(graph, "niaj", 10)), [("bob", 1, 2), ("ivan", 1, 1)])
        self.assertEqual(recommend(graph, "peggy", 10), [])

    def test_every_sample_list_follows_the_rules(self):
        graph = load_sample()
        for user in graph.users():
            assert_valid(self, graph, user.id, recommend(graph, user.id, 4), 4)


if __name__ == "__main__":
    unittest.main()
