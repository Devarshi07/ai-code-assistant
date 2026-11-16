// Package campfire is the back end of the "People you may know" panel of
// Campfire, a small social network for local hobby clubs.
//
// Friendships are mutual: when Alice and Bob are friends, each one appears in
// the other's friend list. Blocks are one-directional (Carol can block Dave
// without Dave blocking Carol), but a block hides the two members from each
// other either way. Blocking someone also ends any friendship between the two.
package campfire

import (
	"fmt"
	"slices"
)

// GraphError reports an unknown member or an operation that would break the
// graph's rules.
type GraphError struct {
	Msg string
}

func (e *GraphError) Error() string { return e.Msg }

func graphErrorf(format string, args ...any) error {
	return &GraphError{Msg: fmt.Sprintf(format, args...)}
}

// SocialGraph holds Campfire's members, friendships and blocks. Create one
// with NewSocialGraph.
type SocialGraph struct {
	users   map[string]*User           // id -> member
	order   []*User                    // members in the order they were added
	friends map[string]map[string]bool // id -> set of friend ids
	blocked map[string]map[string]bool // id -> set of ids this member has blocked
}

// NewSocialGraph returns an empty graph.
func NewSocialGraph() *SocialGraph {
	return &SocialGraph{
		users:   make(map[string]*User),
		friends: make(map[string]map[string]bool),
		blocked: make(map[string]map[string]bool),
	}
}

// -- members ------------------------------------------------------------------

// AddUser adds a member. Member ids are unique.
func (g *SocialGraph) AddUser(u *User) error {
	if _, ok := g.users[u.ID]; ok {
		return graphErrorf("duplicate member %q", u.ID)
	}
	g.users[u.ID] = u
	g.order = append(g.order, u)
	g.friends[u.ID] = make(map[string]bool)
	g.blocked[u.ID] = make(map[string]bool)
	return nil
}

// User returns the member with the given id, or a *GraphError if there is none.
func (g *SocialGraph) User(id string) (*User, error) {
	u, ok := g.users[id]
	if !ok {
		return nil, graphErrorf("unknown member %q", id)
	}
	return u, nil
}

// Users returns every member, in the order they were added.
func (g *SocialGraph) Users() []*User {
	return slices.Clone(g.order)
}

// Has reports whether id is a member.
func (g *SocialGraph) Has(id string) bool {
	_, ok := g.users[id]
	return ok
}

// Len returns the number of members.
func (g *SocialGraph) Len() int {
	return len(g.users)
}

// Deactivate closes a member's account. Deactivated members keep their
// friendships but are never suggested.
func (g *SocialGraph) Deactivate(id string) error {
	u, err := g.User(id)
	if err != nil {
		return err
	}
	u.Active = false
	return nil
}

// -- friendships --------------------------------------------------------------

// AddFriendship makes a and b friends. It reports false if they already were.
func (g *SocialGraph) AddFriendship(a, b string) (bool, error) {
	if err := g.checkPair(a, b); err != nil {
		return false, err
	}
	if g.BlockedEither(a, b) {
		return false, graphErrorf("%q and %q cannot be friends: one has blocked the other", a, b)
	}
	if g.friends[a][b] {
		return false, nil
	}
	g.friends[a][b] = true
	g.friends[b][a] = true
	return true, nil
}

// RemoveFriendship ends the friendship between a and b. Either member may end
// it. It reports false if they were not friends.
func (g *SocialGraph) RemoveFriendship(a, b string) (bool, error) {
	if err := g.checkPair(a, b); err != nil {
		return false, err
	}
	friends := g.friends[a]
	if !friends[b] {
		return false, nil
	}
	delete(friends, b)
	return true, nil
}

// AreFriends reports whether b is in a's friend list.
func (g *SocialGraph) AreFriends(a, b string) bool {
	return g.friends[a][b]
}

// FriendsOf returns the live set of id's friend ids, or nil for an unknown
// member. Treat it as read-only.
func (g *SocialGraph) FriendsOf(id string) map[string]bool {
	return g.friends[id]
}

// FriendCount returns the length of id's friend list.
func (g *SocialGraph) FriendCount(id string) int {
	return len(g.friends[id])
}

// MutualFriends returns the sorted ids of the members who are friends with
// both a and b.
func (g *SocialGraph) MutualFriends(a, b string) []string {
	theirs := g.friends[b]
	var mutual []string
	for id := range g.friends[a] {
		if theirs[id] {
			mutual = append(mutual, id)
		}
	}
	slices.Sort(mutual)
	return mutual
}

// FriendshipCount returns the number of friendships, each counted once.
func (g *SocialGraph) FriendshipCount() int {
	total := 0
	for _, ids := range g.friends {
		total += len(ids)
	}
	return total / 2
}

// -- blocks -------------------------------------------------------------------

// Block records that blocker blocks blocked, ending any friendship between them.
func (g *SocialGraph) Block(blocker, blocked string) error {
	if err := g.checkPair(blocker, blocked); err != nil {
		return err
	}
	g.blocked[blocker][blocked] = true
	_, err := g.RemoveFriendship(blocker, blocked)
	return err
}

// Unblock lifts a block. A friendship that the block ended stays ended.
func (g *SocialGraph) Unblock(blocker, blocked string) error {
	if err := g.checkPair(blocker, blocked); err != nil {
		return err
	}
	delete(g.blocked[blocker], blocked)
	return nil
}

// HasBlocked reports whether blocker has blocked blocked.
func (g *SocialGraph) HasBlocked(blocker, blocked string) bool {
	return g.blocked[blocker][blocked]
}

// BlockedEither reports whether a has blocked b or b has blocked a.
func (g *SocialGraph) BlockedEither(a, b string) bool {
	return g.HasBlocked(a, b) || g.HasBlocked(b, a)
}

// BlockCount returns the number of blocks.
func (g *SocialGraph) BlockCount() int {
	total := 0
	for _, ids := range g.blocked {
		total += len(ids)
	}
	return total
}

func (g *SocialGraph) checkPair(a, b string) error {
	if _, err := g.User(a); err != nil {
		return err
	}
	if _, err := g.User(b); err != nil {
		return err
	}
	if a == b {
		return graphErrorf("%q cannot befriend or block themselves", a)
	}
	return nil
}
