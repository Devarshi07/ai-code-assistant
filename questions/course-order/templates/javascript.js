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
 * Complete the 'courseOrder' function below.
 *
 * The function is expected to return a STRING.
 * The function accepts following parameters:
 *  1. INTEGER n
 *  2. 2D_INTEGER_ARRAY prerequisites
 */

function courseOrder(n, prerequisites) {
    // Write your code here
    return '';
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const m = parseInt(firstMultipleInput[1], 10);

    let prerequisites = Array(m);

    for (let i = 0; i < m; i++) {
        prerequisites[i] = readLine().replace(/\s+$/g, '').split(' ').map(prerequisitesTemp => parseInt(prerequisitesTemp, 10));
    }

    const result = courseOrder(n, prerequisites);

    console.log(result);
}
