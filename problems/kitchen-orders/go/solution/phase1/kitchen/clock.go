// Package kitchen is the model behind the kitchen display system.
//
// Clock helpers: the ticket printer stamps every ticket with a 12-hour
// wall-clock time such as "11:58am" or "1:05pm". Everything inside the kitchen
// model works in whole minutes since midnight at the start of service: 0 is
// 12:00am, 750 is 12:30pm. A late service can run past midnight, and those
// minutes keep counting up, so 1450 is 12:10am the next day.
package kitchen

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// MinutesPerDay is the length of a day in clock minutes.
const MinutesPerDay = 24 * 60

var stamp = regexp.MustCompile(`(?i)^\s*(\d{1,2}):(\d{2})\s*([ap]m)\s*$`)

// ClockError is returned for a time stamp the ticket printer could not have produced.
type ClockError struct {
	Text string
}

func (e *ClockError) Error() string {
	return fmt.Sprintf("not a clock time: %q", e.Text)
}

// ParseClock turns a printer stamp like "9:05am" or "6:30pm" into minutes since midnight.
func ParseClock(text string) (int, error) {
	match := stamp.FindStringSubmatch(text)
	if match == nil {
		return 0, &ClockError{Text: text}
	}
	hours, _ := strconv.Atoi(match[1])
	minutes, _ := strconv.Atoi(match[2])
	if hours < 1 || hours > 12 || minutes > 59 {
		return 0, &ClockError{Text: text}
	}
	// On a 12-hour clock "12" opens each half of the day: 12:05am is five past
	// midnight and 12:05pm is five past noon.
	hours %= 12
	if strings.ToLower(match[3]) == "pm" {
		hours += 12
	}
	return hours*60 + minutes, nil
}

func floorDiv(a, b int) int {
	q := a / b
	if a%b != 0 && (a < 0) != (b < 0) {
		q--
	}
	return q
}

// FormatClock is the inverse of ParseClock: 750 gives "12:30pm". Later days get a "+N" marker.
func FormatClock(minutes int) string {
	day := floorDiv(minutes, MinutesPerDay)
	minuteOfDay := minutes - day*MinutesPerDay
	hours := minuteOfDay / 60
	mins := minuteOfDay % 60
	half := "am"
	if hours >= 12 {
		half = "pm"
	}
	clockHours := hours % 12
	if clockHours == 0 {
		clockHours = 12
	}
	text := fmt.Sprintf("%d:%02d%s", clockHours, mins, half)
	if day == 0 {
		return text
	}
	return fmt.Sprintf("%s +%d", text, day)
}

// FormatDuration is a compact duration for reports: 7 gives "7m", 65 gives "1h05m".
func FormatDuration(minutes int) string {
	hours := minutes / 60
	mins := minutes % 60
	if hours == 0 {
		return fmt.Sprintf("%dm", mins)
	}
	return fmt.Sprintf("%dh%02dm", hours, mins)
}
