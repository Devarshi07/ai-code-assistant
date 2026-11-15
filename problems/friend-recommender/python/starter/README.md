# Campfire: people you may know

Campfire is a small social network for local hobby clubs. This package is the
back end of its **"People you may know"** panel: it loads the nightly member and
activity exports into an in-memory social graph, answers questions about it
(friend lists, mutual friends, blocks) and renders the text views used by the
support desk.

## Rules of the network

- **Friendships are mutual.** If Alice and Bob are friends, each one is in the
  other's friend list. Either of them can end the friendship.
- **Blocks are one-directional** (Carol can block Dave without Dave blocking
  Carol), but a block hides the two members from each other's suggestions.
  Blocking someone also ends any friendship between them, and members who are
  blocked either way cannot become friends. Unblocking does not restore an
  ended friendship.
- **Deactivated members** keep their friendships in the data, but they are never
  suggested and don't count as mutual friends.
- Member ids are lowercase handles (`alice`, `m01234`). Interests are tags like
  `board-games`.

## Data exports

`data/members.csv` has one row per member:

```
id,name,joined,interests
alice,Alice Moreno,2019-04-02,climbing;jazz;film
```

`data/activity.log` has one event per line, applied oldest first:

```
friend alice bob          # alice and bob become friends
unfriend bob alice        # bob ends the friendship
block judy peggy          # judy blocks peggy
unblock judy peggy
deactivate rupert
```

## Layout

| Module | Responsibility |
| --- | --- |
| `campfire/models.py` | `User` records, id validation, interest and date parsing |
| `campfire/graph.py` | `SocialGraph`: members, friendships, blocks, mutual friends |
| `campfire/loader.py` | Reads `members.csv` and `activity.log` into a graph |
| `campfire/recommend.py` | `Suggestion` and `recommend`, the "People you may know" ranking |
| `campfire/report.py` | Text views: network summary, friend lists, profile cards, suggestions |
| `main.py` | Prints a support-desk view of the sample network |

`SocialGraph.friends_of(user_id)` returns the graph's own set of friend ids for
speed. Treat it as read-only.

## Running

```
python main.py
python -m unittest discover -s tests -v
```
