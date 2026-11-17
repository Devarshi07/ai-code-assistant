// Package tests holds the phase tests. This file builds deterministic random
// pictures for the large-puzzle tests.
//
// It uses the Park-Miller "minimal standard" generator, so every language's
// tests reproduce exactly the same pictures. The seeds used in phase3_test.go
// were checked offline: each picture is the *only* grid that fits its clues.
package tests

const modulus = 2147483647

// randomPicture returns a width x height grid where each cell is filled with probability density.
func randomPicture(seed int64, width, height int, density float64) [][]int {
	state := seed % modulus
	if state == 0 {
		state = 1
	}
	grid := make([][]int, height)
	for r := range grid {
		grid[r] = make([]int, width)
		for c := range grid[r] {
			state = (state * 48271) % modulus
			if float64(state)/modulus < density {
				grid[r][c] = 1
			}
		}
	}
	return grid
}
