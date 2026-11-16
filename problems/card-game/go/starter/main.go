// Command main plays a seeded five-round match, then scores a few showcase hands.
package main

import (
	"fmt"
	"os"
	"strings"

	"debuggym/card-game/fifteens"
)

var showcase = [][2]string{
	{"5C 5D 5H JS", "5S"},
	{"AC 2D 3H 4S", "5C"},
	{"2H 3C 4D 6S", "KH"},
}

func printMatch() error {
	match, err := fifteens.NewMatch([]string{"Ana", "Ben", "Cy"}, fifteens.MatchOptions{Seed: 2024})
	if err != nil {
		return err
	}
	fmt.Printf("Fifteens match, seed %d: %s\n", match.Seed, strings.Join(match.Players, ", "))
	for range 5 {
		result, err := match.PlayRound()
		if err != nil {
			return err
		}
		fmt.Printf("\nRound %d   turn-up %s\n", result.Number, result.TurnUp)
		for _, name := range match.Players {
			fmt.Printf("  %-4s %-14s %s\n", name, fifteens.FormatCards(result.Hands[name]), fifteens.DescribeScore(result.Scores[name]))
		}
	}
	fmt.Println("\nStandings")
	for i, standing := range match.Standings() {
		fmt.Printf("  %d. %-4s %3d\n", i+1, standing.Name, standing.Total)
	}
	return nil
}

func printShowcase() {
	fmt.Println("\nShowcase hands")
	for _, entry := range showcase {
		handText, turnUp := entry[0], entry[1]
		cards := append(fifteens.MustParseHand(handText), fifteens.MustParseHand(turnUp)...)
		score := fifteens.ScoreHand(cards)
		fmt.Printf("  %s | %s   %s\n", handText, turnUp, fifteens.DescribeScore(score))
		if len(score.Fifteens) > 0 {
			fmt.Printf("    fifteens: %s\n", fifteens.DescribeFifteens(score))
		}
	}
}

func printMarathon() {
	fmt.Println()
	// The preview is optional: if counting fails, say why and carry on.
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("Marathon preview: %v\n", r)
		}
	}()
	fullDeck, _ := fifteens.NewDeck(0).Deal(52) // a new deck holds all 52 cards
	counts, err := fifteens.MarathonCounts(fullDeck)
	if err != nil {
		fmt.Printf("Marathon preview: %v\n", err)
		return
	}
	fmt.Println(fifteens.FormatMarathon(fullDeck, counts))
}

func main() {
	if err := printMatch(); err != nil {
		fmt.Fprintln(os.Stderr, "match failed:", err)
		os.Exit(1)
	}
	printShowcase()
	printMarathon()
}
