"""Prints a support-desk view of the sample Campfire network."""
from campfire.loader import load_sample
from campfire.recommend import recommend
from campfire.report import friend_list, network_summary, profile_card, suggestion_lines


def main():
    graph = load_sample()
    print("Campfire sample network:", network_summary(graph))
    print()
    for user_id in ("alice", "bob", "judy", "peggy"):
        print(friend_list(graph, user_id))
    print()
    print(profile_card(graph, "erin", "alice"))
    print()
    for user_id in ("alice", "frank", "olivia"):
        try:
            suggestions = recommend(graph, user_id, k=3)
        except NotImplementedError as exc:
            print(f"People {graph.user(user_id).first_name} may know: {exc}")
        else:
            print(suggestion_lines(graph, user_id, suggestions))


if __name__ == "__main__":
    main()
