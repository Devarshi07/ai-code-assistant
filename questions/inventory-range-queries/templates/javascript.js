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
 * Complete the 'processOperations' function below.
 *
 * The function is expected to return a LONG_INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY stock
 *  2. 2D_INTEGER_ARRAY operations
 */

function processOperations(stock, operations) {
    // Write your code here
    return [];
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const q = parseInt(firstMultipleInput[1], 10);

    const stock = readLine().replace(/\s+$/g, '').split(' ').map(stockTemp => parseInt(stockTemp, 10));

    let operations = Array(q);

    for (let i = 0; i < q; i++) {
        operations[i] = readLine().replace(/\s+$/g, '').split(' ').map(operationsTemp => parseInt(operationsTemp, 10));
    }

    const result = processOperations(stock, operations);

    console.log(result.join('\n'));
}
