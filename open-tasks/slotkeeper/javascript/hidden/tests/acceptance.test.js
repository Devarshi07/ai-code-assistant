// Hidden acceptance tests for SlotKeeper. They use only the documented interface.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { SlotKeeper } = require('../src/slotkeeper');
const {
  ValidationError,
  NotFoundError,
  TooSoonError,
  SlotUnavailableError,
  ConflictError,
  DailyLimitError,
} = require('../src/errors');

const [MON, TUE, WED, SAT, SUN, NEXT_MON, NEXT_SAT] = [7, 8, 9, 12, 13, 14, 19];
const w = (weekday, start, end) => ({ weekday, start, end });
const span = (start, end) => ({ start, end });
const MORNING = [w(0, 540, 720)]; // Mondays 09:00-12:00
const INTRO = ['intro', 30, {}];

const at = (day, hour, minute = 0) => day * 1440 + hour * 60 + minute;
const every15 = (first, count) => Array.from({ length: count }, (_, i) => first + 15 * i);

/** A SlotKeeper with host "ana" and the given [typeId, duration, options] meeting types. */
function make(windows, ...types) {
  const keeper = new SlotKeeper();
  keeper.addHost('ana', windows.map(window => ({ ...window })));
  for (const [typeId, duration, options] of types) keeper.addMeetingType('ana', typeId, duration, { ...options });
  return keeper;
}

// ---------------------------------------------------------------------------
// Part 1 · Core
// ---------------------------------------------------------------------------

describe('setup', () => {
  test('host validation', () => {
    let keeper = new SlotKeeper();
    keeper.addHost('ana', []);
    assert.throws(() => keeper.addHost('ana', [w(0, 540, 600)]), ValidationError);
    for (const bad of [w(7, 540, 600), w(-1, 540, 600), w(0, 600, 600), w(0, 660, 600), w(0, -15, 600), w(0, 540, 1441)]) {
      keeper = new SlotKeeper();
      assert.throws(() => keeper.addHost('bo', [w(0, 540, 600), bad]), ValidationError, `window ${JSON.stringify(bad)}`);
      // The failed call registered nothing, and a window may end at 24:00.
      keeper.addHost('bo', [w(6, 1380, 1440)]);
    }
  });

  test('meeting type validation', () => {
    const keeper = new SlotKeeper();
    keeper.addHost('ana', MORNING);
    keeper.addHost('bo', MORNING);
    assert.throws(() => keeper.addMeetingType('ghost', 'x', 30), NotFoundError);
    keeper.addMeetingType('ana', 'intro', 30);
    assert.throws(() => keeper.addMeetingType('ana', 'intro', 45), ValidationError);
    assert.throws(() => keeper.addMeetingType('bo', 'intro', 30), ValidationError, 'type ids are unique across hosts');
    const bad = [[0, {}], [1441, {}], [30, { bufferBefore: -5 }], [30, { bufferAfter: -1 }], [30, { minNotice: -1 }]];
    for (const [duration, options] of bad) {
      assert.throws(() => keeper.addMeetingType('ana', 'bad', duration, options), ValidationError, `duration ${duration} ${JSON.stringify(options)}`);
    }
    keeper.addMeetingType('ana', 'bad', 1440);
  });

  test('unknown ids and reversed ranges', () => {
    const keeper = make(MORNING, INTRO);
    assert.throws(() => keeper.listSlots('nope', MON, MON, 0), NotFoundError);
    assert.throws(() => keeper.book('nope', at(MON, 9), 'sam', 0), NotFoundError);
    assert.throws(() => keeper.getBooking(1), NotFoundError);
    assert.throws(() => keeper.listBookings('ghost'), NotFoundError);
    assert.throws(() => keeper.listSlots('intro', TUE, MON, 0), ValidationError);
    assert.deepEqual(keeper.listBookings('ana'), []);
  });
});

