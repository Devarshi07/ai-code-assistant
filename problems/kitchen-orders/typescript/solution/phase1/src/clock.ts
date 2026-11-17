// Clock helpers for the kitchen display.
//
// The ticket printer stamps every ticket with a 12-hour wall-clock time such as
// "11:58am" or "1:05pm". Everything inside the kitchen model works in whole
// minutes since midnight at the start of service: 0 is 12:00am, 750 is 12:30pm.
// A late service can run past midnight, and those minutes keep counting up, so
// 1450 is 12:10am the next day.

export const MINUTES_PER_DAY = 24 * 60;
const STAMP = /^\s*(\d{1,2}):(\d{2})\s*([ap]m)\s*$/i;

/** Thrown for a time stamp the ticket printer could not have produced. */
export class ClockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClockError';
  }
}

/** Turn a printer stamp like "9:05am" or "6:30pm" into minutes since midnight. */
export function parseClock(text: string): number {
  const match = STAMP.exec(String(text));
  if (!match) throw new ClockError(`not a clock time: ${JSON.stringify(text)}`);
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 1 || hours > 12 || minutes > 59) throw new ClockError(`not a clock time: ${JSON.stringify(text)}`);
  // On a 12-hour clock "12" opens each half of the day: 12:05am is five past
  // midnight and 12:05pm is five past noon.
  hours %= 12;
  if (match[3].toLowerCase() === 'pm') hours += 12;
  return hours * 60 + minutes;
}

/** Inverse of parseClock: 750 -> "12:30pm". Later days get a "+N" marker. */
export function formatClock(minutes: number): string {
  const day = Math.floor(minutes / MINUTES_PER_DAY);
  const minuteOfDay = minutes - day * MINUTES_PER_DAY;
  const hours = Math.floor(minuteOfDay / 60);
  const mins = minuteOfDay % 60;
  const half = hours < 12 ? 'am' : 'pm';
  const stamp = `${hours % 12 || 12}:${String(mins).padStart(2, '0')}${half}`;
  return day === 0 ? stamp : `${stamp} +${day}`;
}

/** Compact duration for reports: 7 -> "7m", 65 -> "1h05m". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours === 0 ? `${mins}m` : `${hours}h${String(mins).padStart(2, '0')}m`;
}
