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
    // A binary heap of [plays, track] entries, best first. Each play pushes a fresh
    // entry, and entries whose play count is out of date are discarded when they surface.
    const better = (a, b) => a[0] !== b[0] ? a[0] > b[0] : a[1] < b[1];
    const heap = [];
    const push = entry => {
        let i = heap.length;
        heap.push(entry);
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (!better(entry, heap[parent])) break;
            heap[i] = heap[parent];
            i = parent;
        }
        heap[i] = entry;
    };
    const pop = () => {
        const top = heap[0];
        const last = heap.pop();
        if (heap.length) {
            let i = 0;
            for (;;) {
                let child = 2 * i + 1;
                if (child >= heap.length) break;
                if (child + 1 < heap.length && better(heap[child + 1], heap[child])) child++;
                if (!better(heap[child], last)) break;
                heap[i] = heap[child];
                i = child;
            }
            heap[i] = last;
        }
        return top;
    };

    const plays = new Map();
    const answers = [];
    for (const [type, value] of events) {
        if (type === 1) {
            const count = (plays.get(value) || 0) + 1;
            plays.set(value, count);
            push([count, value]);
        } else {
            const top = [];
            while (heap.length && top.length < value) {
                const entry = pop();
                if (plays.get(entry[1]) === entry[0]) top.push(entry);
            }
            for (const entry of top) push(entry);
            answers.push(top.map(entry => entry[1]));
        }
    }
    return answers;
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
