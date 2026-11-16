package tests

import (
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"testing"
	"time"

	"debuggym/friend-recommender/campfire"
)

// A reading club. Ana is friends with Ben, Cai and Dev; Ben and Cai are also
// friends with each other. Members are added out of alphabetical order on purpose.
var clubMembers = []struct {
	id        string
	interests []string
}{
	{"ana", []string{"jazz", "film", "chess"}},
	{"ben", []string{"film"}},
	{"cai", []string{"jazz"}},
	{"dev", []string{"poetry"}},
	{"ida", []string{"chess"}},
	{"eve", nil},
	{"kim", []string{"film", "chess"}},
	{"gus", []string{"jazz", "film"}},
	{"fay", []string{"jazz"}},
	{"hal", []string{"chess"}},
	{"jon", []string{"jazz", "film", "chess"}},
	{"zed", []string{"jazz"}},
}

var clubFriendships = [][2]string{
	{"ana", "ben"}, {"ana", "cai"}, {"ana", "dev"}, {"ben", "cai"},
	{"eve", "ben"}, {"eve", "cai"}, {"eve", "dev"},
	{"fay", "ben"}, {"fay", "cai"},
	{"gus", "ben"}, {"gus", "dev"},
	{"hal", "cai"}, {"kim", "cai"}, {"ida", "dev"},
	{"jon", "eve"},
}

// club builds the reading club, then applies the blocks ({blocker, blocked})
// and deactivates the inactive members.
func club(t *testing.T, blocks [][2]string, inactive ...string) *campfire.SocialGraph {
	t.Helper()
	g := campfire.NewSocialGraph()
	for _, m := range clubMembers {
		addMember(t, g, m.id, time.Date(2023, 3, 1, 0, 0, 0, 0, time.UTC), m.interests...)
	}
	for _, pair := range clubFriendships {
		mustFriend(t, g, pair[0], pair[1])
	}
	for _, b := range blocks {
		if err := g.Block(b[0], b[1]); err != nil {
			t.Fatal(err)
		}
	}
	for _, id := range inactive {
		if err := g.Deactivate(id); err != nil {
			t.Fatal(err)
		}
	}
	return g
}

// The helpers below are shared with phase3_test.go.

// mustRecommend calls Recommend and fails the test if it returns an error.
func mustRecommend(t *testing.T, g *campfire.SocialGraph, userID string, k int) []campfire.Suggestion {
	t.Helper()
	got, err := campfire.Recommend(g, userID, k)
	if err != nil {
		t.Fatalf("Recommend(%s, %d): %v", userID, k, err)
	}
	return got
}

// sg is shorthand for a campfire.Suggestion.
func sg(userID string, mutual, shared int) campfire.Suggestion {
	return campfire.Suggestion{UserID: userID, Mutual: mutual, Shared: shared}
}

func suggestionIDs(suggestions []campfire.Suggestion) []string {
	ids := make([]string, len(suggestions))
	for i, s := range suggestions {
		ids[i] = s.UserID
	}
	return ids
}

