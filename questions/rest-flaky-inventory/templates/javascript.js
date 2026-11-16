'use strict';

const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8000';

process.stdin.resume();
process.stdin.setEncoding('utf-8');

let inputString = '';
let currentLine = 0;

process.stdin.on('data', function(inputStdin) {
    inputString += inputStdin;
});

process.stdin.on('end', function() {
    inputString = inputString.split('\n');

    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
});

function readLine() {
    return inputString[currentLine++];
}

/*
 * Complete the 'stockByWarehouse' function below.
 *
 * The function is expected to return an array of [warehouse, total] pairs (through a Promise).
 * The function accepts STRING category as parameter.
 *
 * Stock: GET BASE_URL + '/api/stock?category=<category>&page=<n>'
 */

async function stockByWarehouse(category) {
    // Write your code here
    return [];
}

async function main() {
    const category = readLine().trim();

    const result = await stockByWarehouse(category);

    console.log(result.length ? result.map(([warehouse, total]) => `${warehouse} ${total}`).join('\n') : 'NONE');
}
