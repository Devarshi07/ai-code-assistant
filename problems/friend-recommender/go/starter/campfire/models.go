// Member records and the small parsing helpers shared by the loaders.

package campfire

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

var idPattern = regexp.MustCompile(`^[a-z][a-z0-9_]{1,31}$`)

// ModelError reports a malformed member record.
type ModelError struct {
	Msg string
}

func (e *ModelError) Error() string { return e.Msg }

// User is one Campfire member. Members are identified by their handle, ID.
type User struct {
	ID        string
	Name      string
	Joined    time.Time
	Interests map[string]bool // the member's interest tags, as a set
	Active    bool            // false once the account is deactivated
}

// NewUser validates a member record and returns an active member.
func NewUser(id, name string, joined time.Time, interests []string) (*User, error) {
	if err := CheckID(id); err != nil {
		return nil, err
	}
	if strings.TrimSpace(name) == "" {
		return nil, &ModelError{Msg: fmt.Sprintf("%s: name must not be empty", id)}
	}
	set := make(map[string]bool, len(interests))
	for _, tag := range interests {
		set[tag] = true
	}
	return &User{ID: id, Name: name, Joined: joined, Interests: set, Active: true}, nil
}

// FirstName returns the first word of the member's name.
func (u *User) FirstName() string {
	if fields := strings.Fields(u.Name); len(fields) > 0 {
		return fields[0]
	}
	return u.Name
}

// MemberSince formats the join date like "Apr 2019".
func (u *User) MemberSince() string {
	return u.Joined.Format("Jan 2006")
}

// String returns "Alice Moreno (@alice)".
func (u *User) String() string {
	return fmt.Sprintf("%s (@%s)", u.Name, u.ID)
}

// CheckID returns a *ModelError unless id is a valid Campfire handle.
func CheckID(id string) error {
	if !idPattern.MatchString(id) {
		return &ModelError{Msg: fmt.Sprintf("invalid member id %q", id)}
	}
	return nil
}

// NormalizeInterest turns "  Board Games " into "board-games".
func NormalizeInterest(tag string) string {
	return strings.Join(strings.Fields(strings.ToLower(tag)), "-")
}

// ParseInterests parses a ';'-separated interest list into normalized tags.
func ParseInterests(text string) []string {
	var tags []string
	for _, tag := range strings.Split(text, ";") {
		if strings.TrimSpace(tag) != "" {
			tags = append(tags, NormalizeInterest(tag))
		}
	}
	return tags
}

// ParseDate parses a YYYY-MM-DD date from an export.
func ParseDate(text string) (time.Time, error) {
	date, err := time.Parse(time.DateOnly, strings.TrimSpace(text))
	if err != nil {
		return time.Time{}, &ModelError{Msg: fmt.Sprintf("invalid date %q; expected YYYY-MM-DD", text)}
	}
	return date, nil
}
