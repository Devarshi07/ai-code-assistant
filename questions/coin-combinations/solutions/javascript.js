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
 * Complete the 'countWays' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts following parameters:
 *  1. INTEGER amount
 *  2. INTEGER_ARRAY coins
 */

function countWays(amount, coins) {
    const MOD = 1000000007;
    // ways[a] = number of payouts for amount a using the coins processed so far
    const ways = new Array(amount + 1).fill(0);
    ways[0] = 1;
    for (const c of coins) {
        for (let a = c; a <= amount; a++) {
            ways[a] = (ways[a] + ways[a - c]) % MOD;
        }
    }
    return ways[amount];
}

function main() {
    const firstMultipleInput = readLine().replace(/\s+$/g, '').split(' ');

    const n = parseInt(firstMultipleInput[0], 10);

    const amount = parseInt(firstMultipleInput[1], 10);

    const coins = readLine().replace(/\s+$/g, '').split(' ').map(coinsTemp => parseInt(coinsTemp, 10));

    const result = countWays(amount, coins);

    console.log(result);
}
