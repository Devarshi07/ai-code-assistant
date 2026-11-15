// Hidden acceptance tests for TinyLink. They use only the documented interface.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { TinyLink } = require('../src/tinylink');
const {
  AliasTakenError,
  InvalidAliasError,
  InvalidExpiryError,
  InvalidUrlError,
  LinkDeletedError,
  LinkExpiredError,
  LinkNotFoundError,
  QuotaExceededError,
  RestoreConflictError,
  TinyLinkError,
  ValidationError,
} = require('../src/errors');

const T0 = 1_700_000_000_000;
const DAY = 86_400_000;
const URL_ = 'https://example.com/landing';
const url = i => `https://example.com/${i}`;

function generate(links, count, owner = 'alice', now = T0) {
  const codes = [];
  for (let i = 0; i < count; i++) codes.push(links.create(url(i), owner, now));
  return codes;
}

// Runs fn, asserts it throws an instance of Klass, and returns the error.
function expectError(fn, Klass, label = '') {
  let caught = null;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  const where = label ? ` (${label})` : '';
  assert.ok(caught !== null, `expected ${Klass.name} to be thrown${where}, but nothing was thrown`);
  assert.ok(caught instanceof Klass, `expected ${Klass.name}${where}, got ${caught && caught.name}: ${caught && caught.message}`);
  return caught;
}

describe('code generation', () => {
  test('codes follow base62 order across digit boundaries', () => {
    const codes = generate(new TinyLink(), 63);
    assert.equal(codes[0], '000001');
    assert.equal(codes[8], '000009');
    assert.equal(codes[9], '00000A');
    assert.equal(codes[34], '00000Z');
    assert.equal(codes[35], '00000a');
    assert.equal(codes[60], '00000z');
    assert.equal(codes[61], '000010');
    assert.equal(codes[62], '000011');
    assert.equal(new Set(codes).size, 63);
  });

  test('counter rolls over to a third digit', () => {
    const codes = generate(new TinyLink(), 3844);
    assert.equal(codes[3842], '0000zz');
    assert.equal(codes[3843], '000100');
  });

  test('generator skips and consumes codes taken by aliases', () => {
    const links = new TinyLink();
    assert.equal(links.create(URL_, 'bob', T0, { alias: '000002' }), '000002');
    assert.deepEqual(generate(links, 3), ['000001', '000003', '000004']);
  });

  test('generator skip ignores case against aliases', () => {
    const links = new TinyLink();
    links.create(URL_, 'bob', T0, { alias: '00000a' });
    const codes = generate(links, 11);
    assert.equal(codes[8], '000009');
    assert.equal(codes[9], '00000B');
    assert.equal(codes[10], '00000C');
  });

  test('generator never reissues the code of a deleted alias', () => {
    const links = new TinyLink();
    links.create(URL_, 'alice', T0, { alias: '000001' });
    links.delete('000001');
    assert.equal(links.create(URL_, 'alice', T0), '000002');
  });
});

describe('url validation', () => {
  test('accepts valid URLs and returns them unchanged', () => {
    const longest = 'https://example.com/' + 'a'.repeat(2028);
    assert.equal(longest.length, 2048);
    const valid = [
      'http://a',
      'HTTPS://Example.COM/Path?q=1#frag',
      'Http://example.com:8080',
      'https://x?y=1',
      'https://x#top',
      longest,
    ];
    const links = new TinyLink();
    for (const target of valid) {
      const code = links.create(target, 'alice', T0);
      assert.equal(links.resolve(code, T0, 'v1'), target, `url ${target.slice(0, 60)}`);
    }
  });

  test('rejects URLs without an http scheme or host', () => {
    const invalid = [
      '',
      'example.com',
      'ftp://example.com',
      '//example.com',
      'javascript:alert(1)',
      'mailto:team@example.com',
      'http:/example.com',
      'httpx://example.com',
      'http://',
      'https://',
      'https:///path',
      'https://?q=1',
      'http://#top',
    ];
    const links = new TinyLink();
    for (const target of invalid) expectError(() => links.create(target, 'alice', T0), InvalidUrlError, JSON.stringify(target));
  });

  test('rejects whitespace and URLs over 2048 characters', () => {
    const tooLong = 'https://example.com/' + 'a'.repeat(2029);
    assert.equal(tooLong.length, 2049);
    const invalid = [
      'http://exa mple.com',
      'https://example.com/a b',
      'https://example.com/\t',
      'https://example.com\n',
      'https://example.com/x\r',
      tooLong,
    ];
    const links = new TinyLink();
    for (const target of invalid) {
      const label = JSON.stringify(target.slice(0, 40));
      const error = expectError(() => links.create(target, 'alice', T0), InvalidUrlError, label);
      assert.ok(error instanceof ValidationError, `InvalidUrlError should extend ValidationError ${label}`);
      assert.ok(error instanceof TinyLinkError, `InvalidUrlError should extend TinyLinkError ${label}`);
    }
  });
});

