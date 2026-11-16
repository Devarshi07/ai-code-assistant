package tests

import (
	"errors"
	"maps"
	"slices"
	"strings"
	"testing"
	"time"

	"debuggym/friend-recommender/campfire"
)

// The helpers in this file are shared by the later phase test files.

// makeGraph returns a graph with one member per id and no friendships.
func makeGraph(t *testing.T, ids ...string) *campfire.SocialGraph {
	t.Helper()
	g := campfire.NewSocialGraph()
	for _, id := range ids {
		addMember(t, g, id, time.Date(2022, 5, 1, 0, 0, 0, 0, time.UTC))
	}
	return g
}

// addMember adds a member named after their id ("ana" is "Ana").
func addMember(t *testing.T, g *campfire.SocialGraph, id string, joined time.Time, interests ...string) {
	t.Helper()
	u, err := campfire.NewUser(id, strings.ToUpper(id[:1])+id[1:], joined, interests)
	if err == nil {
		err = g.AddUser(u)
	}
	if err != nil {
		t.Fatal(err)
	}
}

// mustFriend makes a and b friends and fails the test on an error.
func mustFriend(t *testing.T, g *campfire.SocialGraph, a, b string) {
	t.Helper()
	if _, err := g.AddFriendship(a, b); err != nil {
		t.Fatal(err)
	}
}

func mustUser(t *testing.T, g *campfire.SocialGraph, id string) *campfire.User {
	t.Helper()
	u, err := g.User(id)
	if err != nil {
		t.Fatal(err)
	}
	return u
}

func loadSample(t *testing.T) *campfire.SocialGraph {
	t.Helper()
	g, err := campfire.LoadSample("../data")
	if err != nil {
		t.Fatal(err)
	}
	return g
}

// friendsOf returns id's friends, sorted.
func friendsOf(g *campfire.SocialGraph, id string) []string {
	return slices.Sorted(maps.Keys(g.FriendsOf(id)))
}

// expectList fails the test unless got and want hold the same items in the same order.
func expectList[T comparable](t *testing.T, what string, got, want []T) {
	t.Helper()
	if !slices.Equal(got, want) {
		t.Errorf("%s = %v, want %v", what, got, want)
	}
}

// -- friendships --------------------------------------------------------------

func TestPhase1FriendshipIsMutual(t *testing.T) {
	g := makeGraph(t, "alice", "bob")
	if added, err := g.AddFriendship("alice", "bob"); !added || err != nil {
		t.Fatalf("AddFriendship(alice, bob) = %v, %v; want true, nil", added, err)
	}
	expectList(t, "alice's friends", friendsOf(g, "alice"), []string{"bob"})
	expectList(t, "bob's friends", friendsOf(g, "bob"), []string{"alice"})
	if !g.AreFriends("bob", "alice") {
		t.Error("AreFriends(bob, alice) = false, want true")
	}
}

func TestPhase1AddingAFriendshipTwiceIsHarmless(t *testing.T) {
	g := makeGraph(t, "alice", "bob")
	mustFriend(t, g, "alice", "bob")
	if added, err := g.AddFriendship("bob", "alice"); added || err != nil {
		t.Errorf("AddFriendship(bob, alice) again = %v, %v; want false, nil", added, err)
	}
	if n := g.FriendCount("alice"); n != 1 {
		t.Errorf("FriendCount(alice) = %d, want 1", n)
	}
	if n := g.FriendshipCount(); n != 1 {
		t.Errorf("FriendshipCount() = %d, want 1", n)
	}
}

func TestPhase1MembersCannotBefriendThemselves(t *testing.T) {
	g := makeGraph(t, "alice")
	_, err := g.AddFriendship("alice", "alice")
	var graphErr *campfire.GraphError
	if !errors.As(err, &graphErr) {
		t.Errorf("AddFriendship(alice, alice) error = %v, want a *GraphError", err)
	}
}

