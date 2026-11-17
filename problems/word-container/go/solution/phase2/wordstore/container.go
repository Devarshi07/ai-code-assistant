// WordContainer: the in-memory word store behind the crossword helper.
//
// Words live in a trie (prefix tree). Each node stands for a prefix, and a node
// is *terminal* when that prefix is itself a stored word. Every node also counts
// the stored words at or below it, so the autocomplete badge ("12 words start
// with 'tra'") costs one walk down the prefix instead of a scan.
//
//	(root) 3            stored words: cat, cart, cot
//	└─ c 3              numbers are counts, * marks a terminal node
//	   ├─ a 2
//	   │  ├─ r 1
//	   │  │  └─ t 1 *
//	   │  └─ t 1 *
//	   └─ o 1
//	      └─ t 1 *
//
// A node keeps its outgoing edges sorted by letter, so walking them in order
// gives alphabetical iteration for free.
//
// All public methods accept raw entries and normalise them first (see
// normalize.go), so "Café", "cafe" and " CAFE " are the same word.
package wordstore

import (
	"errors"
	"fmt"
	"math"
)

// NoLimit asks Match for every matching word.
const NoLimit = math.MaxInt

// ErrNegativeLimit is returned by Match when limit is below zero.
var ErrNegativeLimit = errors.New("limit must be zero or more")

type edge struct {
	letter byte
	node   *node
}

type node struct {
	edges    []edge // sorted by letter
	terminal bool   // true when the path to this node spells a stored word
	count    int    // stored words at or below this node
}

// child returns the node reached by letter, or nil.
func (n *node) child(letter byte) *node {
	for _, e := range n.edges {
		if e.letter == letter {
			return e.node
		}
	}
	return nil
}

// childOrNew returns the node reached by letter, creating it in sorted position.
func (n *node) childOrNew(letter byte) *node {
	at := 0
	for at < len(n.edges) && n.edges[at].letter < letter {
		at++
	}
	if at < len(n.edges) && n.edges[at].letter == letter {
		return n.edges[at].node
	}
	created := &node{}
	n.edges = append(n.edges, edge{})
	copy(n.edges[at+1:], n.edges[at:])
	n.edges[at] = edge{letter, created}
	return created
}

func (n *node) dropChild(letter byte) {
	for i, e := range n.edges {
		if e.letter == letter {
			n.edges = append(n.edges[:i], n.edges[i+1:]...)
			return
		}
	}
}

// WordContainer is a set of normalised words with prefix counts and
// alphabetical iteration.
type WordContainer struct {
	root *node
	size int
}

// New returns an empty container.
func New() *WordContainer {
	return &WordContainer{root: &node{}}
}

// Size is the number of stored words.
func (c *WordContainer) Size() int { return c.size }

// Has reports whether word is stored. Entries that cannot be normalised are
// never stored, so they are simply not found.
func (c *WordContainer) Has(word string) bool {
	key, err := NormalizeWord(word)
	if err != nil {
		return false
	}
	n := c.find(key)
	return n != nil && n.terminal
}

// Add stores an entry in normalised form.
// It returns true when the word is new and false when it was already stored,
// and an *InvalidWord error when the entry cannot be normalised.
func (c *WordContainer) Add(word string) (bool, error) {
	key, err := NormalizeWord(word)
	if err != nil {
		return false, err
	}
	path := []*node{c.root}
	for i := 0; i < len(key); i++ {
		path = append(path, path[len(path)-1].childOrNew(key[i]))
	}
	last := path[len(path)-1]
	if last.terminal {
		return false, nil
	}
	// Only a new word changes the counts along its path.
	last.terminal = true
	for _, n := range path {
		n.count++
	}
	c.size++
	return true, nil
}

// AddAll adds every entry and returns how many of them were new. It stops at
// the first entry that cannot be normalised.
func (c *WordContainer) AddAll(words []string) (int, error) {
	added := 0
	for _, word := range words {
		isNew, err := c.Add(word)
		if err != nil {
			return added, err
		}
		if isNew {
			added++
		}
	}
	return added, nil
}

