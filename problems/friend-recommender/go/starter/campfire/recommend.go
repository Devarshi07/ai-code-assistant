// "People you may know": friend suggestions for a member.
//
// Suggestions are friends of friends. A member is never suggested to
// themselves, to their existing friends, to anyone they have blocked or been
// blocked by, or at all once their account is deactivated.

package campfire

import "errors"

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

// Recommend returns up to k friend suggestions for userID, best first, ranked
// by mutual friends, then shared interests, then member id.
func Recommend(g *SocialGraph, userID string, k int) ([]Suggestion, error) {
	return nil, errors.New("phase 2: Recommend is not implemented yet")
}
