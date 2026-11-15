// Provided tests: the basic happy path. The hidden acceptance tests go further.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { SlotKeeper } = require('../src/slotkeeper');

const MON = 7; // Monday of week 1
const NEXT_MON = 14;

const at = (day, hour, minute = 0) => day * 1440 + hour * 60 + minute;

/** Host "ana", free on Mondays 09:00-10:00 by default, with a 30-minute "intro" type. */
function makeKeeper(windows = [{ weekday: 0, start: 540, end: 600 }]) {
  const keeper = new SlotKeeper();
  keeper.addHost('ana', windows);
  keeper.addMeetingType('ana', 'intro', 30);
  return keeper;
}

describe('public', () => {
  test('lists slots on the fifteen-minute grid', () => {
    const keeper = makeKeeper();
    assert.deepEqual(keeper.listSlots('intro', MON, MON, 0), [at(MON, 9), at(MON, 9, 15), at(MON, 9, 30)]);
  });

  test('weekly pattern repeats every week', () => {
    const keeper = makeKeeper();
    assert.deepEqual(keeper.listSlots('intro', MON, NEXT_MON, 0), [
      at(MON, 9), at(MON, 9, 15), at(MON, 9, 30),
      at(NEXT_MON, 9), at(NEXT_MON, 9, 15), at(NEXT_MON, 9, 30),
    ]);
  });

  test('book returns an id and records the booking', () => {
    const keeper = makeKeeper();
    const bookingId = keeper.book('intro', at(MON, 9, 30), 'sam@example.com', 0);
    assert.equal(bookingId, 1);
    assert.deepEqual(keeper.getBooking(1), {
      id: 1,
      typeId: 'intro',
      hostId: 'ana',
      start: at(MON, 9, 30),
      end: at(MON, 10),
      invitee: 'sam@example.com',
    });
  });

  test('booked time disappears from the slot list', () => {
    const keeper = makeKeeper([{ weekday: 0, start: 540, end: 660 }]);
    keeper.book('intro', at(MON, 9, 30), 'sam@example.com', 0);
    assert.deepEqual(keeper.listSlots('intro', MON, MON, 0), [at(MON, 9), at(MON, 10), at(MON, 10, 15), at(MON, 10, 30)]);
  });

  test('listBookings is sorted by start', () => {
    const keeper = makeKeeper([{ weekday: 0, start: 540, end: 660 }]);
    const first = keeper.book('intro', at(MON, 10), 'sam@example.com', 0);
    const second = keeper.book('intro', at(MON, 9), 'kim@example.com', 0);
    assert.deepEqual([first, second], [1, 2]);
    assert.deepEqual(keeper.listBookings('ana').map(b => b.id), [2, 1]);
    assert.deepEqual(keeper.listBookings('ana').map(b => b.invitee), ['kim@example.com', 'sam@example.com']);
  });

  test('hosts have independent calendars', () => {
    const keeper = makeKeeper();
    keeper.addHost('bo', [{ weekday: 0, start: 540, end: 600 }]);
    keeper.addMeetingType('bo', 'bo-intro', 30);
    keeper.book('intro', at(MON, 9), 'sam@example.com', 0);
    assert.deepEqual(keeper.listSlots('bo-intro', MON, MON, 0), [at(MON, 9), at(MON, 9, 15), at(MON, 9, 30)]);
    assert.deepEqual(keeper.listBookings('bo'), []);
  });
});
