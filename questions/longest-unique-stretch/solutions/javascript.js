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
    const last = new Int32Array(128).fill(-1);  // most recent index of each character
    let left = 0, bestLen = 0, bestStart = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (last[c] >= left) left = last[c] + 1;  // the window's left edge only ever moves forward
        last[c] = i;
        if (i - left + 1 > bestLen) {
            bestLen = i - left + 1;
            bestStart = left;
        }
    }
    return [bestLen, bestStart];
}

function main() {
    const s = readLine().replace(/\s+$/g, '');

    const result = longestUniqueStretch(s);

    console.log(result.join(' '));
}
