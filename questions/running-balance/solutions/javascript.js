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
 * Complete the 'auditLedger' function below.
 *
 * The function is expected to return a LONG_INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER b
 *  2. INTEGER_ARRAY transactions
 */

function auditLedger(b, transactions) {
    let balance = b;
    let lowest = b;
    let firstNegative = -1;
    for (let i = 0; i < transactions.length; i++) {
        balance += transactions[i];
        if (balance < 0 && firstNegative === -1) firstNegative = i + 1;
        if (balance < lowest) lowest = balance;
    }
    return [firstNegative, lowest];
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const b = parseInt(firstMultipleInput[1], 10);

    const transactions = readLine().replace(/\s+$/g, '').split(' ').map(transactionsTemp => parseInt(transactionsTemp, 10));

    const result = auditLedger(b, transactions);

    console.log(result.join(' '));
}
