import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GraphError, SocialGraph } from '../src/graph.ts';
import { User } from '../src/models.ts';
import { loadSample } from '../src/loader.ts';
import { recommend } from '../src/recommend.ts';
import type { Suggestion } from '../src/recommend.ts';

// A reading club. Ana is friends with Ben, Cai and Dev; Ben and Cai are also
// friends with each other. Members are added out of alphabetical order on purpose.
const CLUB_MEMBERS: [string, string[]][] = [
  ['ana', ['jazz', 'film', 'chess']],
  ['ben', ['film']],
  ['cai', ['jazz']],
  ['dev', ['poetry']],
  ['ida', ['chess']],
  ['eve', []],
  ['kim', ['film', 'chess']],
  ['gus', ['jazz', 'film']],
  ['fay', ['jazz']],
  ['hal', ['chess']],
  ['jon', ['jazz', 'film', 'chess']],
  ['zed', ['jazz']],
];
const CLUB_FRIENDSHIPS: [string, string][] = [
  ['ana', 'ben'], ['ana', 'cai'], ['ana', 'dev'], ['ben', 'cai'],
  ['eve', 'ben'], ['eve', 'cai'], ['eve', 'dev'],
  ['fay', 'ben'], ['fay', 'cai'],
  ['gus', 'ben'], ['gus', 'dev'],
  ['hal', 'cai'], ['kim', 'cai'], ['ida', 'dev'],
  ['jon', 'eve'],
];

interface ClubOptions {
  blocks?: [string, string][];
  inactive?: string[];
}

function club({ blocks = [], inactive = [] }: ClubOptions = {}): SocialGraph {
  const graph = new SocialGraph();
  for (const [id, interests] of CLUB_MEMBERS) graph.addUser(new User(id, id[0].toUpperCase() + id.slice(1), '2023-03-01', interests));
  for (const [a, b] of CLUB_FRIENDSHIPS) graph.addFriendship(a, b);
  for (const [blocker, blocked] of blocks) graph.block(blocker, blocked);
  for (const id of inactive) graph.deactivate(id);
  return graph;
}

const asTuples = (suggestions: Suggestion[]) => suggestions.map(s => [s.userId, s.mutual, s.shared]);
const ids = (suggestions: Suggestion[]) => suggestions.map(s => s.userId);