describe('slot listing', () => {
  test('slots fit inside windows', () => {
    const keeper = new SlotKeeper();
    keeper.addHost('ana', [w(0, 540, 600)]); // 09:00-10:00
    keeper.addMeetingType('ana', 'long', 45);
    keeper.addHost('bo', [w(0, 550, 620)]); // 09:10-10:20, off the grid
    keeper.addMeetingType('bo', 'chat', 30);
    assert.deepEqual(keeper.listSlots('long', MON, MON, 0), [at(MON, 9), at(MON, 9, 15)]);
    assert.deepEqual(keeper.listSlots('chat', MON, MON, 0), [at(MON, 9, 15), at(MON, 9, 30), at(MON, 9, 45)]);
  });

  test('touching and overlapping windows merge', () => {
    const keeper = new SlotKeeper();
    keeper.addHost('ana', [w(0, 600, 660), w(0, 540, 600)]); // touching, out of order
    keeper.addHost('bo', [w(0, 540, 620), w(0, 600, 660)]); // overlapping
    keeper.addMeetingType('ana', 'hour', 60);
    keeper.addMeetingType('bo', 'bo-hour', 60);
    const expected = every15(at(MON, 9), 5);
    assert.deepEqual(keeper.listSlots('hour', MON, MON, 0), expected);
    assert.deepEqual(keeper.listSlots('bo-hour', MON, MON, 0), expected);
  });

  test('meetings never cross midnight', () => {
    const keeper = make([w(0, 1380, 1440), w(1, 0, 60)], ['hour', 60, {}]);
    assert.deepEqual(keeper.listSlots('hour', MON, TUE, 0), [at(MON, 23), at(TUE, 0)]);
    assert.throws(() => keeper.book('hour', at(MON, 23, 30), 'sam', 0), SlotUnavailableError);
    assert.equal(keeper.book('hour', at(MON, 23), 'sam', 0), 1);
  });

  test('weekday comes from the day index', () => {
    const keeper = make([w(5, 600, 630), w(6, 600, 630)], INTRO); // Saturdays and Sundays 10:00-10:30
    assert.deepEqual(keeper.listSlots('intro', 0, 13, 0), [at(5, 10), at(6, 10), at(SAT, 10), at(SUN, 10)]);
  });

  test('slots respect notice and now', () => {
    const keeper = make(MORNING, ['advance', 30, { minNotice: 120 }], INTRO);
    assert.deepEqual(keeper.listSlots('advance', MON, MON, at(MON, 8)), every15(at(MON, 10), 7));
    assert.deepEqual(keeper.listSlots('intro', MON, MON, at(MON, 9, 7)), every15(at(MON, 9, 15), 10));
    assert.deepEqual(
      keeper.listSlots('intro', 0, NEXT_MON, at(MON, 11, 30)),
      [at(MON, 11, 30), ...every15(at(NEXT_MON, 9), 11)],
    );
  });
});

