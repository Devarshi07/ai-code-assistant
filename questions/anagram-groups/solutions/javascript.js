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
 * Complete the 'anagramGroups' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts STRING_ARRAY words as parameter.
 */

function anagramGroups(words) {
    const groups = new Map();
    let largest = 0;
    for (const word of words) {
        const key = word.split('').sort().join('');
        const size = (groups.get(key) || 0) + 1;
        groups.set(key, size);
        if (size > largest) largest = size;
    }
    return [groups.size, largest];
}

function main() {
    const n = parseInt(readLine().trim(), 10);

    let words = [];

    for (let i = 0; i < n; i++) {
        const wordsItem = readLine().replace(/\s+$/g, '');
        words.push(wordsItem);
    }

    const result = anagramGroups(words);

    console.log(result.join(' '));
}
