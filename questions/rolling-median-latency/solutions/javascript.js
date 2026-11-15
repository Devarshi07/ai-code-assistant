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

class MinHeap {
    constructor() { this.a = []; }
    size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(x) {
        const a = this.a;
        let i = a.length;
        a.push(x);
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (a[p] <= x) break;
            a[i] = a[p];
            i = p;
        }
        a[i] = x;
    }
    pop() {
        const a = this.a;
        const top = a[0];
        const last = a.pop();
        const n = a.length;
        if (n > 0) {
            let i = 0;
            while (true) {
                let c = 2 * i + 1;
                if (c >= n) break;
                if (c + 1 < n && a[c + 1] < a[c]) c++;
                if (a[c] >= last) break;
                a[i] = a[c];
                i = c;
            }
            a[i] = last;
        }
        return top;
    }
}

/*
 * Complete the 'rollingMedian' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY latency
 *  2. INTEGER k
 */

function rollingMedian(latency, k) {
    // lo (a max-heap, stored negated) holds the smaller ceil(size / 2) values of
    // the window and hi the rest, so the lower median is the top of lo. A key is
    // value * 2^17 + index (exact in a double), unique per element; entries that
    // left the window are discarded lazily when they reach a heap's top.
    const SHIFT = 131072;
    const lo = new MinHeap(), hi = new MinHeap();
    let loSize = 0, hiSize = 0;
    const medians = [];
    for (let i = 0; i < latency.length; i++) {
        const start = i - k + 1;
        if (i >= k) {
            if (latency[i - k] * SHIFT + (i - k) <= -lo.peek()) loSize--;
            else hiSize--;
        }
        while (lo.size() && (-lo.peek()) % SHIFT < start) lo.pop();
        const key = latency[i] * SHIFT + i;
        if (lo.size() && key < -lo.peek()) { lo.push(-key); loSize++; }
        else { hi.push(key); hiSize++; }
        if (loSize > hiSize + 1) {
            while ((-lo.peek()) % SHIFT < start) lo.pop();
            hi.push(-lo.pop());
            loSize--; hiSize++;
        } else if (loSize < hiSize) {
            while (hi.peek() % SHIFT < start) hi.pop();
            lo.push(-hi.pop());
            loSize++; hiSize--;
        }
        if (start >= 0) {
            while ((-lo.peek()) % SHIFT < start) lo.pop();
            medians.push(Math.floor(-lo.peek() / SHIFT));
        }
    }
    return medians;
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const k = parseInt(firstMultipleInput[1], 10);

    const latency = readLine().replace(/\s+$/g, '').split(' ').map(latencyTemp => parseInt(latencyTemp, 10));

    const result = rollingMedian(latency, k);

    console.log(result.join(' '));
}
