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
 * Complete the 'minimumEditCost' function below.
 *
 * The function is expected to return a LONG_INTEGER.
 * The function accepts following parameters:
 *  1. STRING a
 *  2. STRING b
 *  3. INTEGER insertCost
 *  4. INTEGER deleteCost
 *  5. INTEGER replaceCost
 */

function minimumEditCost(a, b, insertCost, deleteCost, replaceCost) {
    // Write your code here
    return 0;
}

function main() {
    const a = readLine().replace(/\s+$/g, '');

    const b = readLine().replace(/\s+$/g, '');

    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const insertCost = parseInt(firstMultipleInput[0], 10);

    const deleteCost = parseInt(firstMultipleInput[1], 10);

    const replaceCost = parseInt(firstMultipleInput[2], 10);

    const result = minimumEditCost(a, b, insertCost, deleteCost, replaceCost);

    console.log(result);
}