// checkValid checks that every suggestion obeys the rules and that the list is
// in ranking order. It stops the test at the first problem.
func checkValid(t *testing.T, g *campfire.SocialGraph, userID string, suggestions []campfire.Suggestion, k int) {
	t.Helper()
	me := mustUser(t, g, userID)
	if len(suggestions) > max(k, 0) {
		t.Fatalf("%d suggestions for %s, want at most %d", len(suggestions), userID, k)
	}
	seen := make(map[string]bool)
	for _, s := range suggestions {
		other, err := g.User(s.UserID)
		if err != nil {
			t.Fatalf("suggestion for %s: %v", userID, err)
		}
		if seen[s.UserID] {
			t.Fatalf("duplicate suggestion %s for %s", s.UserID, userID)
		}
		seen[s.UserID] = true
		if s.UserID == userID {
			t.Fatalf("%s was suggested to themselves; never suggest members to themselves", userID)
		}
		if g.AreFriends(userID, s.UserID) {
			t.Fatalf("%s is already a friend of %s", s.UserID, userID)
		}
		if !other.Active {
			t.Fatalf("%s is deactivated", s.UserID)
		}
		if g.HasBlocked(userID, s.UserID) || g.HasBlocked(s.UserID, userID) {
			t.Fatalf("%s and %s are blocked", s.UserID, userID)
		}
		mutual := 0
		for _, f := range friendsOf(g, userID) {
			if mustUser(t, g, f).Active && g.AreFriends(f, s.UserID) {
				mutual++
			}
		}
		if s.Mutual != mutual || s.Mutual <= 0 {
			t.Fatalf("mutual count for %s = %d, want %d (and more than 0)", s.UserID, s.Mutual, mutual)
		}
		shared := 0
		for tag := range me.Interests {
			if other.Interests[tag] {
				shared++
			}
		}
		if s.Shared != shared {
			t.Fatalf("shared interests for %s = %d, want %d", s.UserID, s.Shared, shared)
		}
	}
	for i := 1; i < len(suggestions); i++ {
		a, b := suggestions[i-1], suggestions[i]
		inOrder := a.Mutual > b.Mutual || (a.Mutual == b.Mutual && (a.Shared > b.Shared || (a.Shared == b.Shared && a.UserID < b.UserID)))
		if !inOrder {
			t.Fatalf("%s must not be ranked above %s", a.UserID, b.UserID)
		}
	}
}

// -- recommend ----------------------------------------------------------------

func TestPhase2RanksFriendsOfFriendsByMutualFriends(t *testing.T) {
	g := club(t, nil)
	got := mustRecommend(t, g, "ana", 10)
	top := suggestionIDs(got)[:min(3, len(got))]
	expectList(t, "top 3 for ana", top, []string{"eve", "gus", "fay"})
	if len(got) == 0 || got[0] != sg("eve", 3, 0) {
		t.Fatalf("first suggestion for ana: got %v, want %v", got, sg("eve", 3, 0))
	}
	checkValid(t, g, "ana", got, 10)
}

func TestPhase2TiesBreakOnSharedInterestsThenID(t *testing.T) {
	expectList(t, "Recommend(ana, 10)", mustRecommend(t, club(t, nil), "ana", 10), []campfire.Suggestion{
		sg("eve", 3, 0), sg("gus", 2, 2), sg("fay", 2, 1),
		sg("kim", 1, 2), sg("hal", 1, 1), sg("ida", 1, 1),
	})
}

func TestPhase2KLimitsTheList(t *testing.T) {
	g := club(t, nil)
	expectList(t, "Recommend(ana, 2)", mustRecommend(t, g, "ana", 2), []campfire.Suggestion{sg("eve", 3, 0), sg("gus", 2, 2)})
	if got := mustRecommend(t, g, "ana", 0); len(got) != 0 {
		t.Errorf("Recommend(ana, 0) = %v, want none", got)
	}
	if got := mustRecommend(t, g, "ana", 50); len(got) != 6 {
		t.Errorf("Recommend(ana, 50) returned %d suggestions, want 6", len(got))
	}
	if got := mustRecommend(t, g, "ana", campfire.DefaultK); len(got) != 5 {
		t.Errorf("Recommend(ana, DefaultK) returned %d suggestions, want 5: k defaults to 5", len(got))
	}
}

func TestPhase2SelfAndExistingFriendsAreNeverSuggested(t *testing.T) {
	g := club(t, nil)
	got := mustRecommend(t, g, "ben", 10)
	expectList(t, "Recommend(ben, 10)", got, []campfire.Suggestion{sg("dev", 3, 0), sg("jon", 1, 1), sg("kim", 1, 1), sg("hal", 1, 0)})
	checkValid(t, g, "ben", got, 10)
}

func TestPhase2MembersWithoutMutualFriendsAreNotSuggested(t *testing.T) {
	g := club(t, nil)
	if ids := suggestionIDs(mustRecommend(t, g, "ana", 50)); slices.Contains(ids, "jon") {
		t.Errorf("jon has no mutual friends with ana but was suggested: %v", ids)
	}
	if got := mustRecommend(t, g, "zed", 5); len(got) != 0 {
		t.Errorf("Recommend(zed, 5) = %v, want none: zed has no friends yet", got)
	}
}

