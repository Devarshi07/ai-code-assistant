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
 * Complete the 'totalPaid' function below.
 *
 * The function is expected to return an INTEGER (through a Promise).
 * The function accepts STRING customer as parameter.
 *
 * Orders: GET BASE_URL + '/api/orders?customer=<customer>&page=<n>'
 */

async function totalPaid(customer) {
    let total = 0;
    for (let page = 1, pages = 1; page <= pages; page++) {
        const params = new URLSearchParams({customer, page: String(page)});
        const response = await fetch(`${BASE_URL}/api/orders?${params}`);
        const body = await response.json();
        pages = body.total_pages;
        for (const order of body.data) if (order.status === 'paid') total += order.amount;
    }
    return total;
}

async function main() {
    const customer = readLine().trim();

    const result = await totalPaid(customer);

    console.log(result);
}
