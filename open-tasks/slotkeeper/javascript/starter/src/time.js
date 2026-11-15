// Time helpers.
//
// SlotKeeper measures time in integer minutes since the epoch, which is Monday
// 00:00 of week 0. There are no time zones, no daylight saving and no seconds.
// Day index d covers minutes [d * 1440, (d + 1) * 1440) and its weekday is
// d % 7 (0 = Monday ... 6 = Sunday).

const MINUTES_PER_DAY = 1440;
const SLOT_MINUTES = 15;
const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Minutes since the epoch for hour:minute on day index `day`. at(7, 9, 30) === 10650 */
function at(day, hour = 0, minute = 0) {
  return day * MINUTES_PER_DAY + hour * 60 + minute;
}

/** Day index that contains minute t. */
function dayOf(t) {
  return Math.floor(t / MINUTES_PER_DAY);
}

/** Weekday of a day index: 0 = Monday ... 6 = Sunday. */
function weekdayOf(day) {
  return ((day % 7) + 7) % 7;
}

/** Minutes since midnight of the day that contains t. */
function minuteOfDay(t) {
  return t - dayOf(t) * MINUTES_PER_DAY;
}

/** Readable label such as 'Mon d7 09:30' for logs and error messages. */
function describe(t) {
  const day = dayOf(t);
  const minute = minuteOfDay(t);
  const pad = n => String(n).padStart(2, '0');
  return `${WEEKDAY_NAMES[weekdayOf(day)]} d${day} ${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

module.exports = { MINUTES_PER_DAY, SLOT_MINUTES, WEEKDAY_NAMES, at, dayOf, weekdayOf, minuteOfDay, describe };
