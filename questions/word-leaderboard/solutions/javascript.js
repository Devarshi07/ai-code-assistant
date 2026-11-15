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
 * Complete the 'topWords' function below.
 *
 * The function is expected to return a STRING_ARRAY.
 * The function accepts following parameters:
 *  1. STRING_ARRAY lines
 *  2. INTEGER k
 */

function topWords(lines, k) {
    const counts = new Map();
    for (const line of lines) {
        for (const word of line.split(' ')) {
            if (word) counts.set(word, (counts.get(word) || 0) + 1);
        }
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return ranked.slice(0, k).map(([word, count]) => `${word} ${count}`);
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const m = parseInt(firstMultipleInput[0], 10);

    const k = parseInt(firstMultipleInput[1], 10);

    let lines = [];

    for (let i = 0; i < m; i++) {
        const linesItem = readLine().replace(/\s+$/g, '');
        lines.push(linesItem);
    }

    const result = topWords(lines, k);

    console.log(result.join('\n'));
}
