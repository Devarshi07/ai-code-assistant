const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { SocialGraph, GraphError } = require('../src/graph');
const { User } = require('../src/models');
const { LoadError, applyActivity, loadMembersCsv, loadSample } = require('../src/loader');
const { friendList, networkSummary, profileCard } = require('../src/report');

function makeGraph(...ids) {
  const graph = new SocialGraph();
  for (const id of ids) graph.addUser(new User(id, id[0].toUpperCase() + id.slice(1), '2022-05-01'));
  return graph;
}

const friends = (graph, id) => [...graph.friendsOf(id)].sort();

describe('friendships', () => {
  test('friendship is mutual', () => {
    const graph = makeGraph('alice', 'bob');
    assert.equal(graph.addFriendship('alice', 'bob'), true);
    assert.deepEqual(friends(graph, 'alice'), ['bob']);
    assert.deepEqual(friends(graph, 'bob'), ['alice']);
    assert.ok(graph.areFriends('bob', 'alice'));
  });

  test('adding a friendship twice is harmless', () => {
    const graph = makeGraph('alice', 'bob');
    graph.addFriendship('alice', 'bob');
    assert.equal(graph.addFriendship('bob', 'alice'), false);
    assert.equal(graph.friendCount('alice'), 1);
    assert.equal(graph.friendshipCount(), 1);
  });

  test('members cannot befriend themselves', () => {
    assert.throws(() => makeGraph('alice').addFriendship('alice', 'alice'), GraphError);
  });

  test('unfriending clears both friend lists', () => {
    const graph = makeGraph('alice', 'bob', 'carol');
    graph.addFriendship('alice', 'bob');
    graph.addFriendship('alice', 'carol');
    assert.equal(graph.removeFriendship('bob', 'alice'), true);
    assert.deepEqual(friends(graph, 'bob'), []);
    assert.deepEqual(friends(graph, 'alice'), ['carol'], 'Bob unfriended Alice, so he must leave her list too');
    assert.equal(graph.areFriends('alice', 'bob'), false);
  });

  test('friending again after an unfriend', () => {
    const graph = makeGraph('alice', 'bob');
    graph.addFriendship('alice', 'bob');
    graph.removeFriendship('bob', 'alice');
    assert.equal(graph.addFriendship('alice', 'bob'), true, 'they were no longer friends');
    assert.deepEqual(friends(graph, 'alice'), ['bob']);
    assert.deepEqual(friends(graph, 'bob'), ['alice']);
  });

  test('mutual friends skip ended friendships', () => {
    const graph = makeGraph('alice', 'bob', 'carol', 'erin');
    for (const [a, b] of [['alice', 'bob'], ['alice', 'carol'], ['erin', 'bob'], ['erin', 'carol']]) graph.addFriendship(a, b);
    assert.deepEqual(graph.mutualFriends('erin', 'alice'), ['bob', 'carol']);
    graph.removeFriendship('bob', 'alice');
    assert.deepEqual(graph.mutualFriends('erin', 'alice'), ['carol']);
    assert.deepEqual(graph.mutualFriends('alice', 'erin'), ['carol']);
  });
});

describe('blocks', () => {
  test('blocks are one directional', () => {
    const graph = makeGraph('carol', 'dave');
    graph.block('carol', 'dave');
    assert.equal(graph.hasBlocked('carol', 'dave'), true);
    assert.equal(graph.hasBlocked('dave', 'carol'), false);
    assert.equal(graph.blockedEither('dave', 'carol'), true);
  });

  test('blocked members cannot become friends', () => {
    const graph = makeGraph('carol', 'dave');
    graph.block('dave', 'carol');
    assert.throws(() => graph.addFriendship('carol', 'dave'), GraphError);
  });

  test('blocking a friend ends the friendship for both', () => {
    const graph = makeGraph('judy', 'peggy', 'rupert');
    graph.addFriendship('judy', 'peggy');
    graph.addFriendship('peggy', 'rupert');
    graph.block('judy', 'peggy');
    assert.deepEqual(friends(graph, 'judy'), []);
    assert.deepEqual(friends(graph, 'peggy'), ['rupert'], "Judy blocked Peggy, so she must leave Peggy's list");
  });

  test('unblocking does not restore the friendship', () => {
    const graph = makeGraph('frank', 'heidi');
    graph.addFriendship('frank', 'heidi');
    graph.block('heidi', 'frank');
    graph.unblock('heidi', 'frank');
    assert.equal(graph.blockedEither('frank', 'heidi'), false);
    assert.equal(graph.areFriends('frank', 'heidi'), false);
    assert.equal(graph.areFriends('heidi', 'frank'), false);
  });
});

describe('loader', () => {
  test('members csv reads names, dates and interests', () => {
    const graph = loadMembersCsv('id,name,joined,interests\n' +
      'dana,"Dana Park, PhD",2021-11-30,Board Games; jazz\n' +
      'eli,Eli Stone,2022-01-02,\n');
    const dana = graph.user('dana');
    assert.equal(dana.name, 'Dana Park, PhD');
    assert.equal(dana.joined, '2021-11-30');
    assert.deepEqual([...dana.interests].sort(), ['board-games', 'jazz']);
    assert.equal(graph.user('eli').interests.size, 0);
  });

  test('activity errors name the line', () => {
    const graph = makeGraph('alice', 'bob');
    assert.throws(() => applyActivity(graph, '# header\nfriend alice bob\n\nfriend alice zoe\n'),
      error => error instanceof LoadError && /line 4/.test(error.message));
  });

  test('sample friend lists', () => {
    const graph = loadSample();
    assert.equal(friendList(graph, 'bob'), 'Bob Okafor (@bob) has 3 friends: Dave Ferreira, Erin Walsh, Ivan Petrov');
    assert.equal(friendList(graph, 'alice'), 'Alice Moreno (@alice) has 3 friends: Carol Lindqvist, Erin Walsh, Grace Kim');
    assert.equal(friendList(graph, 'peggy'), 'Peggy Sousa (@peggy) has 1 friend: Rupert Hale');
    assert.equal(friendList(graph, 'frank'), 'Frank Osei (@frank) has 2 friends: Carol Lindqvist, Mallory Quinn');
  });

  test('sample friend lists agree both ways', () => {
    const graph = loadSample();
    for (const user of graph.users()) {
      for (const friend of graph.friendsOf(user.id)) {
        assert.ok(graph.areFriends(friend, user.id), `${user.id} lists ${friend} as a friend, but ${friend} does not list ${user.id}`);
      }
    }
  });

  test('sample summary and profile', () => {
    const graph = loadSample();
    assert.equal(networkSummary(graph), '18 members (1 deactivated), 28 friendships, 2 blocks');
    const card = profileCard(graph, 'erin', 'alice');
    assert.ok(card.includes('  3 friends'), card);
    assert.ok(card.includes('2 mutual friends with Erin: Carol, Grace'), card);
  });
});
