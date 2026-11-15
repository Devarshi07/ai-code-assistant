"""Plain-text views used by the CLI and the support desk."""


def plural(count, noun):
    return f"{count} {noun}" if count == 1 else f"{count} {noun}s"


def network_summary(graph):
    """'18 members (1 deactivated), 32 friendships, 3 blocks'."""
    members = graph.users()
    inactive = sum(1 for user in members if not user.active)
    return (f"{plural(len(members), 'member')} ({inactive} deactivated), "
            f"{plural(graph.friendship_count(), 'friendship')}, "
            f"{plural(graph.block_count(), 'block')}")


def friend_list(graph, user_id):
    """'Alice Moreno (@alice) has 2 friends: Carol Lindqvist, Erin Walsh'."""
    user = graph.user(user_id)
    names = sorted(graph.user(friend).name for friend in graph.friends_of(user_id))
    listing = ", ".join(names) if names else "nobody yet"
    return f"{user} has {plural(len(names), 'friend')}: {listing}"


def profile_card(graph, viewer_id, user_id):
    """How user_id's profile looks to viewer_id."""
    user = graph.user(user_id)
    lines = [str(user), f"  member since {user.member_since}"]
    if user.interests:
        lines.append("  into " + ", ".join(sorted(user.interests)))
    lines.append("  " + plural(graph.friend_count(user_id), "friend"))
    if viewer_id != user_id:
        mutual = graph.mutual_friends(viewer_id, user_id)
        if mutual:
            names = ", ".join(graph.user(friend).first_name for friend in mutual)
            lines.append(f"  {plural(len(mutual), 'mutual friend')} with {graph.user(viewer_id).first_name}: {names}")
    if not user.active:
        lines.append("  (account deactivated)")
    return "\n".join(lines)


def suggestion_lines(graph, user_id, suggestions):
    """The 'People you may know' panel as text."""
    title = f"People {graph.user(user_id).first_name} may know:"
    if not suggestions:
        return f"{title} no suggestions yet"
    lines = [title]
    for rank, suggestion in enumerate(suggestions, start=1):
        other = graph.user(suggestion.user_id)
        lines.append(f"  {rank}. {other}  {plural(suggestion.mutual, 'mutual friend')}, "
                     f"{plural(suggestion.shared, 'shared interest')}")
    return "\n".join(lines)
