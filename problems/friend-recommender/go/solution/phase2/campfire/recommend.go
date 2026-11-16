// "People you may know": friend suggestions for a member.
//
// Suggestions are friends of friends. A member is never suggested to
// themselves, to their existing friends, to anyone they have blocked or been
// blocked by, or at all once their account is deactivated.

package campfire

import (
	"cmp"
	"slices"
	"strings"
)

// DefaultK is how many suggestions the panel asks for.
const DefaultK = 5

// Suggestion is one entry of the "People you may know" panel.
type Suggestion struct {
	UserID string // the suggested member
	Mutual int    // active friends the two members have in common
	Shared int    // interests the two members have in common
}

// SharedInterests returns the number of interests a and b have in common.
func SharedInterests(a, b *User) int {
	count := 0
	for tag := range a.Interests {
		if b.Interests[tag] {
			count++
		}
	}
	return count
}

// compareSuggestions orders by more mutual friends, then more shared
// interests, then id ascending.
func compareSuggestions(x, y Suggestion) int {
	return cmp.Or(
		cmp.Compare(y.Mutual, x.Mutual),
		cmp.Compare(y.Shared, x.Shared),
		strings.Compare(x.UserID, y.UserID),
	)
}

// Recommend returns up to k friend suggestions for userID, best first, ranked
// by mutual friends, then shared interests, then member id.
// It checks every member of the network: O(V * d) per call.
func Recommend(g *SocialGraph, userID string, k int) ([]Suggestion, error) {
	me, err := g.User(userID)
	if err != nil {
		return nil, err // an unknown member
	}
	if k <= 0 {
		return nil, nil
	}
	myFriends := g.FriendsOf(userID)
	var activeFriends []string
	for id := range myFriends {
		if g.users[id].Active {
			activeFriends = append(activeFriends, id)
		}
	}
	var suggestions []Suggestion
	for _, other := range g.Users() {
		candidate := other.ID
		if candidate == userID || myFriends[candidate] || !other.Active {
			continue
		}
		if g.BlockedEither(userID, candidate) {
			continue
		}
		theirs := g.FriendsOf(candidate)
		mutual := 0
		for _, friend := range activeFriends {
			if theirs[friend] {
				mutual++
			}
		}
		if mutual > 0 {
			suggestions = append(suggestions, Suggestion{UserID: candidate, Mutual: mutual, Shared: SharedInterests(me, other)})
		}
	}
	slices.SortFunc(suggestions, compareSuggestions)
	if len(suggestions) > k {
		suggestions = suggestions[:k]
	}
	return suggestions, nil
}
