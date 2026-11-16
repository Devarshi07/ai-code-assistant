package tests

// Test helpers shared by the phase 2 and phase 3 tests.

import (
	"fmt"
	"reflect"
	"testing"

	"debuggym/inventory-packer/shipping"
)

// unit is a test item with no handling flags.
func unit(sku string, grams int) shipping.Item {
	return shipping.Item{SKU: sku, Description: "test unit " + sku, WeightG: grams}
}

// fragile marks a test item as fragile.
func fragile(item shipping.Item) shipping.Item {
	item.Fragile = true
	return item
}

// hazmat marks a test item as hazmat.
func hazmat(item shipping.Item) shipping.Item {
	item.Hazmat = true
	return item
}

// pack runs PackItems and stops the test if it returns an error.
func pack(t *testing.T, items []shipping.Item, kind shipping.CartonType) []*shipping.Carton {
	t.Helper()
	cartons, err := shipping.PackItems(items, kind)
	if err != nil {
		t.Fatalf("PackItems: %v", err)
	}
	return cartons
}

// skuList lists the SKUs of items, in order.
func skuList(items []shipping.Item) []string {
	list := make([]string, len(items))
	for i, item := range items {
		list[i] = item.SKU
	}
	return list
}

// skus lists the SKUs in each carton, in packing order.
func skus(cartons []*shipping.Carton) [][]string {
	plan := make([][]string, len(cartons))
	for i, carton := range cartons {
		plan[i] = skuList(carton.Items)
	}
	return plan
}

// assertPlan stops the test unless the cartons hold exactly these SKUs, in this order.
func assertPlan(t *testing.T, cartons []*shipping.Carton, want [][]string, why string) {
	t.Helper()
	if got := skus(cartons); !reflect.DeepEqual(got, want) {
		t.Fatalf("plan = %v, want %v %s", got, want, why)
	}
}

// tally counts the units of each SKU.
func tally(items []shipping.Item) map[string]int {
	counts := map[string]int{}
	for _, item := range items {
		counts[item.SKU]++
	}
	return counts
}

// assertValidPlan checks that every unit is packed exactly once, that cartons
// are numbered in order and that every packing rule is respected.
func assertValidPlan(t *testing.T, items []shipping.Item, cartons []*shipping.Carton, kind shipping.CartonType) {
	t.Helper()
	var packed []shipping.Item
	for _, carton := range cartons {
		packed = append(packed, carton.Items...)
	}
	if !reflect.DeepEqual(tally(packed), tally(items)) {
		t.Fatalf("every unit must be packed exactly once")
	}
	for index, carton := range cartons {
		label := fmt.Sprintf("carton %d", index+1)
		if carton.Number != index+1 {
			t.Fatalf("%s is numbered %d", label, carton.Number)
		}
		if len(carton.Items) == 0 {
			t.Fatalf("%s is empty", label)
		}
		weight, anyFragile, anyHazmat := 0, false, false
		for _, item := range carton.Items {
			weight += item.WeightG
			anyFragile = anyFragile || item.Fragile
			anyHazmat = anyHazmat || item.Hazmat
		}
		if carton.WeightG != weight {
			t.Fatalf("%s: WeightG does not match its contents", label)
		}
		if weight > kind.MaxWeightG {
			t.Fatalf("%s is over the carton limit", label)
		}
		if anyFragile && weight > kind.FragileMaxWeightG {
			t.Fatalf("%s holds fragile goods and is over the padded limit", label)
		}
		if anyHazmat && len(carton.Items) != 1 {
			t.Fatalf("%s: a hazmat item must ship alone", label)
		}
	}
}
