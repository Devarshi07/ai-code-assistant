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
 * Complete the 'processOperations' function below.
 *
 * The function is expected to return a LONG_INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY stock
 *  2. 2D_INTEGER_ARRAY operations
 */

function processOperations(stock, operations) {
    // A Fenwick tree over the shelves, plus each shelf's current value so a
    // recount becomes an update by the difference. Totals stay below 2^53.
    const n = stock.length;
    const current = new Float64Array(n + 1);
    const tree = new Float64Array(n + 1);
    for (let i = 1; i <= n; i++) {
        current[i] = stock[i - 1];
        tree[i] += stock[i - 1];
        const parent = i + (i & -i);
        if (parent <= n) tree[parent] += tree[i];
    }
    const answers = [];
    for (const [kind, x, y] of operations) {
        if (kind === 1) {
            const delta = y - current[x];
            current[x] = y;
            for (let i = x; i <= n; i += i & -i) tree[i] += delta;
        } else {
            let total = 0;
            for (let i = y; i > 0; i &= i - 1) total += tree[i];
            for (let i = x - 1; i > 0; i &= i - 1) total -= tree[i];
            answers.push(total);
        }
    }
    return answers;
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const q = parseInt(firstMultipleInput[1], 10);

    const stock = readLine().replace(/\s+$/g, '').split(' ').map(stockTemp => parseInt(stockTemp, 10));

    let operations = Array(q);

    for (let i = 0; i < q; i++) {
        operations[i] = readLine().replace(/\s+$/g, '').split(' ').map(operationsTemp => parseInt(operationsTemp, 10));
    }

    const result = processOperations(stock, operations);

    console.log(result.join('\n'));
}
