import functools
import time
import unittest
from datetime import date

from campfire.graph import SocialGraph
from campfire.models import User
from campfire.recommend import Suggestion, recommend
from tests.generator import build_network

# Ana and Bea both know an organiser with 40 friends. Bea also knows c07 and
# c21, and only c30 shares one of Ana's interests. The organiser's friends are
# added in reverse id order.
ORGANISER_FRIENDS = [f"c{i:02d}" for i in range(39, -1, -1)]

LARGE_LIMIT = 0.75  # seconds for the whole batch
LARGE_ORGANISERS = ["m11298", "m21194", "m02945"]  # the members with the most friends
EXPECTED_FINGERPRINT = 769757629


def organiser_network(blocks=(), inactive=()):
    graph = SocialGraph()
    members = [("ana", {"jazz", "film"}), ("bea", {"film"}), ("hub", {"chess"})]
    members += [(c, {"jazz"} if c == "c30" else set()) for c in ORGANISER_FRIENDS]
    for user_id, interests in members:
        graph.add_user(User(user_id, user_id.title(), date(2022, 9, 1), frozenset(interests)))
    for a, b in [("ana", "hub"), ("ana", "bea"), ("bea", "hub")]:
        graph.add_friendship(a, b)
    for c in ORGANISER_FRIENDS:
        graph.add_friendship("hub", c)
    graph.add_friendship("bea", "c21")
    graph.add_friendship("bea", "c07")
    for blocker, blocked in blocks:
        graph.block(blocker, blocked)
    for user_id in inactive:
        graph.deactivate(user_id)
    return graph


@functools.lru_cache(maxsize=None)
def club_network():
    return build_network(5, 3000, organisers=2, reach=150, blocks=200, inactive=60)


@functools.lru_cache(maxsize=None)
def large_network():
    return build_network(11, 30000, organisers=6, reach=600, blocks=300, inactive=600)


def as_tuples(suggestions):
    return [tuple(s) for s in suggestions]


def fingerprint(results):
    """32-bit FNV-1a hash of every query's suggestions, in order."""
    text = "|".join(user_id + ">" + ",".join(f"{s.user_id}:{s.mutual}:{s.shared}" for s in suggestions)
                    for user_id, suggestions in results)
    value = 2166136261
    for ch in text:
        value = ((value ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return value


def assert_valid(test, graph, user_id, suggestions, k):
    """Every suggestion obeys the rules, and the list is in ranking order."""
    me = graph.user(user_id)
    test.assertLessEqual(len(suggestions), k)
    test.assertEqual(len({s.user_id for s in suggestions}), len(suggestions), "duplicate suggestion")
    for s in suggestions:
        test.assertIsInstance(s, Suggestion)
        other = graph.user(s.user_id)
        test.assertNotEqual(s.user_id, user_id)
        test.assertNotIn(s.user_id, graph.friends_of(user_id), f"{s.user_id} is already a friend of {user_id}")
        test.assertTrue(other.active, f"{s.user_id} is deactivated")
        test.assertFalse(graph.blocked_either(user_id, s.user_id), f"{s.user_id} and {user_id} are blocked")
        mutual = [f for f in graph.friends_of(user_id) if graph.user(f).active and s.user_id in graph.friends_of(f)]
        test.assertEqual(s.mutual, len(mutual), f"mutual count for {s.user_id}")
        test.assertGreater(s.mutual, 0)
        test.assertEqual(s.shared, len(me.interests & other.interests), f"shared interests for {s.user_id}")
    keys = [(-s.mutual, -s.shared, s.user_id) for s in suggestions]
    test.assertEqual(keys, sorted(keys), "suggestions must be in ranking order")


class ScaleTests(unittest.TestCase):
    def test_organiser_ties_break_on_interests_then_id(self):
        graph = organiser_network()
        self.assertEqual(as_tuples(recommend(graph, "ana", 4)),
                         [("c07", 2, 0), ("c21", 2, 0), ("c30", 1, 1), ("c00", 1, 0)])
        self.assertEqual(as_tuples(recommend(graph, "bea", 3)), [("c00", 1, 0), ("c01", 1, 0), ("c02", 1, 0)])
        everyone = recommend(graph, "ana", 100)
        self.assertEqual(len(everyone), 40)
        assert_valid(self, graph, "ana", everyone, 100)

    def test_exclusions_still_apply(self):
        graph = organiser_network(blocks=[("ana", "c01")], inactive=["c00"])
        self.assertEqual(as_tuples(recommend(graph, "ana", 4)),
                         [("c07", 2, 0), ("c21", 2, 0), ("c30", 1, 1), ("c02", 1, 0)])
        quiet = organiser_network(inactive=["hub"])
        self.assertEqual(as_tuples(recommend(quiet, "ana", 4)), [("c07", 1, 0), ("c21", 1, 0)])
        self.assertEqual(recommend(quiet, "ana", 0), [])

    def test_generated_club_network(self):
        graph = club_network()
        expected = {
            "m00004": [("m00039", 4, 0), ("m00001", 3, 2), ("m00040", 3, 1), ("m00014", 3, 0), ("m00026", 3, 0)],
            "m00006": [("m00044", 5, 0), ("m00002", 4, 1), ("m00000", 4, 0), ("m00011", 4, 0), ("m00007", 3, 2)],
            "m00146": [("m00108", 4, 0), ("m00118", 3, 0), ("m00138", 3, 0), ("m00128", 2, 2), ("m00107", 2, 1)],
            "m01230": [("m01232", 6, 0), ("m01242", 4, 1), ("m01214", 4, 0), ("m01202", 3, 1), ("m01227", 3, 0)],
            "m01945": [("m00984", 7, 1), ("m01943", 7, 0), ("m01912", 5, 1), ("m01736", 5, 0), ("m01738", 5, 0)],
            "m02718": [("m02722", 4, 1), ("m02709", 4, 0), ("m02725", 4, 0), ("m02744", 4, 0), ("m02707", 3, 1)],
        }
        for user_id, want in expected.items():
            with self.subTest(user=user_id):
                self.assertEqual(as_tuples(recommend(graph, user_id, 5)), want)

    def test_generated_network_follows_the_rules(self):
        graph = club_network()
        for index in range(0, 3000, 97):
            user_id = f"m{index:05d}"
            assert_valid(self, graph, user_id, recommend(graph, user_id, 8), 8)

    def test_large_network_batch_is_fast(self):
        graph = large_network()
        queries = [f"m{index:05d}" for index in range(0, 30000, 150)] + LARGE_ORGANISERS
        start = time.perf_counter()
        results = [(user_id, recommend(graph, user_id, 10)) for user_id in queries]
        elapsed = time.perf_counter() - start
        self.assertEqual(sum(len(s) for _, s in results), 2030)
        self.assertEqual(as_tuples(results[0][1][:3]), [("m00033", 5, 0), ("m00015", 4, 1), ("m00039", 4, 1)])
        for user_id, suggestions in results[::10] + results[-3:]:
            assert_valid(self, graph, user_id, suggestions, 10)
        self.assertEqual(fingerprint(results), EXPECTED_FINGERPRINT, "batch results differ from the reference")
        self.assertLess(elapsed, LARGE_LIMIT,
                        f"{len(queries)} recommend calls took {elapsed:.2f}s; they must finish in under {LARGE_LIMIT}s")



if __name__ == "__main__":
    unittest.main()
