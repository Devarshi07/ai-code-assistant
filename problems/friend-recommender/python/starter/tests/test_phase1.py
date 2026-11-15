import unittest
from datetime import date

from campfire.graph import GraphError, SocialGraph
from campfire.loader import LoadError, apply_activity, load_members_csv, load_sample
from campfire.models import User
from campfire.report import friend_list, network_summary, profile_card


def make_graph(*ids):
    graph = SocialGraph()
    for user_id in ids:
        graph.add_user(User(user_id, user_id.title(), date(2022, 5, 1)))
    return graph


def friends(graph, user_id):
    return sorted(graph.friends_of(user_id))


class FriendshipTests(unittest.TestCase):
    def test_friendship_is_mutual(self):
        graph = make_graph("alice", "bob")
        self.assertTrue(graph.add_friendship("alice", "bob"))
        self.assertEqual(friends(graph, "alice"), ["bob"])
        self.assertEqual(friends(graph, "bob"), ["alice"])
        self.assertTrue(graph.are_friends("bob", "alice"))

    def test_adding_a_friendship_twice_is_harmless(self):
        graph = make_graph("alice", "bob")
        graph.add_friendship("alice", "bob")
        self.assertFalse(graph.add_friendship("bob", "alice"))
        self.assertEqual(graph.friend_count("alice"), 1)
        self.assertEqual(graph.friendship_count(), 1)

    def test_members_cannot_befriend_themselves(self):
        graph = make_graph("alice")
        with self.assertRaises(GraphError):
            graph.add_friendship("alice", "alice")

    def test_unfriending_clears_both_friend_lists(self):
        graph = make_graph("alice", "bob", "carol")
        graph.add_friendship("alice", "bob")
        graph.add_friendship("alice", "carol")
        self.assertTrue(graph.remove_friendship("bob", "alice"))
        self.assertEqual(friends(graph, "bob"), [])
        self.assertEqual(friends(graph, "alice"), ["carol"], "Bob unfriended Alice, so he must leave her list too")
        self.assertFalse(graph.are_friends("alice", "bob"))

    def test_friending_again_after_an_unfriend(self):
        graph = make_graph("alice", "bob")
        graph.add_friendship("alice", "bob")
        graph.remove_friendship("bob", "alice")
        self.assertTrue(graph.add_friendship("alice", "bob"), "they were no longer friends")
        self.assertEqual(friends(graph, "alice"), ["bob"])
        self.assertEqual(friends(graph, "bob"), ["alice"])

    def test_mutual_friends_skip_ended_friendships(self):
        graph = make_graph("alice", "bob", "carol", "erin")
        for a, b in [("alice", "bob"), ("alice", "carol"), ("erin", "bob"), ("erin", "carol")]:
            graph.add_friendship(a, b)
        self.assertEqual(graph.mutual_friends("erin", "alice"), ["bob", "carol"])
        graph.remove_friendship("bob", "alice")
        self.assertEqual(graph.mutual_friends("erin", "alice"), ["carol"])
        self.assertEqual(graph.mutual_friends("alice", "erin"), ["carol"])


class BlockTests(unittest.TestCase):
    def test_blocks_are_one_directional(self):
        graph = make_graph("carol", "dave")
        graph.block("carol", "dave")
        self.assertTrue(graph.has_blocked("carol", "dave"))
        self.assertFalse(graph.has_blocked("dave", "carol"))
        self.assertTrue(graph.blocked_either("dave", "carol"))

    def test_blocked_members_cannot_become_friends(self):
        graph = make_graph("carol", "dave")
        graph.block("dave", "carol")
        with self.assertRaises(GraphError):
            graph.add_friendship("carol", "dave")

    def test_blocking_a_friend_ends_the_friendship_for_both(self):
        graph = make_graph("judy", "peggy", "rupert")
        graph.add_friendship("judy", "peggy")
        graph.add_friendship("peggy", "rupert")
        graph.block("judy", "peggy")
        self.assertEqual(friends(graph, "judy"), [])
        self.assertEqual(friends(graph, "peggy"), ["rupert"], "Judy blocked Peggy, so she must leave Peggy's list")

    def test_unblocking_does_not_restore_the_friendship(self):
        graph = make_graph("frank", "heidi")
        graph.add_friendship("frank", "heidi")
        graph.block("heidi", "frank")
        graph.unblock("heidi", "frank")
        self.assertFalse(graph.blocked_either("frank", "heidi"))
        self.assertFalse(graph.are_friends("frank", "heidi"))
        self.assertFalse(graph.are_friends("heidi", "frank"))


class LoaderTests(unittest.TestCase):
    def test_members_csv_reads_names_dates_and_interests(self):
        graph = load_members_csv('id,name,joined,interests\n'
                                 'dana,"Dana Park, PhD",2021-11-30,Board Games; jazz\n'
                                 'eli,Eli Stone,2022-01-02,\n')
        dana = graph.user("dana")
        self.assertEqual(dana.name, "Dana Park, PhD")
        self.assertEqual(dana.joined, date(2021, 11, 30))
        self.assertEqual(dana.interests, frozenset({"board-games", "jazz"}))
        self.assertEqual(graph.user("eli").interests, frozenset())

    def test_activity_errors_name_the_line(self):
        graph = make_graph("alice", "bob")
        with self.assertRaises(LoadError) as caught:
            apply_activity(graph, "# header\nfriend alice bob\n\nfriend alice zoe\n")
        self.assertIn("line 4", str(caught.exception))

    def test_sample_friend_lists(self):
        graph = load_sample()
        self.assertEqual(friend_list(graph, "bob"),
                         "Bob Okafor (@bob) has 3 friends: Dave Ferreira, Erin Walsh, Ivan Petrov")
        self.assertEqual(friend_list(graph, "alice"),
                         "Alice Moreno (@alice) has 3 friends: Carol Lindqvist, Erin Walsh, Grace Kim")
        self.assertEqual(friend_list(graph, "peggy"), "Peggy Sousa (@peggy) has 1 friend: Rupert Hale")
        self.assertEqual(friend_list(graph, "frank"),
                         "Frank Osei (@frank) has 2 friends: Carol Lindqvist, Mallory Quinn")

    def test_sample_friend_lists_agree_both_ways(self):
        graph = load_sample()
        for user in graph.users():
            for friend in graph.friends_of(user.id):
                self.assertTrue(graph.are_friends(friend, user.id),
                                f"{user.id} lists {friend} as a friend, but {friend} does not list {user.id}")

    def test_sample_summary_and_profile(self):
        graph = load_sample()
        self.assertEqual(network_summary(graph), "18 members (1 deactivated), 28 friendships, 2 blocks")
        card = profile_card(graph, "erin", "alice")
        self.assertIn("  3 friends", card)
        self.assertIn("2 mutual friends with Erin: Carol, Grace", card)


if __name__ == "__main__":
    unittest.main()
