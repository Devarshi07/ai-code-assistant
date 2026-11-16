package tests

// Deterministic level generator for large test levels (mulberry32 PRNG). It is
// the same generator as the other language versions, so a seed always gives
// the same level.

import "strings"

// mulberry32 is a small 32-bit PRNG; next returns a float64 in [0, 1).
type mulberry32 uint32

func (s *mulberry32) next() float64 {
	*s += 0x6d2b79f5
	t := uint32(*s)
	t = (t ^ (t >> 15)) * (1 | t)
	t = (t + (t^(t>>7))*(61|t)) ^ t
	return float64(t^(t>>14)) / 4294967296
}

// generate carves a maze of size x size tiles, opens extra loops and scatters
// gems.
func generate(seed, size, gems int) string {
	const loops = 0.08
	random := mulberry32(seed)
	pick := func(n int) int { return int(random.next() * float64(n)) }
	grid := make([][]byte, size)
	for r := range grid {
		grid[r] = []byte(strings.Repeat("#", size))
	}
	grid[1][1] = '.'
	stack := [][2]int{{1, 1}}
	for len(stack) > 0 {
		r, c := stack[len(stack)-1][0], stack[len(stack)-1][1]
		var options [][2]int
		for _, jump := range [][2]int{{-2, 0}, {2, 0}, {0, -2}, {0, 2}} {
			nr, nc := r+jump[0], c+jump[1]
			if nr > 0 && nr < size-1 && nc > 0 && nc < size-1 && grid[nr][nc] == '#' {
				options = append(options, [2]int{nr, nc})
			}
		}
		if len(options) == 0 {
			stack = stack[:len(stack)-1]
			continue
		}
		next := options[pick(len(options))]
		grid[(r+next[0])/2][(c+next[1])/2] = '.'
		grid[next[0]][next[1]] = '.'
		stack = append(stack, next)
	}
	for i := 0; i < int(float64(size*size)*loops); i++ {
		r, c := 1+pick(size-2), 1+pick(size-2)
		if grid[r][c] == '#' && ((grid[r-1][c] == '.' && grid[r+1][c] == '.') || (grid[r][c-1] == '.' && grid[r][c+1] == '.')) {
			grid[r][c] = '.'
		}
	}
	var cells [][2]int
	for r := 0; r < size; r++ {
		for c := 0; c < size; c++ {
			if grid[r][c] == '.' {
				cells = append(cells, [2]int{r, c})
			}
		}
	}
	for i := 0; i < gems+2; i++ {
		j := i + pick(len(cells)-i)
		cells[i], cells[j] = cells[j], cells[i]
	}
	grid[cells[0][0]][cells[0][1]] = 'S'
	grid[cells[1][0]][cells[1][1]] = 'E'
	for _, cell := range cells[2 : gems+2] {
		grid[cell[0]][cell[1]] = '$'
	}
	rows := make([]string, size)
	for r, row := range grid {
		rows[r] = string(row)
	}
	return strings.Join(rows, "\n")
}
