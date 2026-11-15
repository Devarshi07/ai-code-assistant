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
 * Complete the 'daysUntilWarmer' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts INTEGER_ARRAY temperatures as parameter.
 */

function daysUntilWarmer(temperatures) {
    const n = temperatures.length;
    const answer = new Array(n).fill(0);
    // Days still waiting for a warmer reading. Their readings never rise from
    // the bottom of the stack to the top, so a new reading settles them from the top.
    const waiting = [];
    for (let i = 0; i < n; i++) {
        const t = temperatures[i];
        while (waiting.length && temperatures[waiting[waiting.length - 1]] < t) {
            const j = waiting.pop();
            answer[j] = i - j;
        }
        waiting.push(i);
    }
    return answer;
}

function main() {
    const n = parseInt(readLine().trim(), 10);

    const temperatures = readLine().replace(/\s+$/g, '').split(' ').map(temperaturesTemp => parseInt(temperaturesTemp, 10));

    const result = daysUntilWarmer(temperatures);

    console.log(result.join(' '));
}