describe('aliases', () => {
  test('alias length is 3 to 30 inclusive', () => {
    const links = new TinyLink();
    assert.equal(links.create(URL_, 'alice', T0, { alias: 'abc' }), 'abc');
    assert.equal(links.create(URL_, 'alice', T0, { alias: 'x'.repeat(30) }), 'x'.repeat(30));
    for (const alias of ['', 'ab', 'y'.repeat(31)]) {
      const error = expectError(() => links.create(URL_, 'alice', T0, { alias }), InvalidAliasError, JSON.stringify(alias));
      assert.ok(error instanceof ValidationError);
    }
  });

  test('alias characters are ASCII letters, digits and hyphen', () => {
    const links = new TinyLink();
    for (const alias of ['a-b', '---', 'Q3-2024-Launch', '123']) {
      assert.equal(links.create(URL_, 'alice', T0, { alias }), alias);
    }
    for (const alias of ['spring_sale', 'spring.sale', 'spring sale', 'café-x', 'sale/2024', 'sale!', 'promo\n']) {
      expectError(() => links.create(URL_, 'alice', T0, { alias }), InvalidAliasError, JSON.stringify(alias));
    }
  });

  test('aliases are unique ignoring case across owners', () => {
    const links = new TinyLink();
    links.create(url(1), 'alice', T0, { alias: 'Promo' });
    for (const [owner, alias] of [['bob', 'PROMO'], ['alice', 'promo'], ['carol', 'Promo']]) {
      const error = expectError(() => links.create(url(2), owner, T0, { alias }), AliasTakenError, alias);
      assert.ok(error instanceof TinyLinkError);
      assert.ok(!(error instanceof ValidationError), 'AliasTakenError is not a ValidationError');
    }
    assert.equal(links.resolve('promo', T0, 'v1'), url(1));
  });

  test('alias cannot clash with a generated code', () => {
    const links = new TinyLink();
    generate(links, 10); // 000001 .. 000009, 00000A
    expectError(() => links.create(URL_, 'bob', T0, { alias: '000001' }), AliasTakenError, '000001');
    expectError(() => links.create(URL_, 'bob', T0, { alias: '00000a' }), AliasTakenError, '00000a');
    assert.equal(links.create(URL_, 'bob', T0, { alias: '00000b' }), '00000b');
    assert.equal(links.create(URL_, 'bob', T0), '00000C');
  });

  test('generated codes are case-sensitive but aliases are not', () => {
    const links = new TinyLink();
    const codes = generate(links, 10);
    assert.equal(links.resolve('00000A', T0, 'v1'), url(9));
    expectError(() => links.resolve('00000a', T0, 'v1'), LinkNotFoundError);
    assert.equal(codes[9], '00000A');
    links.create(URL_, 'alice', T0, { alias: 'Spring-Sale' });
    assert.equal(links.resolve('SPRING-SALE', T0, 'v1'), URL_);
    assert.equal(links.resolve('spring-sALE', T0, 'v1'), URL_);
    expectError(() => links.resolve('Spring-Sal', T0, 'v1'), LinkNotFoundError);
  });
});

describe('resolve and check order', () => {
  test('unknown codes throw LinkNotFoundError', () => {
    const links = new TinyLink();
    expectError(() => links.resolve('000001', T0, 'v1'), LinkNotFoundError, 'empty service');
    links.create(URL_, 'alice', T0);
    for (const code of ['000002', '00001', '1', '']) {
      const error = expectError(() => links.resolve(code, T0, 'v1'), LinkNotFoundError, JSON.stringify(code));
      assert.ok(error instanceof TinyLinkError);
    }
  });

  test('create reports the first problem and failures change nothing', () => {
    const links = new TinyLink();
    links.create(URL_, 'bob', T0, { alias: 'taken' });
    expectError(() => links.create('ftp://x.com', 'alice', T0, { alias: 'a' }), InvalidUrlError);
    expectError(() => links.create('ftp://x.com', 'alice', T0, { alias: 'taken' }), InvalidUrlError);
    expectError(() => links.create(URL_, 'alice', T0, { alias: 'a!' }), InvalidAliasError);
    expectError(() => links.create(URL_, 'alice', T0, { alias: 'TAKEN' }), AliasTakenError);
    assert.equal(links.create(URL_, 'alice', T0), '000001');
  });
});

