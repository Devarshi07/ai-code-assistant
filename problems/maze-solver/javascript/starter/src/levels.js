// Sample levels from the designers' shared folder.
const { Level } = require('./level');

const TUTORIAL = `
#########
#S..#...#
#.#.#.#.#
#.#...#E#
#########
`;

const GATEHOUSE = `
###########
#S...>...E#
#.#######.#
#....<....#
###########
`;

const TREASURY = `
###########
#S..#....$#
#.#.#.###.#
#.#$..#...#
#.#####.#.#
#...$...#E#
###########
`;

const CANYON = `
###############
#S....#.......#
#.###.#.#####.#
#...#...#...#.#
###.#####.#.#.#
#.........#..E#
###############
`;

const TOWER = `
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

const SPIRE = `
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

function loadSamples() {
  return [
    Level.parse(TUTORIAL, 'tutorial'),
    Level.parse(GATEHOUSE, 'gatehouse'),
    Level.parse(TREASURY, 'treasury'),
    Level.parse(CANYON, 'canyon'),
    Level.parse(TOWER, 'tower'),
    Level.parse(SPIRE, 'spire'),
  ];
}

module.exports = { TUTORIAL, GATEHOUSE, TREASURY, CANYON, TOWER, SPIRE, loadSamples };
