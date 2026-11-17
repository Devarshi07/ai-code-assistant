package kitchen

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Menu items and the stations of the kitchen line.
//
// Every dish is cooked start to finish by one cook at exactly one station.
// Prep times are whole minutes of hands-on cooking time.

// MenuError is returned when a ticket names a dish the kitchen does not make.
type MenuError struct {
	Name string
}

func (e *MenuError) Error() string {
	return fmt.Sprintf("%q is not on the menu", e.Name)
}

// MenuItem is a dish, the station that cooks it and its prep time.
type MenuItem struct {
	Name    string
	Station string
	Prep    int // minutes
}

// Station is one station of the line, staffed by identical cooks working side by side.
type Station struct {
	Name  string
	Cooks int
}

// Menu is a dish lookup by name. Names are matched case-insensitively.
type Menu struct {
	items map[string]MenuItem
	order []MenuItem
}

// NewMenu builds a menu from items, rejecting bad prep times and duplicate names.
func NewMenu(items []MenuItem) (*Menu, error) {
	menu := &Menu{items: make(map[string]MenuItem, len(items))}
	for _, item := range items {
		if item.Prep < 1 {
			return nil, fmt.Errorf("%s: prep time must be at least one minute", item.Name)
		}
		key := strings.ToLower(item.Name)
		if _, dup := menu.items[key]; dup {
			return nil, fmt.Errorf("duplicate menu item %q", item.Name)
		}
		menu.items[key] = item
		menu.order = append(menu.order, item)
	}
	return menu, nil
}

var menuLine = regexp.MustCompile(`^(.*\S)\s+(\S+)\s+(\d+)\s+min$`)

// ParseMenu reads the menu sheet: one "<dish name>  <station>  <prep> min" per line.
func ParseMenu(text string) (*Menu, error) {
	var items []MenuItem
	for index, raw := range strings.Split(text, "\n") {
		line, _, _ := strings.Cut(raw, "#")
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		match := menuLine.FindStringSubmatch(line)
		if match == nil {
			return nil, fmt.Errorf(`menu line %d: expected "<dish> <station> <minutes> min"`, index+1)
		}
		prep, _ := strconv.Atoi(match[3])
		items = append(items, MenuItem{Name: match[1], Station: match[2], Prep: prep})
	}
	return NewMenu(items)
}

// Get returns the dish called name, or a *MenuError.
func (m *Menu) Get(name string) (MenuItem, error) {
	item, ok := m.items[strings.ToLower(name)]
	if !ok {
		return MenuItem{}, &MenuError{Name: name}
	}
	return item, nil
}

// Has reports whether the kitchen makes the dish.
func (m *Menu) Has(name string) bool {
	_, ok := m.items[strings.ToLower(name)]
	return ok
}

// Size is the number of dishes on the menu.
func (m *Menu) Size() int {
	return len(m.items)
}

// Items lists the dishes in menu-sheet order.
func (m *Menu) Items() []MenuItem {
	return append([]MenuItem(nil), m.order...)
}

// HouseMenu is the menu of Ember & Oak.
var HouseMenu = mustMenu(`
# dish              station  prep
burger              grill     7 min
cheeseburger        grill     8 min
chicken sandwich    grill     6 min
steak frites        grill    14 min
fries               fryer     4 min
onion rings         fryer     5 min
wings               fryer     9 min
fish and chips      fryer     8 min
house salad         salad     3 min
caesar salad        salad     4 min
tomato soup         salad     2 min   # the salad station also ladles soup
margherita          oven      9 min
flatbread           oven      6 min
brownie             oven      3 min
`)

// HouseLine is the lunch crew: two cooks on the grill, one everywhere else.
var HouseLine = []Station{{"grill", 2}, {"fryer", 1}, {"salad", 1}, {"oven", 1}}

func mustMenu(text string) *Menu {
	menu, err := ParseMenu(text)
	if err != nil {
		panic(err)
	}
	return menu
}
