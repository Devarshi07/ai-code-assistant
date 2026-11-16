// Plain-text views used by the CLI and the support desk.

package campfire

import (
	"fmt"
	"maps"
	"slices"
	"strings"
)

// Plural returns "1 friend" or "3 friends".
func Plural(count int, noun string) string {
	if count == 1 {
		return fmt.Sprintf("%d %s", count, noun)
	}
	return fmt.Sprintf("%d %ss", count, noun)
}

// NetworkSummary returns "18 members (1 deactivated), 32 friendships, 3 blocks".
func NetworkSummary(g *SocialGraph) string {
	members := g.Users()
	inactive := 0
	for _, u := range members {
		if !u.Active {
			inactive++
		}
	}
	return fmt.Sprintf("%s (%d deactivated), %s, %s", Plural(len(members), "member"), inactive,
		Plural(g.FriendshipCount(), "friendship"), Plural(g.BlockCount(), "block"))
}

// FriendList returns "Alice Moreno (@alice) has 2 friends: Carol Lindqvist, Erin Walsh".
func FriendList(g *SocialGraph, userID string) (string, error) {
	user, err := g.User(userID)
	if err != nil {
		return "", err
	}
	var names []string
	for id := range g.FriendsOf(userID) {
		names = append(names, g.users[id].Name)
	}
	slices.Sort(names)
	listing := "nobody yet"
	if len(names) > 0 {
		listing = strings.Join(names, ", ")
	}
	return fmt.Sprintf("%s has %s: %s", user, Plural(len(names), "friend"), listing), nil
}

// ProfileCard shows how userID's profile looks to viewerID.
func ProfileCard(g *SocialGraph, viewerID, userID string) (string, error) {
	user, err := g.User(userID)
	if err != nil {
		return "", err
	}
	viewer, err := g.User(viewerID)
	if err != nil {
		return "", err
	}
	lines := []string{user.String(), "  member since " + user.MemberSince()}
	if len(user.Interests) > 0 {
		lines = append(lines, "  into "+strings.Join(slices.Sorted(maps.Keys(user.Interests)), ", "))
	}
	lines = append(lines, "  "+Plural(g.FriendCount(userID), "friend"))
	if viewerID != userID {
		if mutual := g.MutualFriends(viewerID, userID); len(mutual) > 0 {
			names := make([]string, len(mutual))
			for i, id := range mutual {
				names[i] = g.users[id].FirstName()
			}
			lines = append(lines, fmt.Sprintf("  %s with %s: %s",
				Plural(len(mutual), "mutual friend"), viewer.FirstName(), strings.Join(names, ", ")))
		}
	}
	if !user.Active {
		lines = append(lines, "  (account deactivated)")
	}
	return strings.Join(lines, "\n"), nil
}

// SuggestionLines renders the "People you may know" panel as text.
func SuggestionLines(g *SocialGraph, userID string, suggestions []Suggestion) (string, error) {
	user, err := g.User(userID)
	if err != nil {
		return "", err
	}
	title := fmt.Sprintf("People %s may know:", user.FirstName())
	if len(suggestions) == 0 {
		return title + " no suggestions yet", nil
	}
	lines := []string{title}
	for i, s := range suggestions {
		other, err := g.User(s.UserID)
		if err != nil {
			return "", err
		}
		lines = append(lines, fmt.Sprintf("  %d. %s  %s, %s", i+1, other,
			Plural(s.Mutual, "mutual friend"), Plural(s.Shared, "shared interest")))
	}
	return strings.Join(lines, "\n"), nil
}
