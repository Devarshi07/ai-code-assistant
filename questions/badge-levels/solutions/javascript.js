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
 * Complete the 'badgeScores' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY scores
 *  2. INTEGER m
 *  3. INTEGER g
 *  4. INTEGER t
 */

function badgeScores(scores, m, g, t) {
    return scores.map(s => {
        const c = s % m === 0 ? s : s + (m - s % m);
        return s >= t && c - s < g ? c : s;
    });
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const m = parseInt(firstMultipleInput[1], 10);

    const g = parseInt(firstMultipleInput[2], 10);

    const t = parseInt(firstMultipleInput[3], 10);

    const scores = readLine().replace(/\s+$/g, '').split(' ').map(scoresTemp => parseInt(scoresTemp, 10));

    const result = badgeScores(scores, m, g, t);

    console.log(result.join('\n'));
}
