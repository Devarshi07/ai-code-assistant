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
    // Keep one DP row over the shorter string. Turning a into b costs the same
    // as turning b into a with the insert and delete costs swapped.
    if (b.length > a.length) {
        [a, b] = [b, a];
        [insertCost, deleteCost] = [deleteCost, insertCost];
    }
    const m = b.length;
    // Costs stay below 2^53, so plain numbers are exact.
    let prev = new Float64Array(m + 1);
    let cur = new Float64Array(m + 1);
    for (let j = 0; j <= m; j++) prev[j] = j * insertCost;
    for (let i = 1; i <= a.length; i++) {
        const ca = a.charCodeAt(i - 1);
        cur[0] = i * deleteCost;
        for (let j = 1; j <= m; j++) {
            let best = prev[j - 1] + (b.charCodeAt(j - 1) === ca ? 0 : replaceCost);
            const del = prev[j] + deleteCost;
            if (del < best) best = del;
            const ins = cur[j - 1] + insertCost;
            if (ins < best) best = ins;
            cur[j] = best;
        }
        [prev, cur] = [cur, prev];
    }
    return prev[m];
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
