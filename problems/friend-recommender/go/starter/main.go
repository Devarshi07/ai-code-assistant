// Command friend-recommender prints a support-desk view of the sample
// Campfire network.
package main

import (
	"fmt"
	"os"

	"debuggym/friend-recommender/campfire"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run() error {
	g, err := campfire.LoadSample("data")
	if err != nil {
		return err
	}
	fmt.Println("Campfire sample network:", campfire.NetworkSummary(g))
	fmt.Println()
	for _, id := range []string{"alice", "bob", "judy", "peggy"} {
		line, err := campfire.FriendList(g, id)
		if err != nil {
			return err
		}
		fmt.Println(line)
	}
	fmt.Println()
	card, err := campfire.ProfileCard(g, "erin", "alice")
	if err != nil {
		return err
	}
	fmt.Println(card)
	fmt.Println()
	for _, id := range []string{"alice", "frank", "olivia"} {
		member, err := g.User(id)
		if err != nil {
			return err
		}
		suggestions, err := campfire.Recommend(g, id, 3)
		if err != nil {
			fmt.Printf("People %s may know: %v\n", member.FirstName(), err)
			continue
		}
		panel, err := campfire.SuggestionLines(g, id, suggestions)
		if err != nil {
			return err
		}
		fmt.Println(panel)
	}
	return nil
}
