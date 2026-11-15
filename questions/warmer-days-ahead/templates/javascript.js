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
 * Complete the 'daysUntilWarmer' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts INTEGER_ARRAY temperatures as parameter.
 */

function daysUntilWarmer(temperatures) {
    // Write your code here
    return [];
}

function main() {
    const n = parseInt(readLine().trim(), 10);

    const temperatures = readLine().replace(/\s+$/g, '').split(' ').map(temperaturesTemp => parseInt(temperaturesTemp, 10));

    const result = daysUntilWarmer(temperatures);

    console.log(result.join(' '));
}
