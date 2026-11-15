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
    const n = meetings.length;
    const starts = new Int32Array(n), ends = new Int32Array(n);
    for (let i = 0; i < n; i++) {
        starts[i] = meetings[i][0];
        ends[i] = meetings[i][1];
    }
    starts.sort();
    ends.sort();
    // Walk the starts in order. A meeting starting at or after the earliest
    // end time not yet reused can take that room; otherwise it needs a new one.
    let rooms = 0, j = 0;
    for (let i = 0; i < n; i++) {
        if (starts[i] < ends[j]) rooms++;
        else j++;
    }
    return rooms;
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
