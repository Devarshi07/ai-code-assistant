// Command main prints the critical path and runner plans for the sample
// pipelines.
package main

import (
	"fmt"
	"log"
	"strings"

	"debuggym/task-scheduler/foundry"
)

const runners = 3

func main() {
	for _, sample := range foundry.Samples {
		graph, err := foundry.LoadPipeline(sample.Text)
		if err != nil {
			log.Fatal(err)
		}
		critical := graph.CriticalPath()
		fmt.Printf("== %s: %d tasks ==\n", sample.Name, graph.Size())
		fmt.Printf("critical path: %s (%d min)\n", strings.Join(critical.Path, " -> "), critical.Minutes)
		fmt.Println("\nserial plan (one runner, today's behaviour):")
		fmt.Println(foundry.RenderGantt(foundry.SerialSchedule(graph), graph))
		fmt.Printf("\nparallel plan (%d runners):\n", runners)
		plan, err := foundry.Schedule(graph, runners)
		if err != nil {
			fmt.Printf("  %v\n", err)
		} else {
			fmt.Println(foundry.RenderGantt(plan, graph))
		}
		fmt.Println()
	}
}
