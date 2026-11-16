// Sample levels from the designers' shared folder.
import { Level } from './level.ts';

export const TUTORIAL = `
#########
#S..#...#
#.#.#.#.#
#.#...#E#
#########
`;

export const GATEHOUSE = `
###########
#S...>...E#
#.#######.#
#....<....#
###########
`;

export const TREASURY = `
###########
#S..#....$#
#.#.#.###.#
#.#$..#...#
#.#####.#.#
#...$...#E#
###########
`;

export const CANYON = `
###############
#S....#.......#
#.###.#.#####.#
#...#...#...#.#
###.#####.#.#.#
#.........#..E#
###############
`;

export const TOWER = `
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
`;

export const SPIRE = `
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
`;

export function loadSamples(): Level[] {
  return [
    Level.parse(TUTORIAL, 'tutorial'),
    Level.parse(GATEHOUSE, 'gatehouse'),
    Level.parse(TREASURY, 'treasury'),
    Level.parse(CANYON, 'canyon'),
    Level.parse(TOWER, 'tower'),
    Level.parse(SPIRE, 'spire'),
  ];
}
