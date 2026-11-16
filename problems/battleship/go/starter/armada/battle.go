package armada

// Shot resolution: the referee between a shooter and a hidden fleet.
//
// House rules (also in README.md):
//
//   - Every call to Fire is a shot and counts toward ShotsFired.
//   - A shot at a cell that has already been fired at is wasted. It always comes
//     back Miss, it is flagged as a repeat in the log, and nothing on the board changes.
//   - Sunk is reported by the shot that hits the last undamaged cell of a ship.
//   - Shots off the board return an *OffBoardError and are not counted.

// ShotResult is the outcome of one shot. Sunk does not say which ship went down.
type ShotResult string

const (
	Miss ShotResult = "MISS"
	Hit  ShotResult = "HIT"
	Sunk ShotResult = "SUNK"
)

// ShotRecord is one entry in a battle's shot log.
type ShotRecord struct {
	Coord  Coord
	Result ShotResult
	Ship   string // name of the ship that was struck, if any
	Repeat bool   // true when the cell had already been fired at
}

// Battle is one fleet under fire. A battle always starts from an undamaged fleet.
type Battle struct {
	fleet      *Fleet
	ocean      *Ocean
	shotsFired int
	log        []ShotRecord
	misses     map[Coord]bool // water cells that have been fired at
	hits       map[Coord]bool // ship cells that have been fired at
}

// NewBattle starts a battle against fleet, repairing any earlier damage.
func NewBattle(fleet *Fleet) *Battle {
	fleet.ResetDamage()
	return &Battle{fleet: fleet, ocean: fleet.Ocean(), misses: map[Coord]bool{}, hits: map[Coord]bool{}}
}

// ShotsFired counts every shot so far, repeats included.
func (b *Battle) ShotsFired() int { return b.shotsFired }

// Log lists every shot so far, in order.
func (b *Battle) Log() []ShotRecord { return b.log }

// FleetSunk reports whether every ship has been sunk.
func (b *Battle) FleetSunk() bool {
	for _, ship := range b.fleet.Ships() {
		if !ship.IsSunk() {
			return false
		}
	}
	return true
}

// Repeats counts the shots at cells that had already been fired at.
func (b *Battle) Repeats() int {
	repeats := 0
	for _, record := range b.log {
		if record.Repeat {
			repeats++
		}
	}
	return repeats
}

// Fire resolves one shot at target.
func (b *Battle) Fire(target Coord) (ShotResult, error) {
	if err := b.ocean.Check(target); err != nil {
		return "", err
	}
	b.shotsFired++
	if b.misses[target] {
		return b.record(target, Miss, "", true), nil
	}

	ship := b.fleet.ShipAt(target)
	if ship == nil {
		b.misses[target] = true
		return b.record(target, Miss, "", false), nil
	}

	b.hits[target] = true
	ship.TakeHit()
	result := Hit
	if ship.IsSunk() {
		result = Sunk
	}
	return b.record(target, result, ship.Name, false), nil
}

func (b *Battle) record(c Coord, result ShotResult, ship string, repeat bool) ShotResult {
	b.log = append(b.log, ShotRecord{Coord: c, Result: result, Ship: ship, Repeat: repeat})
	return result
}

// Chart draws the shooter's view: '.' unknown, 'o' miss, 'X' hit, '#' part of a sunk ship.
func (b *Battle) Chart() string {
	return b.ocean.Render(func(c Coord) string {
		switch {
		case b.misses[c]:
			return "o"
		case b.hits[c] && b.fleet.ShipAt(c).IsSunk():
			return "#"
		case b.hits[c]:
			return "X"
		}
		return "."
	})
}
