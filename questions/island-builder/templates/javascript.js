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
    // Write your code here
    return [];
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
