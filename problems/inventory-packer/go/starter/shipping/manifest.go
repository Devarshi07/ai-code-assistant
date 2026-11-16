// Packing manifests (printed at the pack bench) and carrier labels.

package shipping

import (
	"fmt"
	"strings"
)

// FormatManifest renders the bench sheet: one block per carton, identical units grouped.
func FormatManifest(orderID string, cartons []*Carton) string {
	count := len(cartons)
	total := 0
	for _, carton := range cartons {
		total += carton.WeightG
	}
	lines := []string{fmt.Sprintf("Order %s: %s, %s", orderID, plural(count, "carton"), FormatGrams(total))}
	for _, carton := range cartons {
		lines = append(lines, heading(carton, count))
		for _, group := range groupUnits(carton.Items) {
			lines = append(lines, fmt.Sprintf("    %3d x %-12s %-30s %9s", group.quantity, group.item.SKU,
				clip(group.item.Description, 30), FormatGrams(group.item.WeightG*group.quantity)))
		}
	}
	return strings.Join(lines, "\n")
}

// CarrierLabels returns the declared weight for each carton, as printed on the carrier label.
func CarrierLabels(orderID string, cartons []*Carton) []string {
	labels := make([]string, len(cartons))
	for i, carton := range cartons {
		labels[i] = fmt.Sprintf("%s-%d/%d %s %s", orderID, carton.Number, len(cartons), carton.Type.Code, FormatKg(carton.WeightG))
	}
	return labels
}

type unitGroup struct {
	item     Item
	quantity int
}

// groupUnits merges units of the same SKU, in first-packed order.
func groupUnits(items []Item) []unitGroup {
	var groups []unitGroup
	index := map[string]int{}
	for _, item := range items {
		if i, seen := index[item.SKU]; seen {
			groups[i].quantity++
			continue
		}
		index[item.SKU] = len(groups)
		groups = append(groups, unitGroup{item: item, quantity: 1})
	}
	return groups
}

func heading(carton *Carton, count int) string {
	marks := ""
	if carton.Fragile {
		marks += "  FRAGILE"
	}
	if carton.Hazmat {
		marks += "  HAZMAT"
	}
	return fmt.Sprintf("  Carton %d/%d  %-10s %9s of %s%s", carton.Number, count, carton.Type.Name,
		FormatGrams(carton.WeightG), FormatGrams(carton.LimitG()), marks)
}

func clip(text string, width int) string {
	if runes := []rune(text); len(runes) > width {
		return string(runes[:width])
	}
	return text
}

func plural(n int, word string) string {
	if n == 1 {
		return fmt.Sprintf("%d %s", n, word)
	}
	return fmt.Sprintf("%d %ss", n, word)
}
