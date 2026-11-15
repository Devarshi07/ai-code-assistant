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
 * Complete the 'playlistQueries' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY tracks
 *  2. INTEGER d
 *  3. INTEGER_ARRAY positions
 */

function playlistQueries(tracks, d, positions) {
    // Write your code here
    return [];
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const d = parseInt(firstMultipleInput[1], 10);

    const q = parseInt(firstMultipleInput[2], 10);

    const tracks = readLine().replace(/\s+$/g, '').split(' ').map(tracksTemp => parseInt(tracksTemp, 10));

    const positions = readLine().replace(/\s+$/g, '').split(' ').map(positionsTemp => parseInt(positionsTemp, 10));

    const result = playlistQueries(tracks, d, positions);

    console.log(result.join('\n'));
}
