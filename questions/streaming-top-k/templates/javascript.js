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
 * Complete the 'topTracks' function below.
 *
 * The function is expected to return a 2D_INTEGER_ARRAY.
 * The function accepts 2D_INTEGER_ARRAY events as parameter.
 */

function topTracks(events) {
    // Write your code here
    return [];
}

function main() {
    const q = parseInt(readLine().trim(), 10);

    let events = Array(q);

    for (let i = 0; i < q; i++) {
        events[i] = readLine().replace(/\s+$/g, '').split(' ').map(eventsTemp => parseInt(eventsTemp, 10));
    }

    const result = topTracks(events);

    console.log(result.map(x => x.join(' ')).join('\n'));
}
