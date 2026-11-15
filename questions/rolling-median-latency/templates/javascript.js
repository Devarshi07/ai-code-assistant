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
 * Complete the 'rollingMedian' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY latency
 *  2. INTEGER k
 */

function rollingMedian(latency, k) {
    // Write your code here
    return [];
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const k = parseInt(firstMultipleInput[1], 10);

    const latency = readLine().replace(/\s+$/g, '').split(' ').map(latencyTemp => parseInt(latencyTemp, 10));

    const result = rollingMedian(latency, k);

    console.log(result.join(' '));
}
