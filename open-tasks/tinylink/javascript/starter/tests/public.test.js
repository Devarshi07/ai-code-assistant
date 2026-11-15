// Provided tests: the basic happy path. The hidden acceptance tests go further.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { TinyLink } = require('../src/tinylink');
const { LinkNotFoundError } = require('../src/errors');

const T0 = 1_700_000_000_000; // some moment in November 2023, in ms

describe('core', () => {
  test('first generated codes count up from 000001', () => {
    const links = new TinyLink();
    assert.equal(links.create('https://example.com/a', 'alice', T0), '000001');
    assert.equal(links.create('https://example.com/b', 'alice', T0), '000002');
    assert.equal(links.create('https://example.com/c', 'bob', T0), '000003');
  });

  test('generated codes use digits, then upper case, then lower case', () => {
    const links = new TinyLink();
    const codes = [];
    for (let i = 0; i < 36; i++) codes.push(links.create(`https://example.com/${i}`, 'alice', T0));
    assert.equal(codes[9], '00000A');  // counter 10
    assert.equal(codes[35], '00000a'); // counter 36
  });

  test('resolve returns the original URL', () => {
    const links = new TinyLink();
    const code = links.create('https://shop.example.com/spring?utm_source=flyer', 'alice', T0);
    assert.equal(links.resolve(code, T0 + 1, 'visitor-1'), 'https://shop.example.com/spring?utm_source=flyer');
  });

  test('custom alias is returned as given and resolves in any case', () => {
    const links = new TinyLink();
    const code = links.create('https://example.com/sale', 'alice', T0, { alias: 'Spring-Sale' });
    assert.equal(code, 'Spring-Sale');
    assert.equal(links.resolve('Spring-Sale', T0, 'v1'), 'https://example.com/sale');
    assert.equal(links.resolve('spring-sale', T0, 'v2'), 'https://example.com/sale');
  });

  test('unknown code throws LinkNotFoundError', () => {
    const links = new TinyLink();
    links.create('https://example.com', 'alice', T0);
    assert.throws(() => links.resolve('zzzzzz', T0, 'v1'), LinkNotFoundError);
  });
});

describe('stats', () => {
  test('stats count clicks and unique visitors', () => {
    const links = new TinyLink();
    const code = links.create('https://example.com', 'alice', T0);
    for (const visitor of ['ana', 'ben', 'ana']) links.resolve(code, T0 + 1000, visitor);
    const stats = links.stats(code);
    assert.equal(stats.totalClicks, 3);
    assert.equal(stats.uniqueVisitors, 2);
  });
});
