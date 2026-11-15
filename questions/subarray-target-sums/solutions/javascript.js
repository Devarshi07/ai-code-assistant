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
 * Complete the 'countSubarrays' function below.
 *
 * The function is expected to return a LONG_INTEGER.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY arr
 *  2. LONG_INTEGER k
 */

function countSubarrays(arr, k) {
    // seen[s] = how many prefixes so far sum to s. A stretch ending here sums to k
    // exactly when it starts right after a prefix that sums to (prefix - k).
    const seen = new Map([[0, 1]]);
    let prefix = 0;
    let total = 0;
    for (const value of arr) {
        prefix += value;
        total += seen.get(prefix - k) || 0;
        seen.set(prefix, (seen.get(prefix) || 0) + 1);
    }
    return total;
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const k = parseInt(firstMultipleInput[1], 10);

    const arr = readLine().replace(/\s+$/g, '').split(' ').map(arrTemp => parseInt(arrTemp, 10));

    const result = countSubarrays(arr, k);

    console.log(result);
}
