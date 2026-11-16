// Command inventory-packer plans cartons for the sample export and prints the
// bench manifests.
package main

import (
	"fmt"
	"os"
	"strings"

	"debuggym/inventory-packer/shipping"
)

const sample = "data/orders.csv"

func main() {
	orders, err := shipping.ReadOrders(sample)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	for _, order := range orders {
		// Orders that fit one carton get the smallest box that holds them;
		// everything else is split across Large boxes.
		kind, ok := shipping.SmallestCartonFor(order.TotalWeightG(), order.HasFragile())
		if !ok {
			kind = shipping.Large
		}
		fmt.Printf("%s: %d units, %s -> %s\n", order.ID, order.UnitCount(), shipping.FormatGrams(order.TotalWeightG()), kind.Name)
		cartons, err := shipping.PackOrder(order, kind)
		if err != nil {
			fmt.Printf("  packing: %v\n", err)
		} else {
			fmt.Println(shipping.FormatManifest(order.ID, cartons))
			fmt.Println("  labels: " + strings.Join(shipping.CarrierLabels(order.ID, cartons), "; "))
		}
		fmt.Println()
	}
}
