# Campfire: people you may know

Campfire is a small social network for local hobby clubs. This project is the
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
| `src/models.ts` | `User` records, id validation, interest and date parsing |
| `src/graph.ts` | `SocialGraph`: members, friendships, blocks, mutual friends |
| `src/loader.ts` | Reads `members.csv` and `activity.log` into a graph |
| `src/recommend.ts` | `Suggestion` and `recommend`, the "People you may know" ranking |
| `src/report.ts` | Text views: network summary, friend lists, profile cards, suggestions |
| `main.ts` | Prints a support-desk view of the sample network |

Member ids are plain strings. `graph.friendsOf(userId)` returns the graph's own
`Set` of friend ids for speed, typed as a `ReadonlySet<string>`. Treat it as
read-only. Dates are kept as `YYYY-MM-DD` strings and interests as a set on
each `User`.

## Running

Node 22 runs the TypeScript files directly by stripping the types, so there is
no build step (and no type check).

```
node main.ts
node --test "tests/*.test.ts"
```
