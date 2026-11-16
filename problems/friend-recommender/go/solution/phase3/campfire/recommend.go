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
//
// Only friends of friends can have a mutual friend, so instead of checking
// every member it walks two hops out from userID. The number of times a member
// is reached through an active friend is exactly their mutual count. The best
// k are kept in a small sorted slice instead of sorting every candidate.
// Cost per call: O(sum of the friends' friend counts + C * k).
func Recommend(g *SocialGraph, userID string, k int) ([]Suggestion, error) {
	me, err := g.User(userID)
	if err != nil {
		return nil, err // an unknown member
	}
	if k <= 0 {
		return nil, nil
	}
	myFriends := g.FriendsOf(userID)
	reached := make(map[string]int)
	for friend := range myFriends {
		if !g.users[friend].Active {
			continue
		}
		for candidate := range g.FriendsOf(friend) {
			reached[candidate]++
		}
	}

	var best []Suggestion
	for candidate, mutual := range reached {
		if candidate == userID || myFriends[candidate] {
			continue
		}
		other := g.users[candidate]
		if !other.Active || g.BlockedEither(userID, candidate) {
			continue
		}
		s := Suggestion{UserID: candidate, Mutual: mutual, Shared: SharedInterests(me, other)}
		if len(best) == k && compareSuggestions(s, best[k-1]) >= 0 {
			continue
		}
		i, _ := slices.BinarySearchFunc(best, s, compareSuggestions)
		best = slices.Insert(best, i, s)
		if len(best) > k {
			best = best[:k]
		}
	}
	return best, nil
}
