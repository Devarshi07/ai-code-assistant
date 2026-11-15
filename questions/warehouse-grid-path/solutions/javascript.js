'use strict';

process.stdin.resume();
process.stdin.setEncoding('utf-8');

let inputString = '';
let currentLine = 0;

process.stdin.on('data', function(inputStdin) {
    inputString += inputStdin;
});

process.stdin.on('end', function() {
    inputString = inputString.split('\n');

    main();
});

function readLine() {
    return inputString[currentLine++];
}

/*
 * Complete the 'shortestPath' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts STRING_ARRAY grid as parameter.
 */

function shortestPath(grid) {
    const rows = grid.length, cols = grid[0].length, width = cols + 2;
    // Surround the floor with shelves so a step can never leave the grid.
    // blocked marks a cell the robot cannot step into: a shelf, or a cell it has already reached.
    const blocked = new Uint8Array((rows + 2) * width).fill(1);
    let start = -1, end = -1;
    for (let r = 0; r < rows; r++) {
        const row = grid[r];
        for (let c = 0; c < cols; c++) {
            const cell = (r + 1) * width + c + 1, ch = row[c];
            blocked[cell] = ch === '#' ? 1 : 0;
            if (ch === 'S') start = cell;
            else if (ch === 'E') end = cell;
        }
    }
    const dist = new Int32Array(blocked.length);
    const queue = new Int32Array(rows * cols);
    const moves = [-width, width, -1, 1];
    let head = 0, tail = 0;
    queue[tail++] = start;
    blocked[start] = 1;
    while (head < tail) {  // breadth-first: cells leave the queue in order of distance
        const cell = queue[head++];
        for (const move of moves) {
            const next = cell + move;
            if (!blocked[next]) {
                dist[next] = dist[cell] + 1;
                if (next === end) return dist[next];
                blocked[next] = 1;
                queue[tail++] = next;
            }
        }
    }
    return -1;
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const rows = parseInt(firstMultipleInput[0], 10);

    const cols = parseInt(firstMultipleInput[1], 10);

    let grid = [];

    for (let i = 0; i < rows; i++) {
        const gridItem = readLine().replace(/\s+$/g, '');
        grid.push(gridItem);
    }

    const result = shortestPath(grid);

    console.log(result);
}
