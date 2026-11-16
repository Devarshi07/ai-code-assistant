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
 * Complete the 'topRated' function below.
 *
 * The function is expected to return a STRING_ARRAY (through a Promise).
 * The function accepts following parameters:
 *  1. STRING genre
 *  2. INTEGER minYear
 *  3. INTEGER k
 *
 * Movies: GET BASE_URL + '/api/movies?genre=<genre>&page=<n>'
 */

async function topRated(genre, minYear, k) {
    const movies = [];
    for (let page = 1, pages = 1; page <= pages; page++) {
        const params = new URLSearchParams({genre, page: String(page)});
        const body = await (await fetch(`${BASE_URL}/api/movies?${params}`)).json();
        pages = body.total_pages;
        movies.push(...body.data.filter(movie => movie.year >= minYear));
    }
    movies.sort((a, b) => b.rating - a.rating || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
    return movies.slice(0, k).map(movie => movie.title);
}

async function main() {
    const genre = readLine().trim();

    const minYear = parseInt(readLine().trim(), 10);

    const k = parseInt(readLine().trim(), 10);

    const result = await topRated(genre, minYear, k);

    console.log(result.length ? result.join('\n') : 'NONE');
}