/** Every suggestion obeys the rules, and the list is in ranking order. */
function assertValid(graph: SocialGraph, userId: string, suggestions: Suggestion[], k: number): void {
  const me = graph.user(userId);
  assert.ok(Array.isArray(suggestions), 'recommend must return an array');
  assert.ok(suggestions.length <= Math.max(k, 0));
  assert.equal(new Set(ids(suggestions)).size, suggestions.length, 'duplicate suggestion');
  for (const s of suggestions) {
    const other = graph.user(s.userId);
    assert.notEqual(s.userId, userId, 'never suggest members to themselves');
    assert.ok(!graph.friendsOf(userId).has(s.userId), `${s.userId} is already a friend`);
    assert.ok(other.active, `${s.userId} is deactivated`);
    assert.ok(!graph.hasBlocked(userId, s.userId) && !graph.hasBlocked(s.userId, userId), `${s.userId} and ${userId} are blocked`);
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

describe('recommend', () => {
  test('ranks friends of friends by mutual friends', () => {
    const graph = club();
    const got = recommend(graph, 'ana', 10);
    assert.deepEqual(ids(got).slice(0, 3), ['eve', 'gus', 'fay']);
    assert.deepEqual(got[0], { userId: 'eve', mutual: 3, shared: 0 });
    assertValid(graph, 'ana', got, 10);
  });

  test('ties break on shared interests then id', () => {
    assert.deepEqual(asTuples(recommend(club(), 'ana', 10)), [
      ['eve', 3, 0], ['gus', 2, 2], ['fay', 2, 1],
      ['kim', 1, 2], ['hal', 1, 1], ['ida', 1, 1],
    ]);
  });

  test('k limits the list', () => {
    const graph = club();
    assert.deepEqual(asTuples(recommend(graph, 'ana', 2)), [['eve', 3, 0], ['gus', 2, 2]]);
    assert.deepEqual(recommend(graph, 'ana', 0), []);
    assert.equal(recommend(graph, 'ana', 50).length, 6);
    assert.equal(recommend(graph, 'ana').length, 5, 'k defaults to 5');
  });

  test('self and existing friends are never suggested', () => {
    const graph = club();
    const got = recommend(graph, 'ben', 10);
    assert.deepEqual(asTuples(got), [['dev', 3, 0], ['jon', 1, 1], ['kim', 1, 1], ['hal', 1, 0]]);
    assertValid(graph, 'ben', got, 10);
  });

  test('members without mutual friends are not suggested', () => {
    const graph = club();
    assert.ok(!ids(recommend(graph, 'ana', 50)).includes('jon'));
    assert.deepEqual(recommend(graph, 'zed', 5), [], 'zed has no friends yet');
  });

  test('blocks hide members in both directions', () => {
    const graph = club({ blocks: [['ana', 'gus'], ['fay', 'ana']] });
    assert.deepEqual(asTuples(recommend(graph, 'ana', 10)), [['eve', 3, 0], ['kim', 1, 2], ['hal', 1, 1], ['ida', 1, 1]]);
    assert.ok(!ids(recommend(graph, 'fay', 10)).includes('ana'));
    assert.ok(!ids(recommend(graph, 'gus', 10)).includes('ana'));
  });

  test('deactivated members are not suggested or counted', () => {
    const graph = club({ inactive: ['eve', 'dev'] });
    const got = recommend(graph, 'ana', 10);
    assert.deepEqual(asTuples(got), [['fay', 2, 1], ['gus', 1, 2], ['kim', 1, 2], ['hal', 1, 1]]);
    assertValid(graph, 'ana', got, 10);
  });

  test('unknown member throws', () => {
    assert.throws(() => recommend(club(), 'nobody', 3), GraphError);
  });

  test('recommend does not change the graph', () => {
    const graph = club({ blocks: [['fay', 'ana']], inactive: ['dev'] });
    const snapshot = () => graph.users().map(u => [u.id, [...graph.friendsOf(u.id)].sort().join(','), u.active]);
    const before = snapshot();
    for (const user of graph.users()) recommend(graph, user.id, 3);
    assert.deepEqual(snapshot(), before);
    assert.ok(graph.hasBlocked('fay', 'ana'));
  });
});

describe('sample network', () => {
  test('sample suggestions', () => {
    const graph = loadSample();
    assert.deepEqual(asTuples(recommend(graph, 'alice', 3)), [['judy', 3, 2], ['olivia', 2, 2], ['trent', 1, 2]]);
    assert.deepEqual(asTuples(recommend(graph, 'olivia', 10)), [
      ['alice', 2, 2], ['carol', 2, 1], ['judy', 2, 1], ['victor', 2, 1], ['bob', 1, 1], ['ivan', 1, 1],
    ]);
  });

  test('sample respects deactivated accounts', () => {
    const graph = loadSample();
    assert.deepEqual(asTuples(recommend(graph, 'dave', 10)), [['erin', 1, 1], ['sybil', 1, 1], ['heidi', 1, 0], ['mallory', 1, 0]]);
    assert.deepEqual(asTuples(recommend(graph, 'niaj', 10)), [['bob', 1, 2], ['ivan', 1, 1]]);
    assert.deepEqual(recommend(graph, 'peggy', 10), []);
  });

  test('every sample list follows the rules', () => {
    const graph = loadSample();
    for (const user of graph.users()) assertValid(graph, user.id, recommend(graph, user.id, 4), 4);
  });
});