func TestPhase2BlocksHideMembersInBothDirections(t *testing.T) {
	g := club(t, [][2]string{{"ana", "gus"}, {"fay", "ana"}})
	expectList(t, "Recommend(ana, 10)", mustRecommend(t, g, "ana", 10), []campfire.Suggestion{sg("eve", 3, 0), sg("kim", 1, 2), sg("hal", 1, 1), sg("ida", 1, 1)})
	for _, id := range []string{"fay", "gus"} {
		if ids := suggestionIDs(mustRecommend(t, g, id, 10)); slices.Contains(ids, "ana") {
			t.Errorf("ana was suggested to %s across a block: %v", id, ids)
		}
	}
}

func TestPhase2DeactivatedMembersAreNotSuggestedOrCounted(t *testing.T) {
	g := club(t, nil, "eve", "dev")
	got := mustRecommend(t, g, "ana", 10)
	expectList(t, "Recommend(ana, 10)", got, []campfire.Suggestion{sg("fay", 2, 1), sg("gus", 1, 2), sg("kim", 1, 2), sg("hal", 1, 1)})
	checkValid(t, g, "ana", got, 10)
}

func TestPhase2UnknownMemberReturnsAnError(t *testing.T) {
	_, err := campfire.Recommend(club(t, nil), "nobody", 3)
	var graphErr *campfire.GraphError
	if !errors.As(err, &graphErr) {
		t.Errorf("Recommend(nobody, 3) error = %v, want a *GraphError", err)
	}
}

func TestPhase2RecommendDoesNotChangeTheGraph(t *testing.T) {
	g := club(t, [][2]string{{"fay", "ana"}}, "dev")
	snapshot := func() []string {
		var rows []string
		for _, u := range g.Users() {
			rows = append(rows, fmt.Sprintf("%s %s %t", u.ID, strings.Join(slices.Sorted(maps.Keys(g.FriendsOf(u.ID))), ","), u.Active))
		}
		return rows
	}
	before := snapshot()
	for _, u := range g.Users() {
		mustRecommend(t, g, u.ID, 3)
	}
	expectList(t, "the graph after Recommend", snapshot(), before)
	if !g.HasBlocked("fay", "ana") {
		t.Error("fay's block on ana is gone")
	}
}

// -- sample network -----------------------------------------------------------

func TestPhase2SampleSuggestions(t *testing.T) {
	g := loadSample(t)
	expectList(t, "Recommend(alice, 3)", mustRecommend(t, g, "alice", 3), []campfire.Suggestion{sg("judy", 3, 2), sg("olivia", 2, 2), sg("trent", 1, 2)})
	expectList(t, "Recommend(olivia, 10)", mustRecommend(t, g, "olivia", 10), []campfire.Suggestion{
		sg("alice", 2, 2), sg("carol", 2, 1), sg("judy", 2, 1), sg("victor", 2, 1), sg("bob", 1, 1), sg("ivan", 1, 1),
	})
}

func TestPhase2SampleRespectsDeactivatedAccounts(t *testing.T) {
	g := loadSample(t)
	expectList(t, "Recommend(dave, 10)", mustRecommend(t, g, "dave", 10), []campfire.Suggestion{sg("erin", 1, 1), sg("sybil", 1, 1), sg("heidi", 1, 0), sg("mallory", 1, 0)})
	expectList(t, "Recommend(niaj, 10)", mustRecommend(t, g, "niaj", 10), []campfire.Suggestion{sg("bob", 1, 2), sg("ivan", 1, 1)})
	if got := mustRecommend(t, g, "peggy", 10); len(got) != 0 {
		t.Errorf("Recommend(peggy, 10) = %v, want none", got)
	}
}

func TestPhase2EverySampleListFollowsTheRules(t *testing.T) {
	g := loadSample(t)
	for _, u := range g.Users() {
		checkValid(t, g, u.ID, mustRecommend(t, g, u.ID, 4), 4)
	}
}
