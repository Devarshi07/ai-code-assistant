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
 * Complete the 'isBalanced' function below.
 *
 * The function is expected to return a STRING.
 * The function accepts STRING s as parameter.
 */

function isBalanced(s) {
    // Write your code here
    return '';
}

function main() {
    const q = parseInt(readLine().trim(), 10);

    const results = [];

    for (let qItr = 0; qItr < q; qItr++) {
        const s = readLine().replace(/\s+$/g, '');

        const result = isBalanced(s);

        results.push(result);
    }

    console.log(results.join('\n'));
}
