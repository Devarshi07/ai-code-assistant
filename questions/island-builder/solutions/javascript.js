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
 * Complete the 'countIslands' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER m
 *  2. INTEGER n
 *  3. 2D_INTEGER_ARRAY cells
 */

function countIslands(m, n, cells) {
    // Union-find over the m * n cells (cell id r * n + c); parent[x] === -1 marks water.
    const parent = new Int32Array(m * n).fill(-1);
    const size = new Int32Array(m * n).fill(1);
    const find = x => {
        let root = x;
        while (parent[root] !== root) root = parent[root];
        while (parent[x] !== root) {
            const next = parent[x];
            parent[x] = root;
            x = next;
        }
        return root;
    };
    const dr = [-1, 1, 0, 0], dc = [0, 0, -1, 1];
    let islands = 0;
    const result = [];
    for (const [r, c] of cells) {
        const cell = r * n + c;
        if (parent[cell] === -1) {
            parent[cell] = cell;
            islands++;
            for (let d = 0; d < 4; d++) {
                const nr = r + dr[d], nc = c + dc[d];
                if (nr < 0 || nr >= m || nc < 0 || nc >= n || parent[nr * n + nc] === -1) continue;
                let a = find(cell), b = find(nr * n + nc);
                if (a !== b) {
                    if (size[a] < size[b]) [a, b] = [b, a];
                    parent[b] = a;
                    size[a] += size[b];
                    islands--;
                }
            }
        }
        result.push(islands);
    }
    return result;
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const m = parseInt(firstMultipleInput[0], 10);

    const n = parseInt(firstMultipleInput[1], 10);

    const q = parseInt(firstMultipleInput[2], 10);

    let cells = Array(q);

    for (let i = 0; i < q; i++) {
        cells[i] = readLine().replace(/\s+$/g, '').split(' ').map(cellsTemp => parseInt(cellsTemp, 10));
    }

    const result = countIslands(m, n, cells);

    console.log(result.join(' '));
}
