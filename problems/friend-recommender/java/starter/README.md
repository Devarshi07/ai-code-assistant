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

Everything lives in the `campfire` package under `src/campfire/`.

| Class | Responsibility |
| --- | --- |
| `User` | A member record, plus id validation and interest and date parsing |
| `SocialGraph` | Members, friendships, blocks, mutual friends |
| `Loader` | Reads `members.csv` and `activity.log` into a graph |
| `Recommender` | `recommend`, the "People you may know" ranking |
| `Suggestion` | One ranked suggestion: member id, mutual friends, shared interests |
| `Report` | Text views: network summary, friend lists, profile cards, suggestions |
| `ModelException`, `GraphException`, `LoadException` | A bad member record, a broken graph rule, a malformed export |

`src/Main.java` prints a support-desk view of the sample network.

Member ids are plain strings. `graph.friendsOf(userId)` returns a live,
read-only view of the member's friend ids, so nothing is copied. Join dates
are `LocalDate`s and interests are an unmodifiable set on each `User`.

## Running

The code uses only the JDK (Java 21). Run it from the project root, because
the sample data is read from `data/`.

```
javac -d out $(find src -name '*.java') && java -cp out Main
```

The tests in `tests/` are JUnit 5 classes:

```
javac -d out -cp junit-platform-console-standalone.jar $(find src tests -name '*.java')
java -jar junit-platform-console-standalone.jar execute --class-path out --scan-class-path
```
