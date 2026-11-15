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
 * Complete the 'cheapestTrip' function below.
 *
 * The function is expected to return a LONG_INTEGER.
 * The function accepts following parameters:
 *  1. INTEGER n
 *  2. 2D_INTEGER_ARRAY roads
 */

function cheapestTrip(n, roads) {
    const adj = Array.from({length: n + 1}, () => []);
    for (const [u, v, c] of roads) {
        adj[u].push(v, c);
        adj[v].push(u, c);
    }

    // Binary min-heap of (distance, state) in two parallel arrays.
    const keys = [], vals = [];
    function push(key, val) {
        let i = keys.length;
        keys.push(key);
        vals.push(val);
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (keys[p] <= key) break;
            keys[i] = keys[p];
            vals[i] = vals[p];
            i = p;
        }
        keys[i] = key;
        vals[i] = val;
    }
    function popTop() {
        const key = keys.pop(), val = vals.pop();
        const size = keys.length;
        if (size === 0) return;
        let i = 0;
        while (true) {
            let child = 2 * i + 1;
            if (child >= size) break;
            if (child + 1 < size && keys[child + 1] < keys[child]) child++;
            if (keys[child] >= key) break;
            keys[i] = keys[child];
            vals[i] = vals[child];
            i = child;
        }
        keys[i] = key;
        vals[i] = val;
    }

    // Dijkstra over states (town, pass used?), encoded as 2 * town + used.
    // Totals stay below 2^53, so plain numbers are exact.
    const dist = new Float64Array(2 * n + 2).fill(Infinity);
    dist[2] = 0;
    push(0, 2);
    while (keys.length) {
        const d = keys[0], state = vals[0];
        popTop();
        if (d > dist[state]) continue;
        const town = state >> 1, used = state & 1;
        // The first state of town n to leave the heap is the cheapest one.
        if (town === n) return d;
        const edges = adj[town];
        for (let k = 0; k < edges.length; k += 2) {
            const next = edges[k], c = edges[k + 1];
            let target = 2 * next + used;
            if (d + c < dist[target]) {
                dist[target] = d + c;
                push(d + c, target);
            }
            if (!used) {
                target = 2 * next + 1;
                const half = d + Math.floor(c / 2);
                if (half < dist[target]) {
                    dist[target] = half;
                    push(half, target);
                }
            }
        }
    }
    return -1;
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const m = parseInt(firstMultipleInput[1], 10);

    let roads = Array(m);

    for (let i = 0; i < m; i++) {
        roads[i] = readLine().replace(/\s+$/g, '').split(' ').map(roadsTemp => parseInt(roadsTemp, 10));
    }

    const result = cheapestTrip(n, roads);

    console.log(result);
}
