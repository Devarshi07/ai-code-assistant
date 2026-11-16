import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SocialGraph } from '../src/graph.ts';
import { User } from '../src/models.ts';
import { recommend } from '../src/recommend.ts';
import type { Suggestion } from '../src/recommend.ts';
import { buildNetwork, memberId } from './generator.ts';

// Ana and Bea both know an organiser with 40 friends. Bea also knows c07 and
// c21, and only c30 shares one of Ana's interests. The organiser's friends are
// added in reverse id order.
const ORGANISER_FRIENDS = Array.from({ length: 40 }, (_, i) => `c${String(39 - i).padStart(2, '0')}`);

const LARGE_LIMIT_MS = 600; // for the whole batch
const LARGE_ORGANISERS = ['m11298', 'm21194', 'm02945']; // the members with the most friends
const EXPECTED_FINGERPRINT = 553887438;

interface Exclusions {
  blocks?: [string, string][];
  inactive?: string[];
}

function organiserNetwork({ blocks = [], inactive = [] }: Exclusions = {}): SocialGraph {
  const graph = new SocialGraph();
  const members: [string, string[]][] = [['ana', ['jazz', 'film']], ['bea', ['film']], ['hub', ['chess']]];
  for (const c of ORGANISER_FRIENDS) members.push([c, c === 'c30' ? ['jazz'] : []]);
  for (const [id, interests] of members) graph.addUser(new User(id, id[0].toUpperCase() + id.slice(1), '2022-09-01', interests));
  for (const [a, b] of [['ana', 'hub'], ['ana', 'bea'], ['bea', 'hub']]) graph.addFriendship(a, b);
  for (const c of ORGANISER_FRIENDS) graph.addFriendship('hub', c);
  graph.addFriendship('bea', 'c21');
  graph.addFriendship('bea', 'c07');
  for (const [blocker, blocked] of blocks) graph.block(blocker, blocked);
  for (const id of inactive) graph.deactivate(id);
  return graph;
}

let club: SocialGraph | null = null;
let large: SocialGraph | null = null;
const clubNetwork = () => (club ??= buildNetwork(5, 3000, { organisers: 2, reach: 150, blocks: 200, inactive: 60 }));
const largeNetwork = () => (large ??= buildNetwork(11, 30000, { organisers: 6, reach: 600, blocks: 300, inactive: 600 }));

const asTuples = (suggestions: Suggestion[]) => suggestions.map(s => [s.userId, s.mutual, s.shared]);

/** 32-bit FNV-1a hash of every query's suggestions, in order. */
function fingerprint(results: [string, Suggestion[]][]): number {
  const text = results
    .map(([userId, suggestions]) => userId + '>' + suggestions.map(s => `${s.userId}:${s.mutual}:${s.shared}`).join(','))
    .join('|');
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
  return value;
}

/** Every suggestion obeys the rules, and the list is in ranking order. */
function assertValid(graph: SocialGraph, userId: string, suggestions: Suggestion[], k: number): void {
  const me = graph.user(userId);
  assert.ok(suggestions.length <= k);
  assert.equal(new Set(suggestions.map(s => s.userId)).size, suggestions.length, 'duplicate suggestion');
  for (const s of suggestions) {
    const other = graph.user(s.userId);
    assert.notEqual(s.userId, userId);
    assert.ok(!graph.friendsOf(userId).has(s.userId), `${s.userId} is already a friend of ${userId}`);
    assert.ok(other.active, `${s.userId} is deactivated`);
    assert.ok(!graph.blockedEither(userId, s.userId), `${s.userId} and ${userId} are blocked`);
    const mutual = [...graph.friendsOf(userId)].filter(f => graph.user(f).active && graph.friendsOf(f).has(s.userId));
    assert.equal(s.mutual, mutual.length, `mutual count for ${s.userId}`);
    assert.ok(s.mutual > 0);
    assert.equal(s.shared, [...me.interests].filter(tag => other.interests.has(tag)).length, `shared interests for ${s.userId}`);
  }
  for (let i = 1; i < suggestions.length; i++) {
    const a = suggestions[i - 1];
    const b = suggestions[i];
    const inOrder = a.mutual > b.mutual || (a.mutual === b.mutual && (a.shared > b.shared || (a.shared === b.shared && a.userId < b.userId)));
    assert.ok(inOrder, `${a.userId} must not be ranked above ${b.userId}`);
  }
}

