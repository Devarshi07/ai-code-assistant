package tests

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"debuggym/inventory-packer/shipping"
)

const benchExport = `order_id,sku,description,weight_kg,qty,flags
B2001,TEA-BRK-80,Breakfast tea 80 bags,0.25,2,
B2001,MUG-STN-350,Stoneware mug 350 ml,0.38,2,fragile
B2002,BAT-LI-18,Lithium battery 18650,0.33,1,hazmat
B2001,TWL-LIN-2,"Linen tea towels, set of 2",0.18,1,
`

// Lines copied from orders the dispatch scale flagged this week.
const dispatchExport = `order_id,sku,description,weight_kg,qty,flags
C3001,PAN-CI-26,Cast iron skillet 26 cm,2.03,1,
C3001,TRV-CI-20,Cast iron trivet,1.015,3,
C3001,TWL-LIN-2,"Linen tea towels, set of 2",0.18,2,
C3002,KTL-ENM-15,Enamel kettle 1.5 l,1.005,1,
C3002,APR-LIN-01,Linen apron,0.42,1,
C3002,WRP-BEE-03,"Beeswax wraps, pack of 3",0.576,1,
`

// loadOrders parses an export and stops the test if it is malformed.
func loadOrders(t *testing.T, text string) []*shipping.Order {
	t.Helper()
	orders, err := shipping.LoadOrders(text)
	if err != nil {
		t.Fatalf("LoadOrders: %v", err)
	}
	return orders
}

// orderByID finds one order of an export and stops the test if it is missing.
func orderByID(t *testing.T, orders []*shipping.Order, id string) *shipping.Order {
	t.Helper()
	for _, order := range orders {
		if order.ID == id {
			return order
		}
	}
	t.Fatalf("no order %s in the export", id)
	return nil
}

// cartonCode is the code of the carton type SmallestCartonFor chose, or "none".
func cartonCode(kind shipping.CartonType, ok bool) string {
	if !ok {
		return "none"
	}
	return kind.Code
}

func TestPhase1WeightReadings(t *testing.T) {
	t.Run("simple kilogram readings", func(t *testing.T) {
		cases := []struct {
			text  string
			grams int
		}{{"2", 2000}, {"0.5", 500}, {"0.25", 250}, {"1.2", 1200}, {"0.035", 35}}
		for _, c := range cases {
			if got, err := shipping.ParseWeightKg(c.text); err != nil || got != c.grams {
				t.Errorf("ParseWeightKg(%q) = %d, %v; want %d (%s kg)", c.text, got, err, c.grams, c.text)
			}
		}
	})

	t.Run("malformed readings are rejected", func(t *testing.T) {
		for _, text := range []string{"", "abc", "-1", "1,5", "1.2kg"} {
			if grams, err := shipping.ParseWeightKg(text); err == nil {
				t.Errorf("ParseWeightKg(%q) = %d; want an error", text, grams)
			}
		}
	})

	t.Run("weight formatting", func(t *testing.T) {
		checks := []struct{ got, want string }{
			{shipping.FormatGrams(5435), "5,435 g"},
			{shipping.FormatGrams(800), "800 g"},
			{shipping.FormatKg(5435), "5.435 kg"},
			{shipping.FormatKg(35), "0.035 kg"},
		}
		for _, c := range checks {
			if c.got != c.want {
				t.Errorf("got %q, want %q", c.got, c.want)
			}
		}
	})
}

func TestPhase1OrderExport(t *testing.T) {
	t.Run("lines are grouped by order", func(t *testing.T) {
		orders := loadOrders(t, benchExport)
		var ids []string
		for _, order := range orders {
			ids = append(ids, order.ID)
		}
		if want := []string{"B2001", "B2002"}; !reflect.DeepEqual(ids, want) {
			t.Fatalf("order IDs = %v, want %v", ids, want)
		}
		first := orders[0]
		var lineSKUs []string
		var quantities []int
		for _, line := range first.Lines {
			lineSKUs = append(lineSKUs, line.Item.SKU)
			quantities = append(quantities, line.Quantity)
		}
		if want := []string{"TEA-BRK-80", "MUG-STN-350", "TWL-LIN-2"}; !reflect.DeepEqual(lineSKUs, want) {
			t.Fatalf("SKUs = %v, want %v", lineSKUs, want)
		}
		if want := []int{2, 2, 1}; !reflect.DeepEqual(quantities, want) {
			t.Fatalf("quantities = %v, want %v", quantities, want)
		}
		if got := first.UnitCount(); got != 5 {
			t.Fatalf("UnitCount() = %d, want 5", got)
		}
		if got := first.Lines[2].Item.Description; got != "Linen tea towels, set of 2" {
			t.Fatalf("description = %q, want %q", got, "Linen tea towels, set of 2")
		}
	})

	t.Run("flags are read", func(t *testing.T) {
		orders := loadOrders(t, benchExport)
		first, second := orderByID(t, orders, "B2001"), orderByID(t, orders, "B2002")
		if len(first.Lines) < 2 || len(second.Lines) < 1 {
			t.Fatalf("expected the B2001 and B2002 lines, got %d and %d", len(first.Lines), len(second.Lines))
		}
		checks := []struct {
			item            shipping.Item
			fragile, hazmat bool
		}{{first.Lines[0].Item, false, false}, {first.Lines[1].Item, true, false}, {second.Lines[0].Item, false, true}}
		for _, c := range checks {
			if c.item.Fragile != c.fragile || c.item.Hazmat != c.hazmat {
				t.Errorf("%s: fragile, hazmat = %v, %v; want %v, %v", c.item.SKU, c.item.Fragile, c.item.Hazmat, c.fragile, c.hazmat)
			}
		}
	})

	t.Run("bad line is reported with its number", func(t *testing.T) {
		broken := strings.Replace(benchExport, "0.33,1,hazmat", "0.33,1,explosive", 1)
		_, err := shipping.LoadOrders(broken)
		var formatErr *shipping.OrderFormatError
		if !errors.As(err, &formatErr) || !strings.Contains(err.Error(), "line 4") {
			t.Fatalf("LoadOrders error = %v; want an *OrderFormatError naming line 4", err)
		}
	})

	t.Run("unit weights match the export", func(t *testing.T) {
		var weights []int
		for _, order := range loadOrders(t, dispatchExport) {
			for _, line := range order.Lines {
				weights = append(weights, line.Item.WeightG)
			}
		}
		if want := []int{2030, 1015, 180, 1005, 420, 576}; !reflect.DeepEqual(weights, want) {
			t.Fatalf("unit weights = %v, want %v", weights, want)
		}
	})

	t.Run("order weight matches the dispatch scale", func(t *testing.T) {
		order := orderByID(t, loadOrders(t, dispatchExport), "C3001")
		if got := order.TotalWeightG(); got != 5435 {
			t.Fatalf("TotalWeightG() = %d, want 5435: the dispatch scale weighed this order at 5,435 g", got)
		}
	})
}