// Remove deletes a word. It returns true if the word was stored, false otherwise.
func (c *WordContainer) Remove(word string) bool {
	key, err := NormalizeWord(word)
	if err != nil {
		return false
	}
	path := []*node{c.root}
	for i := 0; i < len(key); i++ {
		child := path[len(path)-1].child(key[i])
		if child == nil {
			return false
		}
		path = append(path, child)
	}
	last := path[len(path)-1]
	if !last.terminal {
		return false
	}
	last.terminal = false
	c.size--
	for _, n := range path {
		n.count--
	}
	// Drop the tail of the branch if no other word runs through it.
	for depth := len(key); depth > 0; depth-- {
		if path[depth].count != 0 {
			break
		}
		path[depth-1].dropChild(key[depth-1])
	}
	return true
}

// Count is the number of stored words that start with prefix ("" counts every word).
func (c *WordContainer) Count(prefix string) (int, error) {
	key, err := NormalizePrefix(prefix)
	if err != nil {
		return 0, err
	}
	if n := c.find(key); n != nil {
		return n.count, nil
	}
	return 0, nil
}

// Each calls visit for every stored word in alphabetical order, until visit
// returns false. Don't add or remove words from inside visit.
func (c *WordContainer) Each(visit func(word string) bool) {
	walk(c.root, nil, visit)
}

// Words lists every stored word in alphabetical order.
func (c *WordContainer) Words() []string {
	words := []string{}
	c.Each(func(word string) bool {
		words = append(words, word)
		return true
	})
	return words
}

// WithPrefix lists the stored words that start with prefix, in alphabetical order.
func (c *WordContainer) WithPrefix(prefix string) ([]string, error) {
	key, err := NormalizePrefix(prefix)
	if err != nil {
		return nil, err
	}
	words := []string{}
	if start := c.find(key); start != nil {
		walk(start, []byte(key), func(word string) bool {
			words = append(words, word)
			return true
		})
	}
	return words, nil
}

// walk visits the words at or below n in alphabetical order. buf holds the
// letters leading to n. It returns false once visit asked to stop.
func walk(n *node, buf []byte, visit func(word string) bool) bool {
	if n.terminal && !visit(string(buf)) {
		return false
	}
	for _, e := range n.edges {
		if !walk(e.node, append(buf, e.letter), visit) {
			return false
		}
	}
	return true
}

// Match returns the stored words that fit a crossword pattern such as "c?t" or
// "c?t*" (see pattern.go), in alphabetical order. See MatchPattern for limit.
func (c *WordContainer) Match(pattern string, limit int) ([]string, error) {
	parsed, err := ParsePattern(pattern)
	if err != nil {
		return nil, err
	}
	return c.MatchPattern(parsed, limit)
}

// MatchPattern returns the stored words that fit a parsed Pattern, in
// alphabetical order.
//
// With limit = NoLimit every match is returned; otherwise at most limit words,
// the alphabetically first ones. A negative limit returns ErrNegativeLimit.
func (c *WordContainer) MatchPattern(pattern *Pattern, limit int) ([]string, error) {
	if limit < 0 {
		return nil, ErrNegativeLimit
	}
	found := []string{}
	if limit == 0 {
		return found, nil
	}
	// Iteration is alphabetical, so the first limit matches are the answer.
	c.Each(func(word string) bool {
		if pattern.Matches(word) {
			found = append(found, word)
			if len(found) == limit {
				return false
			}
		}
		return true
	})
	return found, nil
}

// find returns the node for an already-normalised prefix, or nil.
func (c *WordContainer) find(key string) *node {
	n := c.root
	for i := 0; i < len(key); i++ {
		n = n.child(key[i])
		if n == nil {
			return nil
		}
	}
	return n
}

func (c *WordContainer) String() string {
	return fmt.Sprintf("WordContainer(%d words)", c.size)
}
