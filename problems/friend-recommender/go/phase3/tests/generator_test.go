package tests

// Seeded generator for large Campfire-like networks.
//
// Members belong to clubs of clubSize consecutive ids and make most of their
// friends inside their club, so friends of friends overlap the way they do in
// real communities. A few organisers have hundreds of friends across the whole
// network. The generator uses a Park-Miller random number generator so the
// copies of this file in the other languages build exactly the same network.

import (
	"fmt"
	"time"

	"debuggym/friend-recommender/campfire"
)

var interestTags = []string{"climbing", "jazz", "film", "cooking", "cycling", "photography", "board-games",
	"running", "chess", "gardening", "poetry", "baking", "hiking", "anime", "knitting",
	"surfing", "podcasts", "yoga", "sci-fi", "vinyl", "pottery", "birding", "coding", "dance"}

const (
	friendPicks = 7  // friend picks per member
	clubSize    = 50 // members per club
	localPct    = 85 // percent of picks made inside the member's club
)

// parkMiller is the "minimal standard" random number generator.
type parkMiller struct{ state int64 }

func newParkMiller(seed int64) *parkMiller {
	state := seed % 2147483647
	if state == 0 {
		state = 1
	}
	return &parkMiller{state: state}
}

// below returns a pseudo-random integer in [0, n).
func (r *parkMiller) below(n int) int {
	r.state = r.state * 48271 % 2147483647 // exact: the product stays below 2^63
	return int(r.state % int64(n))
}

// memberID turns 12 into "m00012".
func memberID(index int) string {
	return fmt.Sprintf("m%05d", index)
}

// networkExtras are the parts of a generated network beyond its clubs.
type networkExtras struct {
	organisers int // members who befriend people all over the network
	reach      int // friend picks per organiser
	blocks     int // block attempts between friends of friends
	inactive   int // deactivation picks
}

func buildNetwork(seed int64, size int, extras networkExtras) (*campfire.SocialGraph, error) {
	rng := newParkMiller(seed)
	g := campfire.NewSocialGraph()
	joined := time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC)
	ids := make([]string, size)
	for i := range size {
		ids[i] = memberID(i)
		tags := make([]string, 3)
		for j := range tags {
			tags[j] = interestTags[rng.below(len(interestTags))]
		}
		u, err := campfire.NewUser(ids[i], fmt.Sprintf("Member %d", i), joined, tags)
		if err == nil {
			err = g.AddUser(u)
		}
		if err != nil {
			return nil, err
		}
	}

	links := make([][]int, size)
	link := func(a, b int) error {
		if a == b {
			return nil
		}
		added, err := g.AddFriendship(ids[a], ids[b])
		if added {
			links[a] = append(links[a], b)
			links[b] = append(links[b], a)
		}
		return err
	}

	for i := range size {
		start := i - i%clubSize
		span := min(clubSize, size-start)
		for range friendPicks {
			var err error
			if rng.below(100) < localPct {
				err = link(i, start+rng.below(span))
			} else {
				err = link(i, rng.below(size))
			}
			if err != nil {
				return nil, err
			}
		}
	}
	for range extras.organisers {
		hub := rng.below(size)
		for range extras.reach {
			if err := link(hub, rng.below(size)); err != nil {
				return nil, err
			}
		}
	}
	for range extras.blocks {
		a := rng.below(size)
		if len(links[a]) == 0 {
			continue
		}
		via := links[a][rng.below(len(links[a]))]
		c := links[via][rng.below(len(links[via]))]
		if c != a {
			var err error
			if rng.below(2) == 1 {
				err = g.Block(ids[a], ids[c])
			} else {
				err = g.Block(ids[c], ids[a])
			}
			if err != nil {
				return nil, err
			}
		}
	}
	for range extras.inactive {
		if err := g.Deactivate(ids[rng.below(size)]); err != nil {
			return nil, err
		}
	}
	return g, nil
}