describe('expiry', () => {
  test('link resolves until expiry and fails from expiry on', () => {
    const links = new TinyLink();
    const code = links.create(URL_, 'alice', T0, { expiresAt: T0 + 5000 });
    const forever = links.create(url(2), 'alice', T0);
    assert.equal(links.resolve(code, T0 + 4999, 'v1'), URL_);
    for (const now of [T0 + 5000, T0 + 999_999]) {
      const error = expectError(() => links.resolve(code, now, 'v1'), LinkExpiredError, `now=${now}`);
      assert.ok(error instanceof TinyLinkError);
    }
    assert.equal(links.resolve(forever, T0 + 10 ** 12, 'v1'), url(2));
  });

  test('expiry must be strictly after now', () => {
    const links = new TinyLink();
    for (const expiresAt of [T0, T0 - 1]) {
      const error = expectError(() => links.create(URL_, 'alice', T0, { expiresAt }), InvalidExpiryError, `expiresAt=${expiresAt}`);
      assert.ok(error instanceof ValidationError);
    }
    const code = links.create(URL_, 'alice', T0, { expiresAt: T0 + 1 });
    assert.equal(code, '000001');
    assert.equal(links.resolve(code, T0, 'v1'), URL_);
    expectError(() => links.resolve(code, T0 + 1, 'v1'), LinkExpiredError);
  });

  test('expired resolve records no click and alias stays taken', () => {
    const links = new TinyLink();
    links.create(URL_, 'alice', T0, { alias: 'flash', expiresAt: T0 + 100 });
    links.resolve('flash', T0 + 50, 'v1');
    expectError(() => links.resolve('flash', T0 + 100, 'v2'), LinkExpiredError);
    const stats = links.stats('flash');
    assert.equal(stats.totalClicks, 1);
    assert.equal(stats.uniqueVisitors, 1);
    expectError(() => links.create(url(2), 'bob', T0 + 200, { alias: 'FLASH' }), AliasTakenError);
  });
});

describe('stats', () => {
  test('unique visitors are compared exactly', () => {
    const links = new TinyLink();
    const code = links.create(URL_, 'alice', T0);
    const empty = links.stats(code);
    assert.equal(empty.totalClicks, 0);
    assert.equal(empty.uniqueVisitors, 0);
    assert.deepEqual(empty.clicksByDay, {});
    for (const visitor of ['v1', 'v1', 'V1', 'v2', 'v1 ']) links.resolve(code, T0 + 1, visitor);
    const stats = links.stats(code);
    assert.equal(stats.totalClicks, 5);
    assert.equal(stats.uniqueVisitors, 4);
  });

  test('clicksByDay uses UTC day boundaries', () => {
    const links = new TinyLink();
    const day0 = 19_000 * DAY;
    const code = links.create(URL_, 'alice', day0 - 10);
    for (const now of [day0 - 1, day0, day0 + DAY - 1, day0 + DAY, day0 + 3 * DAY + 5]) links.resolve(code, now, 'v1');
    const stats = links.stats(code);
    assert.deepEqual(stats.clicksByDay, { 18999: 1, 19000: 2, 19001: 1, 19003: 1 });
    assert.equal(stats.totalClicks, 5);
    assert.equal(stats.uniqueVisitors, 1);
  });

  test('stats uses the same lookup as resolve', () => {
    const links = new TinyLink();
    links.create(URL_, 'alice', T0, { alias: 'Promo' });
    links.resolve('promo', T0, 'v1');
    assert.equal(links.stats('PROMO').totalClicks, 1);
    generate(links, 10);
    assert.equal(links.stats('00000A').totalClicks, 0);
    for (const code of ['nope', '00000a']) expectError(() => links.stats(code), LinkNotFoundError, code);
  });
});

