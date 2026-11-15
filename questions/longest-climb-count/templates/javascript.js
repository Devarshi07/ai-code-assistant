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
 * Complete the 'longestClimb' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts INTEGER_ARRAY alt as parameter.
 */

function longestClimb(alt) {
    // Write your code here
    return [];
}

function main() {
    const n = parseInt(readLine().trim(), 10);

    const alt = readLine().replace(/\s+$/g, '').split(' ').map(altTemp => parseInt(altTemp, 10));

    const result = longestClimb(alt);

    console.log(result.join(' '));
}