describe('booking rules', () => {
  test('min notice is inclusive and the past is too soon', () => {
    const keeper = make(MORNING, ['advance', 30, { minNotice: 120 }], INTRO);
    assert.throws(() => keeper.book('advance', at(MON, 9, 45), 'sam', at(MON, 8)), TooSoonError);
    assert.equal(keeper.book('advance', at(MON, 10), 'sam', at(MON, 8)), 1);
    assert.throws(() => keeper.book('intro', at(MON, 10, 45), 'kim', at(MON, 11)), TooSoonError);
    assert.equal(keeper.book('intro', at(MON, 11), 'kim', at(MON, 11)), 2);
  });

  test('bookings must fit availability', () => {
    const keeper = make([w(0, 540, 600)], INTRO);
    for (const start of [at(TUE, 9), at(MON, 8, 45), at(MON, 9, 45), at(MON, 10)]) {
      assert.throws(() => keeper.book('intro', start, 'sam', 0), SlotUnavailableError, `start ${start}`);
    }
    assert.deepEqual(keeper.listBookings('ana'), []);
  });

  test('overlaps conflict but back-to-back is fine', () => {
    const keeper = make([w(0, 540, 660)], INTRO);
    keeper.book('intro', at(MON, 9, 30), 'sam', 0);
    for (const start of [at(MON, 9, 15), at(MON, 9, 30), at(MON, 9, 45)]) {
      assert.throws(() => keeper.book('intro', start, 'kim', 0), ConflictError, `start ${start}`);
    }
    assert.equal(keeper.book('intro', at(MON, 9), 'kim', 0), 2, 'failed attempts must not use up ids');
    assert.equal(keeper.book('intro', at(MON, 10), 'lee', 0), 3);
  });

  test('conflicts span meeting types but not hosts', () => {
    const keeper = make([w(0, 540, 660)], INTRO, ['deep', 60, {}]);
    keeper.addHost('bo', [w(0, 540, 660)]);
    keeper.addMeetingType('bo', 'bo-intro', 30);
    keeper.book('deep', at(MON, 9), 'sam', 0);
    assert.throws(() => keeper.book('intro', at(MON, 9, 30), 'kim', 0), ConflictError);
    assert.deepEqual(keeper.listSlots('intro', MON, MON, 0), [at(MON, 10), at(MON, 10, 15), at(MON, 10, 30)]);
    assert.equal(keeper.book('bo-intro', at(MON, 9, 30), 'kim', 0), 2);
  });

  test('checks run in the documented order', () => {
    const keeper = make([w(0, 540, 600)], INTRO);
    assert.throws(() => keeper.book('nope', at(MON, 9, 10), 'sam', 0), NotFoundError);
    assert.throws(() => keeper.book('intro', at(MON, 9, 10), 'sam', 0), ValidationError);
    assert.throws(() => keeper.book('intro', at(MON, 8, 5), 'sam', at(MON, 12)), ValidationError, 'off-grid is reported before too soon');
    assert.throws(() => keeper.book('intro', at(MON, 8), 'sam', at(MON, 12)), TooSoonError, 'too soon is reported before unavailable');
    keeper.book('intro', at(MON, 9, 30), 'sam', 0);
    assert.throws(() => keeper.book('intro', at(MON, 9, 45), 'kim', 0), SlotUnavailableError, 'unavailable is reported before conflict');
  });
});

// ---------------------------------------------------------------------------
// Part 2 · Buffers, changes and limits
// ---------------------------------------------------------------------------

describe('buffers', () => {
  test('after buffer blocks the following slot', () => {
    const keeper = make(MORNING, ['padded', 30, { bufferAfter: 15 }], INTRO);
    keeper.book('padded', at(MON, 9), 'sam', 0);
    assert.throws(() => keeper.book('intro', at(MON, 9, 30), 'kim', 0), ConflictError);
    assert.equal(keeper.book('intro', at(MON, 9, 45), 'kim', 0), 2);
  });

  test('before buffers protect both sides', () => {
    const keeper = make(MORNING, ['prep', 30, { bufferBefore: 30 }], INTRO);
    keeper.book('intro', at(MON, 9), 'sam', 0); // 09:00-09:30
    assert.throws(() => keeper.book('prep', at(MON, 9, 45), 'kim', 0), ConflictError); // its buffer starts 09:15
    assert.equal(keeper.book('prep', at(MON, 10, 30), 'kim', 0), 2); // blocks 10:00-10:30
    assert.throws(() => keeper.book('intro', at(MON, 10), 'lee', 0), ConflictError);
    assert.equal(keeper.book('intro', at(MON, 9, 30), 'lee', 0), 3);
  });

  test('buffers do not stack', () => {
    const keeper = make(MORNING, ['tail', 30, { bufferAfter: 15 }], ['head', 30, { bufferBefore: 15 }]);
    keeper.book('tail', at(MON, 9), 'sam', 0);
    assert.throws(() => keeper.book('head', at(MON, 9, 30), 'kim', 0), ConflictError);
    assert.equal(keeper.book('head', at(MON, 9, 45), 'kim', 0), 2, 'the gap is max(15, 15), not 15 + 15');
  });

  test('buffers may extend outside availability', () => {
    const keeper = make([w(0, 540, 600)], ['padded', 30, { bufferBefore: 15, bufferAfter: 15 }]);
    assert.deepEqual(keeper.listSlots('padded', MON, MON, 0), [at(MON, 9), at(MON, 9, 15), at(MON, 9, 30)]);
    assert.equal(keeper.book('padded', at(MON, 9), 'sam', 0), 1);
  });

  test('slot list reflects buffers on both sides', () => {
    const keeper = make(MORNING, ['padded', 30, { bufferAfter: 15 }]);
    keeper.book('padded', at(MON, 10), 'sam', 0); // 10:00-10:30, blocked until 10:45
    assert.deepEqual(
      keeper.listSlots('padded', MON, MON, 0),
      [at(MON, 9), at(MON, 9, 15), at(MON, 10, 45), at(MON, 11), at(MON, 11, 15), at(MON, 11, 30)],
    );
  });
});