func TestPhase1UnfriendingClearsBothFriendLists(t *testing.T) {
	g := makeGraph(t, "alice", "bob", "carol")
	mustFriend(t, g, "alice", "bob")
	mustFriend(t, g, "alice", "carol")
	if removed, err := g.RemoveFriendship("bob", "alice"); !removed || err != nil {
		t.Fatalf("RemoveFriendship(bob, alice) = %v, %v; want true, nil", removed, err)
	}
	expectList(t, "bob's friends", friendsOf(g, "bob"), nil)
	expectList(t, "alice's friends (Bob unfriended Alice, so he must leave her list too)", friendsOf(g, "alice"), []string{"carol"})
	if g.AreFriends("alice", "bob") {
		t.Error("AreFriends(alice, bob) = true, want false")
	}
}

func TestPhase1FriendingAgainAfterAnUnfriend(t *testing.T) {
	g := makeGraph(t, "alice", "bob")
	mustFriend(t, g, "alice", "bob")
	if _, err := g.RemoveFriendship("bob", "alice"); err != nil {
		t.Fatal(err)
	}
	if added, err := g.AddFriendship("alice", "bob"); !added || err != nil {
		t.Errorf("AddFriendship(alice, bob) = %v, %v; want true, nil: they were no longer friends", added, err)
	}
	expectList(t, "alice's friends", friendsOf(g, "alice"), []string{"bob"})
	expectList(t, "bob's friends", friendsOf(g, "bob"), []string{"alice"})
}

func TestPhase1MutualFriendsSkipEndedFriendships(t *testing.T) {
	g := makeGraph(t, "alice", "bob", "carol", "erin")
	for _, pair := range [][2]string{{"alice", "bob"}, {"alice", "carol"}, {"erin", "bob"}, {"erin", "carol"}} {
		mustFriend(t, g, pair[0], pair[1])
	}
	expectList(t, "MutualFriends(erin, alice)", g.MutualFriends("erin", "alice"), []string{"bob", "carol"})
	if _, err := g.RemoveFriendship("bob", "alice"); err != nil {
		t.Fatal(err)
	}
	expectList(t, "MutualFriends(erin, alice) after the unfriend", g.MutualFriends("erin", "alice"), []string{"carol"})
	expectList(t, "MutualFriends(alice, erin) after the unfriend", g.MutualFriends("alice", "erin"), []string{"carol"})
}

// -- blocks -------------------------------------------------------------------

func TestPhase1BlocksAreOneDirectional(t *testing.T) {
	g := makeGraph(t, "carol", "dave")
	if err := g.Block("carol", "dave"); err != nil {
		t.Fatal(err)
	}
	if !g.HasBlocked("carol", "dave") {
		t.Error("HasBlocked(carol, dave) = false, want true")
	}
	if g.HasBlocked("dave", "carol") {
		t.Error("HasBlocked(dave, carol) = true, want false")
	}
	if !g.BlockedEither("dave", "carol") {
		t.Error("BlockedEither(dave, carol) = false, want true")
	}
}

func TestPhase1BlockedMembersCannotBecomeFriends(t *testing.T) {
	g := makeGraph(t, "carol", "dave")
	if err := g.Block("dave", "carol"); err != nil {
		t.Fatal(err)
	}
	_, err := g.AddFriendship("carol", "dave")
	var graphErr *campfire.GraphError
	if !errors.As(err, &graphErr) {
		t.Errorf("AddFriendship(carol, dave) error = %v, want a *GraphError", err)
	}
}

func TestPhase1BlockingAFriendEndsTheFriendshipForBoth(t *testing.T) {
	g := makeGraph(t, "judy", "peggy", "rupert")
	mustFriend(t, g, "judy", "peggy")
	mustFriend(t, g, "peggy", "rupert")
	if err := g.Block("judy", "peggy"); err != nil {
		t.Fatal(err)
	}
	expectList(t, "judy's friends", friendsOf(g, "judy"), nil)
	expectList(t, "peggy's friends (Judy blocked Peggy, so she must leave Peggy's list)", friendsOf(g, "peggy"), []string{"rupert"})
}

