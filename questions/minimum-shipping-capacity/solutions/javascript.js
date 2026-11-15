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
 * Complete the 'minimumCapacity' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY weights
 *  2. INTEGER d
 */

function minimumCapacity(weights, d) {
    // Fewest days the truck needs with the given capacity (greedy loading).
    function daysNeeded(capacity) {
        let days = 1, load = 0;
        for (const w of weights) {
            load += w;
            if (load > capacity) {
                days++;
                load = w;
            }
        }
        return days;
    }

    // Binary search on the answer between the heaviest package and the total weight.
    let lo = 0, hi = 0;
    for (const w of weights) {
        lo = Math.max(lo, w);
        hi += w;
    }
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (daysNeeded(mid) <= d) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const d = parseInt(firstMultipleInput[1], 10);

    const weights = readLine().replace(/\s+$/g, '').split(' ').map(weightsTemp => parseInt(weightsTemp, 10));

    const result = minimumCapacity(weights, d);

    console.log(result);
}