describe('cancel', () => {
  test('cancel frees the time', () => {
    const keeper = make([w(0, 540, 600)], INTRO);
    keeper.book('intro', at(MON, 9), 'sam', 0);
    assert.deepEqual(keeper.listSlots('intro', MON, MON, 0), [at(MON, 9, 30)]);
    keeper.cancel(1);
    assert.deepEqual(keeper.listSlots('intro', MON, MON, 0), [at(MON, 9), at(MON, 9, 15), at(MON, 9, 30)]);
    assert.deepEqual(keeper.listBookings('ana'), []);
    assert.throws(() => keeper.getBooking(1), NotFoundError);
  });

  test('cancel errors and ids are never reused', () => {
    const keeper = make([w(0, 540, 600)], INTRO);
    assert.throws(() => keeper.cancel(1), NotFoundError);
    keeper.book('intro', at(MON, 9), 'sam', 0);
    keeper.cancel(1);
    assert.throws(() => keeper.cancel(1), NotFoundError);
    assert.equal(keeper.book('intro', at(MON, 9), 'kim', 0), 2);
  });
});

describe('reschedule', () => {
  test('reschedule moves the booking', () => {
    const keeper = make(MORNING, INTRO);
    keeper.book('intro', at(MON, 9), 'sam@example.com', 0);
    keeper.reschedule(1, at(MON, 10, 30), 0);
    assert.deepEqual(keeper.getBooking(1), {
      id: 1,
      typeId: 'intro',
      hostId: 'ana',
      start: at(MON, 10, 30),
      end: at(MON, 11),
      invitee: 'sam@example.com',
    });
    assert.equal(keeper.book('intro', at(MON, 9), 'kim', 0), 2);
  });

  test('reschedule ignores the booking being moved', () => {
    const keeper = make(MORNING, ['padded', 30, { bufferAfter: 15 }]);
    keeper.book('padded', at(MON, 9), 'sam', 0);
    keeper.reschedule(1, at(MON, 9, 15), 0);
    const booking = keeper.getBooking(1);
    assert.deepEqual([booking.start, booking.end], [at(MON, 9, 15), at(MON, 9, 45)]);
  });

  test('failed reschedule keeps the original', () => {
    const keeper = make(MORNING, INTRO);
    keeper.book('intro', at(MON, 9), 'sam', 0);
    keeper.book('intro', at(MON, 10), 'kim', 0);
    const original = keeper.getBooking(1);
    for (const [start, error] of [[at(MON, 10, 15), ConflictError], [at(TUE, 9), SlotUnavailableError], [at(MON, 9, 10), ValidationError]]) {
      assert.throws(() => keeper.reschedule(1, start, 0), error, error.name);
      assert.deepEqual(keeper.getBooking(1), original, `after ${error.name}`);
    }
    assert.throws(() => keeper.book('intro', at(MON, 9), 'lee', 0), ConflictError, 'the original time is still held');
  });

  test('reschedule uses now and rejects unknown ids', () => {
    const keeper = make(MORNING, ['advance', 30, { minNotice: 60 }]);
    keeper.book('advance', at(MON, 11), 'sam', 0);
    assert.throws(() => keeper.reschedule(1, at(MON, 9, 30), at(MON, 9)), TooSoonError);
    assert.equal(keeper.getBooking(1).start, at(MON, 11));
    keeper.reschedule(1, at(MON, 10), at(MON, 9));
    assert.equal(keeper.getBooking(1).start, at(MON, 10));
    assert.throws(() => keeper.reschedule(99, at(MON, 9, 10), 0), NotFoundError);
    keeper.cancel(1);
    assert.throws(() => keeper.reschedule(1, at(MON, 11), 0), NotFoundError);
  });
});

