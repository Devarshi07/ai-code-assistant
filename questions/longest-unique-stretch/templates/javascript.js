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
 * Complete the 'longestUniqueStretch' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts STRING s as parameter.
 */

function longestUniqueStretch(s) {
    // Write your code here
    return [];
}

function main() {
    const s = readLine().replace(/\s+$/g, '');

    const result = longestUniqueStretch(s);

    console.log(result.join(' '));
}
