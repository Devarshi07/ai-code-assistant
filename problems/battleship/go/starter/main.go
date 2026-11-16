// Demo: a seeded fleet, a replayed bug report, and the reference bot.
package main

import (
	"fmt"
	"log"
	"strings"

	"debuggym/battleship/armada"
)

const seed = 7

// QA ticket #212: shots recorded from an experimental bot that got stuck
// re-firing at the same squares. It was replayed against the seed-7 fleet.
var stuckBotShots = []string{"C5", "A3", "A3", "A3", "A3", "A3", "F7", "F7", "F7", "F7",
	"D4", "D4", "D4", "G5", "G5", "G5", "F3", "F3"}

func main() {
	fleet, err := armada.RandomFleet(seed, 10, armada.DefaultFleet)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Hidden fleet for seed %d (10x10):\n", seed)
	fmt.Println(fleet.Render())
	for i, ship := range fleet.Ships() {
		fmt.Printf("  %c  %-10s %d cells from %v\n", 'A'+i, ship.Name, ship.Size(), ship.Cells[0])
	}
	fmt.Println()

	shots, err := armada.ParseLabels(stuckBotShots)
	if err != nil {
		log.Fatal(err)
	}
	replay, err := armada.PlayMatchWithBudget(armada.NewScriptedBot(shots), fleet, len(shots))
	if err != nil {
		log.Fatal(err)
	}
	results := make([]string, len(replay.Battle.Log()))
	for i, record := range replay.Battle.Log() {
		results[i] = string(record.Result)
	}
	fmt.Println("Replay of ticket #212:", replay.Summary())
	fmt.Println("  results:", strings.Join(results, " "))
	fmt.Println()

	report, err := armada.PlayMatch(armada.NewSeekerBot(10, armada.DefaultFleet), fleet)
	if err != nil {
		fmt.Println("SeekerBot:", err)
		return
	}
	fmt.Println(report.Summary())
	fmt.Println(report.Battle.Chart())
	fmt.Println()
	fmt.Println("Benchmark over seeds 1-50:")
	seeds := make([]int, 50)
	for i := range seeds {
		seeds[i] = i + 1
	}
	summary, err := armada.RunSeries(armada.NewSeekerBot, seeds, 10, armada.DefaultFleet)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(" ", summary)
}
