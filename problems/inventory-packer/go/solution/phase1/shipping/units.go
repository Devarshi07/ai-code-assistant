// Weight units.
//
// Inside the service every weight is a whole number of grams. The WMS export
// and the carrier labels use kilograms, so conversions happen only at the
// edges: ParseWeightKg when an export is loaded, Format* when printing.

package shipping

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

// GramsPerKg converts the kilograms in the export to the grams used inside the service.
const GramsPerKg = 1000

// The pack-bench scales read to the gram, so the export never carries more
// than three decimal places: "2", "0.5", "1.25", "0.035".
var reading = regexp.MustCompile(`^\d+(\.\d+)?$`)

// ParseWeightKg converts a kilogram reading from the WMS export to whole grams.
func ParseWeightKg(text string) (int, error) {
	cleaned := strings.TrimSpace(text)
	if !reading.MatchString(cleaned) {
		return 0, fmt.Errorf("weight %q is not a kilogram reading like 1.25", text)
	}
	kilograms, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0, fmt.Errorf("weight %q: %w", text, err)
	}
	// Binary floats store 2.03 as 2.02999..., so truncating would lose a gram.
	return int(math.Round(kilograms * GramsPerKg)), nil
}

// FormatGrams formats 5435 as "5,435 g".
func FormatGrams(grams int) string {
	digits := strconv.Itoa(grams)
	sign := ""
	if grams < 0 {
		sign, digits = "-", digits[1:]
	}
	var out strings.Builder
	for i, digit := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			out.WriteByte(',')
		}
		out.WriteRune(digit)
	}
	return sign + out.String() + " g"
}

// FormatKg formats 5435 as "5.435 kg", the format printed on carrier labels.
func FormatKg(grams int) string {
	return fmt.Sprintf("%d.%03d kg", grams/GramsPerKg, grams%GramsPerKg)
}
