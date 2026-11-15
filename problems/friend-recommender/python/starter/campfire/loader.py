"""Loaders for Campfire's nightly data exports.

members.csv    one row per member: id,name,joined,interests
               (joined is YYYY-MM-DD; interests are separated by ';')
activity.log   one event per line, applied in order:

    friend <a> <b>              a and b become friends
    unfriend <a> <b>            a ends the friendship with b
    block <blocker> <other>     blocker blocks other
    unblock <blocker> <other>   blocker lifts the block
    deactivate <member>         member closes their account

Blank lines and lines starting with '#' are ignored.
"""
import csv
import io
from collections import Counter
from pathlib import Path

from .graph import GraphError, SocialGraph
from .models import ModelError, User, parse_date, parse_interests

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MEMBER_COLUMNS = ("id", "name", "joined", "interests")

# verb -> (number of member ids, graph method)
EVENTS = {
    "friend": (2, SocialGraph.add_friendship),
    "unfriend": (2, SocialGraph.remove_friendship),
    "block": (2, SocialGraph.block),
    "unblock": (2, SocialGraph.unblock),
    "deactivate": (1, SocialGraph.deactivate),
}


class LoadError(ValueError):
    """A malformed export. The message names the file and line."""


def load_members_csv(text, graph=None, source="members.csv"):
    """Add every member in a members.csv export to graph (or a new graph)."""
    graph = SocialGraph() if graph is None else graph
    reader = csv.DictReader(io.StringIO(text))
    missing = [column for column in MEMBER_COLUMNS if column not in (reader.fieldnames or ())]
    if missing:
        raise LoadError(f"{source}: missing column(s) {', '.join(missing)}")
    for row in reader:
        field = {column: (row.get(column) or "").strip() for column in MEMBER_COLUMNS}
        try:
            graph.add_user(User(field["id"], field["name"], parse_date(field["joined"]),
                                parse_interests(field["interests"])))
        except (ModelError, GraphError) as exc:
            raise LoadError(f"{source} line {reader.line_num}: {exc}") from None
    return graph


def apply_activity(graph, text, source="activity.log"):
    """Apply an activity log to graph, in order. Returns a Counter of events by verb."""
    applied = Counter()
    for number, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        verb, *ids = line.split()
        if verb not in EVENTS:
            raise LoadError(f"{source} line {number}: unknown event {verb!r}")
        arity, action = EVENTS[verb]
        if len(ids) != arity:
            raise LoadError(f"{source} line {number}: {verb} takes {arity} member id(s), got {len(ids)}")
        try:
            action(graph, *ids)
        except GraphError as exc:
            raise LoadError(f"{source} line {number}: {exc}") from None
        applied[verb] += 1
    return applied


def load_network(members_text, activity_text):
    """Build a graph from a members export plus an activity log."""
    graph = load_members_csv(members_text)
    apply_activity(graph, activity_text)
    return graph


def load_sample():
    """The small sample network in data/, used by main.py and the tests."""
    members = (DATA_DIR / "members.csv").read_text(encoding="utf-8")
    activity = (DATA_DIR / "activity.log").read_text(encoding="utf-8")
    return load_network(members, activity)
