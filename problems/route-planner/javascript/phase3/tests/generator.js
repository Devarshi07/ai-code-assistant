// Deterministic timetable generator for large test networks.
//
// Stations sit on a size x size street grid and are named after their grid
// cell ("S12-7"). Each line wanders across the grid without revisiting a
// stop; about one in five is an express that skips cells and runs faster per
// cell, and about one in eight is one-way. The Python tests use the same
// generator, so a seed produces the same network in both languages.

// Grid steps for east, south, west, north; turning right is +1, left is +3.
const DIRECTIONS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** Park-Miller "minimal standard" generator. */
class Lcg {
  constructor(seed) {
    this.state = seed % 2147483647 || 1;
  }

  below(n) {
    this.state = (this.state * 48271) % 2147483647;
    return this.state % n;
  }
}

/** Returns { text, stations } with the station names sorted. */
function generateTimetable(seed, size, lines, minStops = 12, maxStops = 30) {
  const rng = new Lcg(seed);
  const entries = [`# generated: seed ${seed}, ${size}x${size} grid, ${lines} lines`];
  const stations = new Set();
  for (let number = 1; number <= lines; number++) {
    const express = rng.below(5) === 0;
    const stride = express ? 2 + rng.below(2) : 1;
    let row = rng.below(size);
    let col = rng.below(size);
    let heading = rng.below(4);
    const target = minStops + rng.below(maxStops - minStops + 1);
    const stops = [[row, col]];
    const minutes = [];
    const seen = new Set([`${row},${col}`]);
    while (stops.length < target) {
      const roll = rng.below(10);
      let order;
      if (roll < 7) order = [heading, (heading + 1) % 4, (heading + 3) % 4];
      else if (roll < 9) order = [(heading + 1) % 4, heading, (heading + 3) % 4];
      else order = [(heading + 3) % 4, heading, (heading + 1) % 4];
      let moved = false;
      for (const turn of order) {
        const [dr, dc] = DIRECTIONS[turn];
        const nr = row + dr * stride;
        const nc = col + dc * stride;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && !seen.has(`${nr},${nc}`)) {
          row = nr;
          col = nc;
          heading = turn;
          moved = true;
          break;
        }
      }
      if (!moved) break; // boxed in: the line ends here
      stops.push([row, col]);
      seen.add(`${row},${col}`);
      minutes.push(express ? stride + rng.below(2) : 2 + rng.below(3));
    }
    const oneWay = rng.below(8) === 0;
    const names = stops.map(([r, c]) => `S${r}-${c}`);
    for (const name of names) stations.add(name);
    let body = names[0];
    for (let i = 1; i < names.length; i++) body += ` ${minutes[i - 1]} ${names[i]}`;
    entries.push(`line ${express ? 'X' : 'L'}${number}${oneWay ? ' oneway' : ''}: ${body}`);
  }
  return { text: entries.join('\n') + '\n', stations: [...stations].sort() };
}

/** Deterministic [origin, destination] pairs of distinct stations. */
function pickQueries(seed, stations, count) {
  const rng = new Lcg(seed);
  const queries = [];
  while (queries.length < count) {
    const origin = stations[rng.below(stations.length)];
    const destination = stations[rng.below(stations.length)];
    if (origin !== destination) queries.push([origin, destination]);
  }
  return queries;
}

module.exports = { generateTimetable, pickQueries, Lcg };
