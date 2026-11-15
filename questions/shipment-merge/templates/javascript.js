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
 * Complete the 'mergeShipments' function below.
 *
 * The function is expected to return a 2D_INTEGER_ARRAY.
 * The function accepts 2D_INTEGER_ARRAY windows as parameter.
 */

function mergeShipments(windows) {
    // Write your code here
    return [];
}

function main() {
    const n = parseInt(readLine().trim(), 10);

    let windows = Array(n);

    for (let i = 0; i < n; i++) {
        windows[i] = readLine().replace(/\s+$/g, '').split(' ').map(windowsTemp => parseInt(windowsTemp, 10));
    }

    const result = mergeShipments(windows);

    console.log(result.length);

    console.log(result.map(x => x.join(' ')).join('\n'));
}
