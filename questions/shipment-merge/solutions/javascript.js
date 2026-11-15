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
    // Sort by start, then keep extending the last busy period while the next
    // window starts at or before its end.
    const sorted = windows.slice().sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [start, end] of sorted) {
        const last = merged[merged.length - 1];
        if (last && start <= last[1]) last[1] = Math.max(last[1], end);
        else merged.push([start, end]);
    }
    return merged;
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