describe('quotas', () => {
  test('quota caps active links per owner', () => {
    const links = new TinyLink({ maxLinksPerOwner: 2 });
    links.create(url(1), 'alice', T0);
    links.create(url(2), 'alice', T0, { alias: 'second' });
    const error = expectError(() => links.create(url(3), 'alice', T0), QuotaExceededError);
    assert.ok(error instanceof TinyLinkError);
    assert.ok(!(error instanceof ValidationError), 'QuotaExceededError is not a ValidationError');
    links.create(url(4), 'bob', T0);
    links.create(url(5), 'bob', T0);
    expectError(() => links.create(url(6), 'bob', T0, { alias: 'third' }), QuotaExceededError);
  });

  test('expired links do not count toward the quota', () => {
    const links = new TinyLink({ maxLinksPerOwner: 1 });
    links.create(url(1), 'alice', T0, { expiresAt: T0 + 5000 });
    expectError(() => links.create(url(2), 'alice', T0 + 4999), QuotaExceededError);
    assert.equal(links.create(url(3), 'alice', T0 + 5000), '000002');
  });

  test('rejected create reserves nothing', () => {
    const links = new TinyLink({ maxLinksPerOwner: 1 });
    assert.equal(links.create(url(1), 'alice', T0), '000001');
    expectError(() => links.create(url(2), 'alice', T0, { alias: 'summer' }), QuotaExceededError);
    expectError(() => links.create(url(3), 'alice', T0), QuotaExceededError);
    assert.equal(links.create(url(4), 'bob', T0, { alias: 'Summer' }), 'Summer');
    assert.equal(links.create(url(5), 'carol', T0), '000002');
  });

  test('create check order with expiry and quota', () => {
    const links = new TinyLink({ maxLinksPerOwner: 1 });
    links.create(url(1), 'alice', T0);
    links.create(url(2), 'bob', T0, { alias: 'taken' });
    expectError(() => links.create(URL_, 'alice', T0, { alias: 'taken' }), AliasTakenError);
    expectError(() => links.create(URL_, 'alice', T0, { alias: 'taken', expiresAt: T0 }), InvalidExpiryError);
    expectError(() => links.create(URL_, 'alice', T0, { alias: 'no!', expiresAt: T0 }), InvalidAliasError);
    expectError(() => links.create('nope', 'alice', T0, { alias: 'no!', expiresAt: T0 }), InvalidUrlError);
    expectError(() => links.create(URL_, 'alice', T0, { expiresAt: T0 - 5 }), InvalidExpiryError);
    expectError(() => links.create(URL_, 'alice', T0, { alias: 'fresh', expiresAt: T0 + 1 }), QuotaExceededError);
  });
});