func TestPhase1UnblockingDoesNotRestoreTheFriendship(t *testing.T) {
	g := makeGraph(t, "frank", "heidi")
	mustFriend(t, g, "frank", "heidi")
	if err := g.Block("heidi", "frank"); err != nil {
		t.Fatal(err)
	}
	if err := g.Unblock("heidi", "frank"); err != nil {
		t.Fatal(err)
	}
	if g.BlockedEither("frank", "heidi") {
		t.Error("BlockedEither(frank, heidi) = true after the unblock, want false")
	}
	if g.AreFriends("frank", "heidi") {
		t.Error("AreFriends(frank, heidi) = true, want false")
	}
	if g.AreFriends("heidi", "frank") {
		t.Error("AreFriends(heidi, frank) = true, want false")
	}
}

// -- loader -------------------------------------------------------------------

func TestPhase1MembersCSVReadsNamesDatesAndInterests(t *testing.T) {
	g := campfire.NewSocialGraph()
	err := campfire.LoadMembersCSV(g, "id,name,joined,interests\n"+
		"dana,\"Dana Park, PhD\",2021-11-30,Board Games; jazz\n"+
		"eli,Eli Stone,2022-01-02,\n", "members.csv")
	if err != nil {
		t.Fatal(err)
	}
	dana := mustUser(t, g, "dana")
	if dana.Name != "Dana Park, PhD" {
		t.Errorf("dana's name = %q, want %q", dana.Name, "Dana Park, PhD")
	}
	if want := time.Date(2021, 11, 30, 0, 0, 0, 0, time.UTC); !dana.Joined.Equal(want) {
		t.Errorf("dana joined %v, want %v", dana.Joined, want)
	}
	expectList(t, "dana's interests", slices.Sorted(maps.Keys(dana.Interests)), []string{"board-games", "jazz"})
	if eli := mustUser(t, g, "eli"); len(eli.Interests) != 0 {
		t.Errorf("eli's interests = %v, want none", eli.Interests)
	}
}

func TestPhase1ActivityErrorsNameTheLine(t *testing.T) {
	g := makeGraph(t, "alice", "bob")
	_, err := campfire.ApplyActivity(g, "# header\nfriend alice bob\n\nfriend alice zoe\n", "activity.log")
	var loadErr *campfire.LoadError
	if !errors.As(err, &loadErr) || !strings.Contains(err.Error(), "line 4") {
		t.Errorf("ApplyActivity error = %v, want a *LoadError that names line 4", err)
	}
}

func TestPhase1SampleFriendLists(t *testing.T) {
	g := loadSample(t)
	for _, c := range []struct{ id, want string }{
		{"bob", "Bob Okafor (@bob) has 3 friends: Dave Ferreira, Erin Walsh, Ivan Petrov"},
		{"alice", "Alice Moreno (@alice) has 3 friends: Carol Lindqvist, Erin Walsh, Grace Kim"},
		{"peggy", "Peggy Sousa (@peggy) has 1 friend: Rupert Hale"},
		{"frank", "Frank Osei (@frank) has 2 friends: Carol Lindqvist, Mallory Quinn"},
	} {
		if got, err := campfire.FriendList(g, c.id); got != c.want || err != nil {
			t.Errorf("FriendList(%s) = %q, %v\nwant %q", c.id, got, err, c.want)
		}
	}
}

func TestPhase1SampleFriendListsAgreeBothWays(t *testing.T) {
	g := loadSample(t)
	for _, u := range g.Users() {
		for _, friend := range friendsOf(g, u.ID) {
			if !g.AreFriends(friend, u.ID) {
				t.Errorf("%s lists %s as a friend, but %s does not list %s", u.ID, friend, friend, u.ID)
			}
		}
	}
}

func TestPhase1SampleSummaryAndProfile(t *testing.T) {
	g := loadSample(t)
	if got, want := campfire.NetworkSummary(g), "18 members (1 deactivated), 28 friendships, 2 blocks"; got != want {
		t.Errorf("NetworkSummary = %q, want %q", got, want)
	}
	card, err := campfire.ProfileCard(g, "erin", "alice")
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"  3 friends", "2 mutual friends with Erin: Carol, Grace"} {
		if !strings.Contains(card, want) {
			t.Errorf("profile card is missing %q:\n%s", want, card)
		}
	}
}