describe('daily limit', () => {
  test('daily limit counts all meeting types per host', () => {
    const keeper = make([w(0, 540, 720), w(1, 540, 720)], INTRO, ['deep', 60, {}]);
    keeper.addHost('bo', [w(0, 540, 720)]);
    keeper.addMeetingType('bo', 'bo-intro', 30);
    keeper.setDailyLimit('ana', 2);
    keeper.book('intro', at(MON, 9), 'sam', 0);
    keeper.book('deep', at(MON, 10), 'kim', 0);
    assert.throws(() => keeper.book('intro', at(MON, 11), 'lee', 0), DailyLimitError);
    assert.deepEqual(keeper.listSlots('intro', MON, TUE, 0), every15(at(TUE, 9), 11));
    assert.equal(keeper.book('intro', at(TUE, 9), 'lee', 0), 3);
    assert.equal(keeper.book('bo-intro', at(MON, 11), 'lee', 0), 4);
  });

  test('daily limit with cancel and reschedule', () => {
    const keeper = make([w(0, 540, 720), w(1, 540, 720)], INTRO);
    keeper.setDailyLimit('ana', 1);
    keeper.book('intro', at(MON, 9), 'sam', 0);
    keeper.reschedule(1, at(MON, 10), 0); // the moved booking doesn't count against its own day
    keeper.book('intro', at(TUE, 9), 'kim', 0);
    assert.throws(() => keeper.reschedule(2, at(MON, 11), 0), DailyLimitError);
    assert.equal(keeper.getBooking(2).start, at(TUE, 9));
    keeper.cancel(1);
    keeper.reschedule(2, at(MON, 11), 0);
    assert.equal(keeper.getBooking(2).start, at(MON, 11));
  });

  test('daily limit settings', () => {
    const keeper = make(MORNING, INTRO);
    assert.throws(() => keeper.setDailyLimit('ghost', 2), NotFoundError);
    assert.throws(() => keeper.setDailyLimit('ana', 0), ValidationError);
    keeper.book('intro', at(MON, 9), 'sam', 0);
    keeper.book('intro', at(MON, 10), 'kim', 0);
    keeper.setDailyLimit('ana', 1);
    assert.equal(keeper.listBookings('ana').length, 2, 'lowering the cap cancels nothing');
    assert.throws(() => keeper.book('intro', at(MON, 11), 'lee', 0), DailyLimitError);
    assert.deepEqual(keeper.listSlots('intro', MON, MON, 0), []);
    keeper.setDailyLimit('ana', null);
    assert.equal(keeper.book('intro', at(MON, 11), 'lee', 0), 3);
  });

  test('conflict is reported before the daily limit', () => {
    const keeper = make(MORNING, INTRO);
    keeper.setDailyLimit('ana', 1);
    keeper.book('intro', at(MON, 9), 'sam', 0);
    assert.throws(() => keeper.book('intro', at(MON, 9, 15), 'kim', 0), ConflictError);
    assert.throws(() => keeper.book('intro', at(MON, 10), 'kim', 0), DailyLimitError);
  });
});

// ---------------------------------------------------------------------------
// Part 3 · Stretch
// ---------------------------------------------------------------------------

