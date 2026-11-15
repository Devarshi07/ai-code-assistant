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
 * Complete the 'longestClimb' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts INTEGER_ARRAY alt as parameter.
 */

function longestClimb(alt) {
    const MOD = 1000000007;
    // A Fenwick tree over value ranks: node i stores the longest climb ending at a
    // value whose rank lies in its range, and how many such climbs there are.
    // Counts stay below 2^53 between reductions, so plain numbers are exact.
    const sorted = Int32Array.from(alt).sort();
    const distinct = [];
    for (let i = 0; i < sorted.length; i++) if (i === 0 || sorted[i] !== sorted[i - 1]) distinct.push(sorted[i]);
    const rank = new Map();
    distinct.forEach((v, i) => rank.set(v, i + 1));
    const size = distinct.length;
    const treeLen = new Int32Array(size + 1);
    const treeCnt = new Float64Array(size + 1);
    for (const v of alt) {
        const r = rank.get(v);
        let best = 0, ways = 1;
        for (let i = r - 1; i > 0; i &= i - 1) {
            if (treeLen[i] > best) { best = treeLen[i]; ways = treeCnt[i]; }
            else if (treeLen[i] === best) ways += treeCnt[i];
        }
        best++;
        ways %= MOD;
        for (let i = r; i <= size; i += i & -i) {
            if (treeLen[i] < best) { treeLen[i] = best; treeCnt[i] = ways; }
            else if (treeLen[i] === best) treeCnt[i] = (treeCnt[i] + ways) % MOD;
        }
    }
    let best = 0, ways = 0;
    for (let i = size; i > 0; i &= i - 1) {
        if (treeLen[i] > best) { best = treeLen[i]; ways = treeCnt[i]; }
        else if (treeLen[i] === best) ways += treeCnt[i];
    }
    return [best, ways % MOD];
}

function main() {
    const n = parseInt(readLine().trim(), 10);

    const alt = readLine().replace(/\s+$/g, '').split(' ').map(altTemp => parseInt(altTemp, 10));

    const result = longestClimb(alt);

    console.log(result.join(' '));
}
