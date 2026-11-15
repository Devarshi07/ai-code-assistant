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
 * Complete the 'minMeetingRooms' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts 2D_INTEGER_ARRAY meetings as parameter.
 */

function minMeetingRooms(meetings) {
    // Write your code here
    return 0;
}

function main() {
    const n = parseInt(readLine().trim(), 10);

    let meetings = Array(n);

    for (let i = 0; i < n; i++) {
        meetings[i] = readLine().replace(/\s+$/g, '').split(' ').map(meetingsTemp => parseInt(meetingsTemp, 10));
    }

    const result = minMeetingRooms(meetings);

    console.log(result);
}
