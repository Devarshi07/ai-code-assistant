package tests

import (
	"fmt"
	"testing"
	"time"

	"debuggym/route-planner/transit"
)

// Reference results on the medium network, checked against an independent
// brute-force planner: origin, destination, transfer minutes, and
// {total minutes, transfers}, or nil when unreachable.
var mediumCases = []struct {
	origin, destination string
	transfer            int
	want                []int
}{
	{"S18-21", "S9-8", 5, []int{139, 8}},
	{"S17-12", "S13-1", 0, []int{47, 4}},
	{"S1-19", "S2-2", 10, []int{67, 2}},
	{"S23-3", "S4-16", 2, nil},
	{"S13-1", "S5-21", 5, []int{78, 3}},
	{"S11-15", "S2-20", 0, []int{59, 8}},
	{"S2-1", "S7-4", 10, []int{43, 2}},
	{"S19-16", "S22-13", 2, []int{17, 1}},
	{"S5-5", "S13-18", 5, []int{215, 10}},
	{"S6-15", "S16-22", 0, []int{70, 8}},
	{"S2-4", "S13-17", 10, []int{243, 8}},
	{"S12-17", "S1-20", 2, []int{145, 10}},
}

const (
	batchSize  = 8
	batchLimit = 750 * time.Millisecond
)

func TestPhase3MediumNetworkMatchesReferenceResults(t *testing.T) {
	text, _ := generateTimetable(11, 24, 40, 8, 20)
	network := load(t, text)
	for _, c := range mediumCases {
		label := fmt.Sprintf("%s to %s with %d min transfers", c.origin, c.destination, c.transfer)
		journey, err := transit.FastestJourney(network, c.origin, c.destination, c.transfer)
		if err != nil {
			t.Fatalf("%s: %v", label, err)
		}
		if c.want == nil {
			if journey != nil {
				t.Errorf("%s: got a %d min journey, want none", label, journey.TotalMinutes())
			}
			continue
		}
		if journey == nil {
			t.Fatalf("%s: got no journey", label)
		}
		assertLegsChain(t, network, journey, c.origin, c.destination, c.transfer)
		if journey.TotalMinutes() != c.want[0] || journey.Transfers() != c.want[1] {
			t.Errorf("%s: got %d min with %d transfers, want %d min with %d transfers",
				label, journey.TotalMinutes(), journey.Transfers(), c.want[0], c.want[1])
		}
	}
}

func TestPhase3RegionalNetworkBatchIsFast(t *testing.T) {
	text, stations := generateTimetable(3, 80, 320, 20, 50)
	network := load(t, text) // about 5,100 stations and 320 lines
	queries := pickQueries(17, stations, batchSize)

	start := time.Now()
	journeys := make([]*transit.Journey, len(queries))
	for i, q := range queries {
		journey, err := transit.FastestJourney(network, q.origin, q.destination, transit.DefaultTransferMinutes)
		if err != nil {
			t.Fatalf("%s to %s: %v", q.origin, q.destination, err)
		}
		journeys[i] = journey
	}
	elapsed := time.Since(start)

	totalMinutes, totalTransfers := 0, 0
	for i, q := range queries {
		if journeys[i] == nil {
			t.Fatalf("%s to %s: got no journey", q.origin, q.destination)
		}
		assertLegsChain(t, network, journeys[i], q.origin, q.destination, transit.DefaultTransferMinutes)
		totalMinutes += journeys[i].TotalMinutes()
		totalTransfers += journeys[i].Transfers()
	}
	if first := journeys[0]; first.TotalMinutes() != 116 || first.Transfers() != 6 {
		t.Errorf("first query: got %d min with %d transfers, want 116 min with 6 transfers", first.TotalMinutes(), first.Transfers())
	}
	if totalMinutes != 913 {
		t.Errorf("total minutes over the batch: got %d, want 913", totalMinutes)
	}
	if totalTransfers != 42 {
		t.Errorf("total transfers over the batch: got %d, want 42", totalTransfers)
	}
	if elapsed >= batchLimit {
		t.Errorf("%d queries took %dms; the batch must finish in under %dms", batchSize, elapsed.Milliseconds(), batchLimit.Milliseconds())
	}
}