describe('scale', () => {
  test('organiser ties break on interests then id', () => {
    const graph = organiserNetwork();
    assert.deepEqual(asTuples(recommend(graph, 'ana', 4)), [['c07', 2, 0], ['c21', 2, 0], ['c30', 1, 1], ['c00', 1, 0]]);
    assert.deepEqual(asTuples(recommend(graph, 'bea', 3)), [['c00', 1, 0], ['c01', 1, 0], ['c02', 1, 0]]);
    const everyone = recommend(graph, 'ana', 100);
    assert.equal(everyone.length, 40);
    assertValid(graph, 'ana', everyone, 100);
  });

  test('exclusions still apply', () => {
    const graph = organiserNetwork({ blocks: [['ana', 'c01']], inactive: ['c00'] });
    assert.deepEqual(asTuples(recommend(graph, 'ana', 4)), [['c07', 2, 0], ['c21', 2, 0], ['c30', 1, 1], ['c02', 1, 0]]);
    const quiet = organiserNetwork({ inactive: ['hub'] });
    assert.deepEqual(asTuples(recommend(quiet, 'ana', 4)), [['c07', 1, 0], ['c21', 1, 0]]);
    assert.deepEqual(recommend(quiet, 'ana', 0), []);
  });

  test('generated club network', () => {
    const graph = clubNetwork();
    const expected: Record<string, [string, number, number][]> = {
      m00004: [['m00039', 4, 0], ['m00001', 3, 2], ['m00040', 3, 1], ['m00014', 3, 0], ['m00026', 3, 0]],
      m00006: [['m00044', 5, 0], ['m00002', 4, 1], ['m00000', 4, 0], ['m00011', 4, 0], ['m00007', 3, 2]],
      m00146: [['m00108', 4, 0], ['m00118', 3, 0], ['m00138', 3, 0], ['m00128', 2, 2], ['m00107', 2, 1]],
      m01230: [['m01232', 6, 0], ['m01242', 4, 1], ['m01214', 4, 0], ['m01202', 3, 1], ['m01227', 3, 0]],
      m01945: [['m00984', 7, 1], ['m01943', 7, 0], ['m01912', 5, 1], ['m01736', 5, 0], ['m01738', 5, 0]],
      m02718: [['m02722', 4, 1], ['m02709', 4, 0], ['m02725', 4, 0], ['m02744', 4, 0], ['m02707', 3, 1]],
    };
    for (const [userId, want] of Object.entries(expected)) {
      assert.deepEqual(asTuples(recommend(graph, userId, 5)), want, `suggestions for ${userId}`);
    }
  });

  test('generated network follows the rules', () => {
    const graph = clubNetwork();
    for (let index = 0; index < 3000; index += 97) assertValid(graph, memberId(index), recommend(graph, memberId(index), 8), 8);
  });

  test('large network batch is fast', () => {
    const graph = largeNetwork();
    const queries: string[] = [];
    for (let index = 0; index < 30000; index += 75) queries.push(memberId(index));
    queries.push(...LARGE_ORGANISERS);
    const start = performance.now();
    const results = queries.map((userId): [string, Suggestion[]] => [userId, recommend(graph, userId, 10)]);
    const elapsed = performance.now() - start;
    assert.equal(results.reduce((total, [, s]) => total + s.length, 0), 4030);
    assert.deepEqual(asTuples(results[0][1].slice(0, 3)), [['m00033', 5, 0], ['m00015', 4, 1], ['m00039', 4, 1]]);
    for (const [userId, suggestions] of [...results.filter((_, i) => i % 10 === 0), ...results.slice(-3)]) {
      assertValid(graph, userId, suggestions, 10);
    }
    assert.equal(fingerprint(results), EXPECTED_FINGERPRINT, 'batch results differ from the reference');
    assert.ok(elapsed < LARGE_LIMIT_MS,
      `${queries.length} recommend calls took ${elapsed.toFixed(0)}ms; they must finish in under ${LARGE_LIMIT_MS}ms`);
  });
});
