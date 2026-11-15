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
 * Complete the 'courseOrder' function below.
 *
 * The function is expected to return a STRING.
 * The function accepts following parameters:
 *  1. INTEGER n
 *  2. 2D_INTEGER_ARRAY prerequisites
 */

function courseOrder(n, prerequisites) {
    // Kahn's algorithm with a min-heap: always take the smallest course whose
    // prerequisites are all finished.
    const after = Array.from({length: n + 1}, () => []);
    const waiting = new Int32Array(n + 1);
    for (const [a, b] of prerequisites) {
        after[a].push(b);
        waiting[b]++;
    }
    const ready = [];
    const push = course => {
        let i = ready.length;
        ready.push(course);
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (ready[parent] <= course) break;
            ready[i] = ready[parent];
            i = parent;
        }
        ready[i] = course;
    };
    const pop = () => {
        const top = ready[0];
        const last = ready.pop();
        if (ready.length) {
            let i = 0;
            for (;;) {
                let child = 2 * i + 1;
                if (child >= ready.length) break;
                if (child + 1 < ready.length && ready[child + 1] < ready[child]) child++;
                if (ready[child] >= last) break;
                ready[i] = ready[child];
                i = child;
            }
            ready[i] = last;
        }
        return top;
    };

    for (let course = 1; course <= n; course++) {
        if (waiting[course] === 0) push(course);
    }
    const order = [];
    while (ready.length) {
        const course = pop();
        order.push(course);
        for (const next of after[course]) {
            if (--waiting[next] === 0) push(next);
        }
    }
    return order.length === n ? order.join(' ') : 'IMPOSSIBLE';
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const m = parseInt(firstMultipleInput[1], 10);

    let prerequisites = Array(m);

    for (let i = 0; i < m; i++) {
        prerequisites[i] = readLine().replace(/\s+$/g, '').split(' ').map(prerequisitesTemp => parseInt(prerequisitesTemp, 10));
    }

    const result = courseOrder(n, prerequisites);

    console.log(result);
}