describe('delete and restore', () => {
  test('deleted link stops resolving but keeps its stats', () => {
    const links = new TinyLink();
    links.create(URL_, 'alice', T0, { alias: 'gone', expiresAt: T0 + 1000 });
    links.resolve('gone', T0 + 1, 'v1');
    links.delete('GONE');
    for (const now of [T0 + 2, T0 + 5000]) { // deleted wins over expired
      const error = expectError(() => links.resolve('gone', now, 'v2'), LinkDeletedError, `now=${now}`);
      assert.ok(error instanceof TinyLinkError);
    }
    assert.equal(links.stats('gone').totalClicks, 1);
    expectError(() => links.delete('gone'), LinkDeletedError);
    expectError(() => links.delete('never'), LinkNotFoundError);
  });

  test('delete frees the quota slot and releases the alias', () => {
    const links = new TinyLink({ maxLinksPerOwner: 1 });
    links.create(url(1), 'alice', T0, { alias: 'launch' });
    links.delete('launch');
    assert.equal(links.create(url(2), 'alice', T0 + 1), '000001');
    assert.equal(links.create(url(3), 'bob', T0 + 2, { alias: 'LAUNCH' }), 'LAUNCH');
    assert.equal(links.resolve('launch', T0 + 3, 'v1'), url(3));
  });

  test('restore keeps clicks and expiry', () => {
    const links = new TinyLink();
    links.create(URL_, 'alice', T0, { alias: 'promo', expiresAt: T0 + 10_000 });
    links.resolve('promo', T0 + 1, 'v1');
    links.delete('promo');
    assert.equal(links.restore('PROMO', T0 + 2), undefined);
    assert.equal(links.resolve('promo', T0 + 3, 'v2'), URL_);
    const stats = links.stats('promo');
    assert.equal(stats.totalClicks, 2);
    assert.equal(stats.uniqueVisitors, 2);
    expectError(() => links.resolve('promo', T0 + 10_000, 'v3'), LinkExpiredError);
    const code = links.create(url(2), 'alice', T0 + 20_000);
    links.delete(code);
    links.restore(code, T0 + 20_001);
    assert.equal(links.resolve(code, T0 + 20_002, 'v1'), url(2));
  });

  test('restore conflicts when the code is held by a live link', () => {
    const links = new TinyLink();
    const live = links.create(url(1), 'alice', T0);
    const error = expectError(() => links.restore(live, T0), RestoreConflictError, 'live link');
    assert.ok(error instanceof TinyLinkError);
    expectError(() => links.restore('nope', T0), LinkNotFoundError);
    links.create(url(2), 'alice', T0, { alias: 'promo' });
    links.delete('promo');
    links.create(url(3), 'bob', T0 + 1, { alias: 'Promo' });
    expectError(() => links.restore('promo', T0 + 2), RestoreConflictError, 'alias re-used');
    assert.equal(links.resolve('promo', T0 + 3, 'v1'), url(3));
    links.delete(live);
    assert.equal(links.create(url(4), 'carol', T0 + 4, { alias: live }), live);
    expectError(() => links.restore(live, T0 + 5), RestoreConflictError, 'generated code claimed by alias');
    assert.equal(links.resolve(live, T0 + 6, 'v1'), url(4));
  });

  test('restore respects the quota unless the link has expired', () => {
    const links = new TinyLink({ maxLinksPerOwner: 1 });
    links.create(url(1), 'alice', T0, { alias: 'flash', expiresAt: T0 + 1000 });
    links.delete('flash');
    links.create(url(2), 'alice', T0 + 100);
    expectError(() => links.restore('flash', T0 + 200), QuotaExceededError);
    expectError(() => links.resolve('flash', T0 + 200, 'v1'), LinkDeletedError);
    links.restore('flash', T0 + 1000);
    expectError(() => links.resolve('flash', T0 + 1000, 'v1'), LinkExpiredError);
  });

  test('lookup prefers a live link, then the most recently deleted', () => {
    const links = new TinyLink();
    links.create(url(1), 'alice', T0, { alias: 'promo' });
    for (let i = 0; i < 3; i++) links.resolve('promo', T0 + 1, 'v1');
    links.delete('promo');
    links.create(url(2), 'bob', T0 + 2, { alias: 'PROMO' });
    assert.equal(links.stats('promo').totalClicks, 0);
    links.delete('promo');
    expectError(() => links.resolve('Promo', T0 + 3, 'v1'), LinkDeletedError);
    links.restore('promo', T0 + 4);
    assert.equal(links.resolve('promo', T0 + 5, 'v1'), url(2));
    assert.equal(links.stats('promo').totalClicks, 1);
  });
});

describe('top links', () => {
  test('ranks by clicks since (inclusive) with creation-order ties', () => {
    const links = new TinyLink();
    const [a, b, c] = generate(links, 3);
    const d = links.create(URL_, 'alice', T0, { alias: 'd-link' });
    const plan = [
      [a, [T0 + 1000, T0 + 1500, T0 + 2000]],
      [b, [T0 + 999, T0 + 1000]],
      [c, [T0, T0 + 999]],
      [d, [T0 + 5000, T0 + 6000]],
    ];
    const events = [];
    for (const [code, times] of plan) for (const now of times) events.push([now, code]);
    events.sort((p, q) => p[0] - q[0]);
    for (const [now, code] of events) links.resolve(code, now, 'v1');
    assert.deepEqual(links.topLinks('alice', 10, T0 + 1000), [[a, 3], [d, 2], [b, 1]]);
    assert.deepEqual(links.topLinks('alice', 2, T0 + 1000), [[a, 3], [d, 2]]);
    assert.deepEqual(links.topLinks('alice', 10, T0), [[a, 3], [b, 2], [c, 2], [d, 2]]);
  });

  test('skips deleted links and other owners but keeps expired ones', () => {
    const links = new TinyLink();
    const x = links.create(url(1), 'alice', T0, { expiresAt: T0 + 100 });
    const y = links.create(url(2), 'alice', T0);
    const z = links.create(url(3), 'alice', T0, { alias: 'zed' });
    const w = links.create(url(4), 'bob', T0);
    let now = T0 + 10;
    for (const [code, count] of [[x, 2], [y, 1], [z, 3], [w, 5]]) {
      for (let i = 0; i < count; i++) links.resolve(code, now++, 'v1');
    }
    links.delete(z);
    assert.deepEqual(links.topLinks('alice', 5, T0), [[x, 2], [y, 1]]);
    links.restore(z, T0 + 300);
    assert.deepEqual(links.topLinks('alice', 5, T0), [[z, 3], [x, 2], [y, 1]]);
    assert.deepEqual(links.topLinks('alice', 0, T0), []);
    assert.deepEqual(links.topLinks('nobody', 3, T0), []);
  });
});
