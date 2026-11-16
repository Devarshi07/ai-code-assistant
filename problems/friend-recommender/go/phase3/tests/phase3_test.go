package tests

import (
	"fmt"
	"hash/fnv"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"debuggym/friend-recommender/campfire"
)

// mustRecommend, sg and checkValid are defined in phase2_test.go, and
// buildNetwork in generator_test.go.

// Ana and Bea both know an organiser with 40 friends. Bea also knows c07 and
// c21, and only c30 shares one of Ana's interests. The organiser's friends are
// added in reverse id order.
var organiserFriends = func() []string {
	ids := make([]string, 40)
	for i := range ids {
		ids[i] = fmt.Sprintf("c%02d", 39-i)
	}
	return ids
}()

const largeLimit = 600 * time.Millisecond // for the whole batch

var largeOrganisers = []string{"m11298", "m21194", "m02945"} // the members with the most friends

const expectedFingerprint = 553887438

func organiserNetwork(t *testing.T, blocks [][2]string, inactive ...string) *campfire.SocialGraph {
	t.Helper()
	g := campfire.NewSocialGraph()
	joined := time.Date(2022, 9, 1, 0, 0, 0, 0, time.UTC)
	addMember(t, g, "ana", joined, "jazz", "film")
	addMember(t, g, "bea", joined, "film")
	addMember(t, g, "hub", joined, "chess")
	for _, c := range organiserFriends {
		if c == "c30" {
			addMember(t, g, c, joined, "jazz")
		} else {
			addMember(t, g, c, joined)
		}
	}
	for _, pair := range [][2]string{{"ana", "hub"}, {"ana", "bea"}, {"bea", "hub"}} {
		mustFriend(t, g, pair[0], pair[1])
	}
	for _, c := range organiserFriends {
		mustFriend(t, g, "hub", c)
	}
	mustFriend(t, g, "bea", "c21")
	mustFriend(t, g, "bea", "c07")
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

// The generated networks are built once and shared by the tests.
var (
	clubNetwork = sync.OnceValues(func() (*campfire.SocialGraph, error) {
		return buildNetwork(5, 3000, networkExtras{organisers: 2, reach: 150, blocks: 200, inactive: 60})
	})
	largeNetwork = sync.OnceValues(func() (*campfire.SocialGraph, error) {
		return buildNetwork(11, 30000, networkExtras{organisers: 6, reach: 600, blocks: 300, inactive: 600})
	})
)

// fingerprint is a 32-bit FNV-1a hash of every query's suggestions, in order.
func fingerprint(queries []string, results [][]campfire.Suggestion) uint32 {
	parts := make([]string, len(queries))
	for i, userID := range queries {
		items := make([]string, len(results[i]))
		for j, s := range results[i] {
			items[j] = fmt.Sprintf("%s:%d:%d", s.UserID, s.Mutual, s.Shared)
		}
		parts[i] = userID + ">" + strings.Join(items, ",")
	}
	h := fnv.New32a()
	h.Write([]byte(strings.Join(parts, "|")))
	return h.Sum32()
}

func TestPhase3OrganiserTiesBreakOnInterestsThenID(t *testing.T) {
	g := organiserNetwork(t, nil)
	expectList(t, "Recommend(ana, 4)", mustRecommend(t, g, "ana", 4), []campfire.Suggestion{sg("c07", 2, 0), sg("c21", 2, 0), sg("c30", 1, 1), sg("c00", 1, 0)})
	expectList(t, "Recommend(bea, 3)", mustRecommend(t, g, "bea", 3), []campfire.Suggestion{sg("c00", 1, 0), sg("c01", 1, 0), sg("c02", 1, 0)})
	everyone := mustRecommend(t, g, "ana", 100)
	if len(everyone) != 40 {
		t.Fatalf("Recommend(ana, 100) returned %d suggestions, want 40", len(everyone))
	}
	checkValid(t, g, "ana", everyone, 100)
}

func TestPhase3ExclusionsStillApply(t *testing.T) {
	g := organiserNetwork(t, [][2]string{{"ana", "c01"}}, "c00")
	expectList(t, "Recommend(ana, 4)", mustRecommend(t, g, "ana", 4), []campfire.Suggestion{sg("c07", 2, 0), sg("c21", 2, 0), sg("c30", 1, 1), sg("c02", 1, 0)})
	quiet := organiserNetwork(t, nil, "hub")
	expectList(t, "Recommend(ana, 4) with the organiser deactivated", mustRecommend(t, quiet, "ana", 4), []campfire.Suggestion{sg("c07", 1, 0), sg("c21", 1, 0)})
	if got := mustRecommend(t, quiet, "ana", 0); len(got) != 0 {
		t.Errorf("Recommend(ana, 0) = %v, want none", got)
	}
}

func TestPhase3GeneratedClubNetwork(t *testing.T) {
	g, err := clubNetwork()
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct {
		userID string
		want   []campfire.Suggestion
	}{
		{"m00004", []campfire.Suggestion{sg("m00039", 4, 0), sg("m00001", 3, 2), sg("m00040", 3, 1), sg("m00014", 3, 0), sg("m00026", 3, 0)}},
		{"m00006", []campfire.Suggestion{sg("m00044", 5, 0), sg("m00002", 4, 1), sg("m00000", 4, 0), sg("m00011", 4, 0), sg("m00007", 3, 2)}},
		{"m00146", []campfire.Suggestion{sg("m00108", 4, 0), sg("m00118", 3, 0), sg("m00138", 3, 0), sg("m00128", 2, 2), sg("m00107", 2, 1)}},
		{"m01230", []campfire.Suggestion{sg("m01232", 6, 0), sg("m01242", 4, 1), sg("m01214", 4, 0), sg("m01202", 3, 1), sg("m01227", 3, 0)}},
		{"m01945", []campfire.Suggestion{sg("m00984", 7, 1), sg("m01943", 7, 0), sg("m01912", 5, 1), sg("m01736", 5, 0), sg("m01738", 5, 0)}},
		{"m02718", []campfire.Suggestion{sg("m02722", 4, 1), sg("m02709", 4, 0), sg("m02725", 4, 0), sg("m02744", 4, 0), sg("m02707", 3, 1)}},
	} {
		expectList(t, "suggestions for "+c.userID, mustRecommend(t, g, c.userID, 5), c.want)
	}
}

func TestPhase3GeneratedNetworkFollowsTheRules(t *testing.T) {
	g, err := clubNetwork()
	if err != nil {
		t.Fatal(err)
	}
	for index := 0; index < 3000; index += 97 {
		userID := memberID(index)
		checkValid(t, g, userID, mustRecommend(t, g, userID, 8), 8)
	}
}

func TestPhase3LargeNetworkBatchIsFast(t *testing.T) {
	g, err := largeNetwork()
	if err != nil {
		t.Fatal(err)
	}
	var queries []string
	for index := 0; index < 30000; index += 75 {
		queries = append(queries, memberID(index))
	}
	queries = append(queries, largeOrganisers...)

	results := make([][]campfire.Suggestion, len(queries))
	runtime.GC() // start from a clean heap, as benchmarks do, so the build's garbage isn't collected during the timed batch
	start := time.Now()
	for i, userID := range queries {
		if results[i], err = campfire.Recommend(g, userID, 10); err != nil {
			t.Fatalf("Recommend(%s, 10): %v", userID, err)
		}
	}
	elapsed := time.Since(start)

	total := 0
	for _, suggestions := range results {
		total += len(suggestions)
	}
	if total != 4030 {
		t.Errorf("the batch returned %d suggestions in all, want 4030", total)
	}
	expectList(t, "top 3 for m00000", results[0][:min(3, len(results[0]))], []campfire.Suggestion{sg("m00033", 5, 0), sg("m00015", 4, 1), sg("m00039", 4, 1)})
	for i, userID := range queries {
		if i%10 == 0 || i >= len(queries)-3 {
			checkValid(t, g, userID, results[i], 10)
		}
	}
	if got := fingerprint(queries, results); got != expectedFingerprint {
		t.Errorf("batch results differ from the reference (fingerprint %d, want %d)", got, expectedFingerprint)
	}
	if elapsed >= largeLimit {
		t.Errorf("%d Recommend calls took %v; they must finish in under %v", len(queries), elapsed.Round(time.Millisecond), largeLimit)
	}
}