describe('overrides', () => {
  test('day off override', () => {
    const keeper = make([w(0, 540, 600)], INTRO);
    keeper.setOverride('ana', MON, []);
    assert.deepEqual(keeper.listSlots('intro', 0, NEXT_MON, 0), [...every15(at(0, 9), 3), ...every15(at(NEXT_MON, 9), 3)]);
    assert.throws(() => keeper.book('intro', at(MON, 9), 'sam', 0), SlotUnavailableError);
  });

  test('override adds hours on a free day', () => {
    const keeper = make([w(0, 540, 600)], INTRO);
    keeper.setOverride('ana', SAT, [span(600, 660)]);
    assert.deepEqual(keeper.listSlots('intro', SAT, SUN, 0), every15(at(SAT, 10), 3));
    assert.deepEqual(keeper.listSlots('intro', NEXT_SAT, NEXT_SAT, 0), []);
    assert.equal(keeper.book('intro', at(SAT, 10, 30), 'sam', 0), 1);
  });

  test('override replaces the weekly pattern', () => {
    const keeper = make(MORNING, INTRO);
    keeper.setOverride('ana', MON, [span(840, 900)]);
    assert.deepEqual(keeper.listSlots('intro', MON, MON, 0), every15(at(MON, 14), 3));
    keeper.setOverride('ana', MON, [span(540, 570), span(570, 600)]);
    assert.deepEqual(keeper.listSlots('intro', MON, MON, 0), every15(at(MON, 9), 3));
    keeper.clearOverride('ana', MON);
    assert.deepEqual(keeper.listSlots('intro', MON, MON, 0), every15(at(MON, 9), 11));
    keeper.clearOverride('ana', MON);
    assert.deepEqual(keeper.listSlots('intro', MON, MON, 0), every15(at(MON, 9), 11));
  });

  test('override errors and existing bookings', () => {
    const keeper = make(MORNING, INTRO);
    keeper.book('intro', at(MON, 9), 'sam', 0);
    assert.throws(() => keeper.setOverride('ghost', MON, []), NotFoundError);
    assert.throws(() => keeper.clearOverride('ghost', MON), NotFoundError);
    assert.throws(() => keeper.setOverride('ana', MON, [span(600, 540)]), ValidationError);
    assert.throws(() => keeper.setOverride('ana', MON, [span(540, 600), span(0, 1441)]), ValidationError);
    assert.equal(keeper.listSlots('intro', MON, MON, 0).length, 9, 'failed overrides change nothing');
    keeper.setOverride('ana', MON, []);
    assert.deepEqual(keeper.listBookings('ana').map(b => b.id), [1]);
    assert.equal(keeper.getBooking(1).start, at(MON, 9));
    keeper.clearOverride('ana', MON);
    assert.equal(keeper.listSlots('intro', MON, MON, 0)[0], at(MON, 9, 30));
  });
});

describe('busiest days', () => {
  test('busiest days sorted and limited', () => {
    const keeper = make([w(0, 540, 720), w(1, 540, 720), w(2, 540, 720)], INTRO);
    for (const [day, hours] of [[TUE, [9, 10, 11]], [MON, [9]], [WED, [9, 10, 11]]]) {
      for (const hour of hours) keeper.book('intro', at(day, hour), 'x', 0);
    }
    assert.deepEqual(keeper.busiestDays('ana', 2), [{ day: TUE, count: 3 }, { day: WED, count: 3 }]);
    assert.deepEqual(keeper.busiestDays('ana', 10), [{ day: TUE, count: 3 }, { day: WED, count: 3 }, { day: MON, count: 1 }]);
  });

  test('busiest days follow changes and validate', () => {
    const keeper = make([w(0, 540, 720), w(1, 540, 720), w(2, 540, 720)], INTRO);
    keeper.addHost('bo', [w(0, 540, 720)]);
    keeper.addMeetingType('bo', 'bo-intro', 30);
    assert.deepEqual(keeper.busiestDays('ana', 3), []);
    keeper.book('intro', at(MON, 9), 'a', 0);
    keeper.book('intro', at(MON, 10), 'b', 0);
    keeper.book('intro', at(TUE, 9), 'c', 0);
    keeper.book('bo-intro', at(MON, 11), 'd', 0);
    keeper.cancel(1);
    keeper.reschedule(3, at(WED, 9), 0);
    assert.deepEqual(keeper.busiestDays('ana', 5), [{ day: MON, count: 1 }, { day: WED, count: 1 }]);
    assert.throws(() => keeper.busiestDays('ana', 0), ValidationError);
    assert.throws(() => keeper.busiestDays('ghost', 1), NotFoundError);
  });
});
