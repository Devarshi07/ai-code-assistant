import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import type { Selection } from '../src/models.ts';
import { bestSelection } from '../src/solver.ts';
import { longWordPack, shortWordPack } from './theme-packs.ts';

/** Independent check: a real board built from the candidates, honestly scored. */
function assertValidSelection(candidates: string[], result: Selection): void {
  const pool = new Set(candidates.map(c => c.trim().toLowerCase()));
  const words = [...result.words];
  assert.deepEqual(words, [...words].sort(), 'words must be in alphabetical order');
  const seen = new Set<string>();
  for (const word of words) {
    assert.ok(pool.has(word), `'${word}' is not one of the candidates`);
    assert.equal(new Set(word).size, word.length, `'${word}' repeats a letter`);
    for (const ch of word) {
      assert.ok(!seen.has(ch), `'${word}' reuses '${ch}', which is already on the board`);
      seen.add(ch);
    }
  }
  assert.equal(result.total, words.reduce((sum, word) => sum + word.length, 0), 'total must count every tile');
}

function check(candidates: string[], words: string[], total: number): void {
  const result = bestSelection(candidates);
  assertValidSelection(candidates, result);
  assert.equal(result.total, total);
  assert.deepEqual([...result.words], words);
}

function timed(candidates: string[], words: string[], total: number, limitMs: number): void {
  const start = performance.now();
  const result = bestSelection(candidates);
  const elapsed = performance.now() - start;
  assertValidSelection(candidates, result);
  assert.equal(result.total, total);
  assert.deepEqual([...result.words], words);
  assert.ok(elapsed < limitMs, `took ${elapsed.toFixed(0)}ms; a ${candidates.length}-word pack must solve in under ${limitMs}ms`);
}

describe('scale', () => {
  test('anagram spellings keep the alphabetical tie-break', () => {
    const candidates = ['stop', 'pots', 'tops', 'opts', 'spot', 'post', 'Chew', 'chew', 'cheww', 'pod', 'tan', 'and', 'top'];
    check(candidates, ['and', 'chew', 'opts'], 11);
  });

  test('small short-word pack', () => {
    // 16 boards tie on 20 letters.
    check(shortWordPack(5, 70), ['dqat', 'ek', 'fpsn', 'hy', 'ir', 'jm', 'zwlo'], 20);
  });

  test('medium short-word pack', () => {
    // 52 boards over five different letter sets tie on 21 letters.
    check(shortWordPack(21, 120), ['cq', 'eb', 'gn', 'iay', 'mh', 'oz', 'srx', 'tdw', 'vu'], 21);
  });

  test('small long-word pack', () => {
    // 512 spellings of the same board tie on 20 letters.
    check(longWordPack(6, 150), ['azlhmby', 'cgoq', 'iwju', 'svdrt'], 20);
  });

  test('medium long-word pack', () => {
    check(longWordPack(8, 250), ['abktj', 'cxuonyz', 'dwep', 'hvqlmr'], 22);
  });

  test('large short-word pack is fast', () => {
    timed(shortWordPack(11, 240), ['ai', 'bw', 'cv', 'ez', 'fo', 'kut', 'lh', 'pqs', 'rm', 'xgd', 'yn'], 25, 150);
  });

  test('large long-word pack is fast', () => {
    timed(longWordPack(13, 1000), ['abyqjn', 'csme', 'dxkw', 'futp', 'liozghv'], 25, 150);
  });
});
