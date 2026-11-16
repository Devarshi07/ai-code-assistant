package maze

// Sample levels from the designers' shared folder.

const Tutorial = `
#########
#S..#...#
#.#.#.#.#
#.#...#E#
#########
`

const Gatehouse = `
###########
#S...>...E#
#.#######.#
#....<....#
###########
`

const Treasury = `
###########
#S..#....$#
#.#.#.###.#
#.#$..#...#
#.#####.#.#
#...$...#E#
###########
`

const Canyon = `
###############
#S....#.......#
#.###.#.#####.#
#...#...#...#.#
###.#####.#.#.#
#.........#..E#
###############
`

const Tower = `
#####
#S..#
#.#.#
#.#.#
#...#
##.##
#..$#
#.###
#..E#
#####
`

const Spire = `
#####
#S...
###.#
#...#
#.###
#...#
###.#
#...#
#.###
#...#
###.#
#E...
`

// LoadSamples parses the sample levels. They are fixed data, so a parse error
// is a bug in this file and panics.
func LoadSamples() []*Level {
	samples := []struct{ name, text string }{
		{"tutorial", Tutorial},
		{"gatehouse", Gatehouse},
		{"treasury", Treasury},
		{"canyon", Canyon},
		{"tower", Tower},
		{"spire", Spire},
	}
	levels := make([]*Level, 0, len(samples))
	for _, sample := range samples {
		level, err := Parse(sample.name, sample.text)
		if err != nil {
			panic(err)
		}
		levels = append(levels, level)
	}
	return levels
}
