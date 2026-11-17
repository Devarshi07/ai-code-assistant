import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ClockError, parseClock, formatClock } from '../src/clock.ts';
import { HOUSE_LINE, HOUSE_MENU } from '../src/menu.ts';
import { Order } from '../src/orders.ts';
import { TicketError, parseTicket, parseLog } from '../src/tickets.ts';
import { serviceReport } from '../src/report.ts';

const LUNCH_LOG = new URL('../data/saturday_lunch.txt', import.meta.url);

const RUSH = `
# printed in the order the tickets came in
11:50am order 1: burger
12:05pm order 2: fries
12:40pm order 3: house salad
1:10pm order 4: margherita
`;

describe('clock', () => {
  test('morning stamps', () => {
    assert.equal(parseClock('7:00am'), 420);
    assert.equal(parseClock('9:05am'), 545);
    assert.equal(parseClock('11:59am'), 719);
  });

  test('afternoon and evening stamps', () => {
    assert.equal(parseClock('1:15pm'), 795);
    assert.equal(parseClock('6:30PM'), 1110);
    assert.equal(parseClock('11:45pm'), 1425);
  });

  test('noon hour is midday', () => {
    assert.equal(parseClock('12:00pm'), 720);
    assert.equal(parseClock('12:41pm'), 761);
  });

  test('every minute of the day round trips', () => {
    for (let minute = 0; minute < 24 * 60; minute++) {
      const stamp = formatClock(minute);
      assert.equal(parseClock(stamp), minute, `${stamp} should parse back to minute ${minute}`);
    }
  });

  test('malformed stamps are rejected', () => {
    for (const stamp of ['13:05pm', '9:5am', '12:60pm', '0:30am', 'noon', '1205']) {
      assert.throws(() => parseClock(stamp), ClockError, stamp);
    }
  });
});

describe('tickets', () => {
  test('ticket with portions and flags', () => {
    const order = parseTicket('11:31am order 15: Caesar Salad, 2x fries | app | due 11:55am');
    assert.equal(order.id, 15);
    assert.equal(order.arrival, 691);
    assert.deepEqual(order.dishes, ['caesar salad', 'fries', 'fries']);
    assert.equal(order.priority, true);
    assert.equal(order.due, 715);
  });

  test('rail is in arrival order', () => {
    const orders = parseLog(RUSH);
    assert.deepEqual(orders.map(o => o.id), [1, 2, 3, 4]);
    assert.deepEqual(orders.map(o => o.arrival), [710, 725, 760, 790]);
  });

  test('same-minute tickets keep printer order', () => {
    const orders = parseLog('10:15am order 9: fries\n10:15am order 3: burger\n10:05am order 5: wings\n');
    assert.deepEqual(orders.map(o => o.id), [5, 9, 3]);
  });

  test('bad lines report their line number', () => {
    assert.throws(() => parseLog('10:15am order 1: fries\n10:16am order 2: burger | rush\n'),
      (error: unknown) => error instanceof TicketError && error.lineNumber === 2);
    assert.throws(() => parseLog('10:15am order 1: fries\n10:20am order 1: burger\n'), TicketError);
  });
});

describe('quotes', () => {
  test('quote is arrival plus slowest dish', () => {
    const order = new Order({ id: 7, arrival: 600, dishes: ['fries', 'steak frites', 'house salad'] });
    assert.equal(order.quote(HOUSE_MENU), 614);
  });

  test('lunch quotes stay on the same day', () => {
    const orders = parseLog(readFileSync(LUNCH_LOG, 'utf8'));
    assert.equal(orders.length, 18);
    for (const order of orders) {
      const wait = order.quote(HOUSE_MENU) - order.arrival;
      assert.ok(order.arrival >= 660 && order.arrival <= 840,
        `order ${order.id} was rung in at ${formatClock(order.arrival)}, not during lunch`);
      assert.ok(wait <= 14, `order ${order.id} quotes a ${wait}-minute wait`);
      if (order.due !== null) assert.ok(order.due - order.arrival < 60, `order ${order.id} has an odd due time`);
    }
  });
});

describe('report', () => {
  test('report shows lateness and station load', () => {
    const orders = [
      new Order({ id: 1, arrival: 600, dishes: ['burger', 'fries'] }),
      new Order({ id: 2, arrival: 602, dishes: ['house salad'], priority: true, due: 610 }),
      new Order({ id: 3, arrival: 603, dishes: ['burger'], due: 612 }),
    ];
    const run = { ready: new Map([[1, 607], [2, 605], [3, 616]]), late: [{ id: 3, minutesLate: 4 }] };
    const text = serviceReport('Test', orders, HOUSE_MENU, HOUSE_LINE, run);
    assert.match(text, /3 orders, 4 dishes/);
    assert.match(text, /LATE 4m/);
    assert.match(text, /on time, app/);
    assert.match(text, /1 of 2 promised orders late/);
    assert.match(text, /grill\s+2\s+2\s+14m\s+44%/);
  });
});
