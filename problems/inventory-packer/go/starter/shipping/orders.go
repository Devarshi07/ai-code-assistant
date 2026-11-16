// Loads orders from the WMS order export (CSV).
//
//	order_id,sku,description,weight_kg,qty,flags
//	A1001,MUG-STN-350,Stoneware mug 350 ml,0.38,2,fragile
//
// weight_kg is the weight of ONE unit. flags is empty or a '|'-separated list
// drawn from: fragile, hazmat. Lines of one order need not be adjacent; orders
// come back in the order they first appear in the export.

package shipping

import (
	"fmt"
	"os"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// Columns is the header of the WMS order export.
var Columns = []string{"order_id", "sku", "description", "weight_kg", "qty", "flags"}

var (
	knownFlags = []string{"fragile", "hazmat"}
	quantity   = regexp.MustCompile(`^\d+$`)
)

// OrderFormatError reports a malformed export. The message names the offending line.
type OrderFormatError struct {
	Line int // 1-based line number in the export
	Err  error
}

func (e *OrderFormatError) Error() string { return fmt.Sprintf("line %d: %v", e.Line, e.Err) }

func (e *OrderFormatError) Unwrap() error { return e.Err }

// LoadOrders parses the text of a WMS order export.
func LoadOrders(text string) ([]*Order, error) {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	header := splitCSVLine(lines[0])
	for i := range header {
		header[i] = strings.TrimSpace(header[i])
	}
	if strings.Join(header, ",") != strings.Join(Columns, ",") {
		return nil, &OrderFormatError{Line: 1, Err: fmt.Errorf("expected header %s", strings.Join(Columns, ","))}
	}
	var orders []*Order
	byID := map[string]*Order{}
	for index, raw := range lines[1:] {
		lineNo := index + 2
		row := splitCSVLine(raw)
		if blank(row) {
			continue
		}
		if len(row) != len(Columns) {
			return nil, &OrderFormatError{Line: lineNo, Err: fmt.Errorf("expected %d fields, found %d", len(Columns), len(row))}
		}
		for i := range row {
			row[i] = strings.TrimSpace(row[i])
		}
		line, err := parseLine(row)
		if err != nil {
			return nil, &OrderFormatError{Line: lineNo, Err: err}
		}
		order := byID[row[0]]
		if order == nil {
			order = &Order{ID: row[0]}
			byID[row[0]] = order
			orders = append(orders, order)
		}
		order.Lines = append(order.Lines, line)
	}
	return orders, nil
}

// ReadOrders loads the export in a file.
func ReadOrders(path string) ([]*Order, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return LoadOrders(string(data))
}

// parseLine turns the trimmed cells of one export line into an order line.
func parseLine(row []string) (OrderLine, error) {
	fragile, hazmat, err := parseFlags(row[5])
	if err != nil {
		return OrderLine{}, err
	}
	weightG, err := ParseWeightKg(row[3])
	if err != nil {
		return OrderLine{}, err
	}
	item, err := NewItem(row[1], row[2], weightG, fragile, hazmat)
	if err != nil {
		return OrderLine{}, err
	}
	qty, err := parseQuantity(row[4])
	if err != nil {
		return OrderLine{}, err
	}
	return OrderLine{Item: item, Quantity: qty}, nil
}

// splitCSVLine splits one CSV line, honouring "quoted, fields" and "" escapes.
func splitCSVLine(line string) []string {
	if line == "" {
		return nil
	}
	var cells []string
	var cell strings.Builder
	quoted := false
	for i := 0; i < len(line); i++ {
		ch := line[i]
		switch {
		case quoted && ch == '"' && i+1 < len(line) && line[i+1] == '"':
			cell.WriteByte('"')
			i++
		case quoted && ch == '"':
			quoted = false
		case quoted:
			cell.WriteByte(ch)
		case ch == '"':
			quoted = true
		case ch == ',':
			cells = append(cells, cell.String())
			cell.Reset()
		default:
			cell.WriteByte(ch)
		}
	}
	return append(cells, cell.String())
}

func blank(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

func parseFlags(text string) (fragile, hazmat bool, err error) {
	for _, part := range strings.Split(text, "|") {
		name := strings.ToLower(strings.TrimSpace(part))
		switch {
		case name == "":
		case !slices.Contains(knownFlags, name):
			return false, false, fmt.Errorf("unknown flag %q", name)
		case name == "fragile":
			fragile = true
		case name == "hazmat":
			hazmat = true
		}
	}
	return fragile, hazmat, nil
}

func parseQuantity(text string) (int, error) {
	n, err := strconv.Atoi(text)
	if !quantity.MatchString(text) || err != nil || n < 1 {
		return 0, fmt.Errorf("quantity %q must be a whole number, at least 1", text)
	}
	return n, nil
}