func TestPhase1CartonChoice(t *testing.T) {
	t.Run("smallest box that holds the weight", func(t *testing.T) {
		checks := []struct {
			weightG   int
			want, why string
		}{{1800, "S", ""}, {2000, "S", "a full Small box is still a Small box"}, {2001, "M", ""}, {9000, "L", ""}, {10001, "none", ""}}
		for _, c := range checks {
			if got := cartonCode(shipping.SmallestCartonFor(c.weightG, false)); got != c.want {
				t.Errorf("SmallestCartonFor(%d, false) = %s, want %s %s", c.weightG, got, c.want, c.why)
			}
		}
	})

	t.Run("fragile orders use the padded limit", func(t *testing.T) {
		if got := cartonCode(shipping.SmallestCartonFor(1500, true)); got != "S" {
			t.Errorf("SmallestCartonFor(1500, true) = %s, want S", got)
		}
		if got := cartonCode(shipping.SmallestCartonFor(1800, true)); got != "M" {
			t.Errorf("SmallestCartonFor(1800, true) = %s, want M", got)
		}
	})

	t.Run("order just over the small box limit", func(t *testing.T) {
		order := orderByID(t, loadOrders(t, dispatchExport), "C3002")
		if got := cartonCode(shipping.SmallestCartonFor(order.TotalWeightG(), order.HasFragile())); got != "M" {
			t.Fatalf("carton type = %s, want M: the carrier weighed this order at 2,001 g, too heavy for a Small box", got)
		}
	})
}

func TestPhase1Manifest(t *testing.T) {
	sampleCartons := func() []*shipping.Carton {
		mug := shipping.Item{SKU: "MUG-STN-350", Description: "Stoneware mug 350 ml", WeightG: 380, Fragile: true}
		tea := shipping.Item{SKU: "TEA-BRK-80", Description: "Breakfast tea 80 bags", WeightG: 250}
		battery := shipping.Item{SKU: "BAT-LI-18", Description: "Lithium battery 18650", WeightG: 330, Hazmat: true}
		first, second := shipping.NewCarton(shipping.Medium, 1), shipping.NewCarton(shipping.Medium, 2)
		for _, item := range []shipping.Item{mug, tea, mug} {
			first.Add(item)
		}
		second.Add(battery)
		return []*shipping.Carton{first, second}
	}

	t.Run("manifest groups units per carton", func(t *testing.T) {
		lines := strings.Split(shipping.FormatManifest("B2001", sampleCartons()), "\n")
		if len(lines) != 6 {
			t.Fatalf("the manifest has %d lines, want 6:\n%s", len(lines), strings.Join(lines, "\n"))
		}
		checks := []struct {
			line int
			want string
			why  string
		}{
			{0, "2 cartons", ""}, {0, "1,340 g", ""},
			{1, "Carton 1/2", ""}, {1, "1,010 g of 3,500 g", "a fragile carton shows the padded limit"}, {1, "FRAGILE", ""},
			{2, "2 x MUG-STN-350", ""}, {2, "760 g", ""},
			{3, "1 x TEA-BRK-80", ""},
			{4, "HAZMAT", ""},
		}
		for _, c := range checks {
			if !strings.Contains(lines[c.line], c.want) {
				t.Errorf("line %d is %q; want it to contain %q %s", c.line, lines[c.line], c.want, c.why)
			}
		}
	})

	t.Run("carrier labels declare each carton", func(t *testing.T) {
		got := shipping.CarrierLabels("B2001", sampleCartons())
		if want := []string{"B2001-1/2 M 1.010 kg", "B2001-2/2 M 0.330 kg"}; !reflect.DeepEqual(got, want) {
			t.Fatalf("CarrierLabels = %q, want %q", got, want)
		}
	})
}
