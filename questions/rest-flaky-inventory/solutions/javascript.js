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

async function getJson(url, attempts = 5) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        const response = await fetch(url);
        if (response.status === 429) {
            const wait = Number(response.headers.get('retry-after') || 1);
            await new Promise(resolve => setTimeout(resolve, wait * 1000));
            continue;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return response.json();
    }
    throw new Error(`still rate limited after ${attempts} attempts: ${url}`);
}

async function stockByWarehouse(category) {
    const totals = new Map();
    for (let page = 1, pages = 1; page <= pages; page++) {
        const params = new URLSearchParams({category, page: String(page)});
        const body = await getJson(`${BASE_URL}/api/stock?${params}`);
        pages = body.total_pages;
        for (const record of body.data) totals.set(record.warehouse, (totals.get(record.warehouse) || 0) + record.quantity);
    }
    return [...totals].filter(([, total]) => total > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

async function main() {
    const category = readLine().trim();

    const result = await stockByWarehouse(category);

    console.log(result.length ? result.map(([warehouse, total]) => `${warehouse} ${total}`).join('\n') : 'NONE');
}
