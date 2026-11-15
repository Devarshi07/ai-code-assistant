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
 * Complete the 'findDuplicateAndMissing' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts INTEGER_ARRAY scans as parameter.
 */

function findDuplicateAndMissing(scans) {
    const n = scans.length;
    // XOR of the log and of 1..n leaves duplicate ^ missing.
    let both = 0;
    for (let i = 0; i < n; i++) both ^= scans[i] ^ (i + 1);
    // Split every number on one bit where the two differ; each side isolates one of them.
    const bit = both & -both;
    let a = 0;
    for (let i = 0; i < n; i++) {
        if (scans[i] & bit) a ^= scans[i];
        if ((i + 1) & bit) a ^= i + 1;
    }
    const b = both ^ a;
    return scans.includes(a) ? [a, b] : [b, a];
}

function main() {
    const n = parseInt(readLine().trim(), 10);

    const scans = readLine().replace(/\s+$/g, '').split(' ').map(scansTemp => parseInt(scansTemp, 10));

    const result = findDuplicateAndMissing(scans);

    console.log(result.join(' '));
}
