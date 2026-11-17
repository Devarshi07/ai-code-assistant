// Command main replays Saturday's lunch log through the kitchen model.
package main

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"debuggym/kitchen-orders/kitchen"
)

func run() error {
	text, err := os.ReadFile("data/saturday_lunch.txt")
	if err != nil {
		return err
	}
	orders, err := kitchen.ParseLog(string(text))
	if err != nil {
		return err
	}
	rail, err := kitchen.Rail(orders, kitchen.HouseMenu)
	if err != nil {
		return err
	}
	fmt.Println("Ticket rail with host-stand quotes")
	fmt.Println(strings.Join(rail, "\n"))
	fmt.Println()
	result, err := kitchen.Simulate(orders, kitchen.HouseMenu, kitchen.HouseLine)
	if errors.Is(err, kitchen.ErrNotImplemented) {
		fmt.Printf("Service simulation unavailable: %v\n", err)
		return nil
	}
	if err != nil {
		return err
	}
	report, err := kitchen.ServiceReport("Saturday lunch", orders, kitchen.HouseMenu, kitchen.HouseLine, result)
	if err != nil {
		return err
	}
	fmt.Println(report)
	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
