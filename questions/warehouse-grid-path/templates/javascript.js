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
    // Write your code here
    return 0;
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
