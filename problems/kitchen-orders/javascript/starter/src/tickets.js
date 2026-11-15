// Parser for the ticket printer log.
//
// One ticket per line:
//
//     11:58am order 106: caesar salad, 2x fries | app | due 12:20pm
//
// * The stamp is when the ticket was rung in (see clock.js).
// * Dishes are comma separated. "2x fries" means two portions of fries.
// * Optional flags follow a "|": "app" marks a delivery-app order, which the
//   cooks take first, and "due <time>" is the ready time promised to the guest.
//
// Blank lines and lines starting with "#" are ignored.
const { ClockError, parseClock } = require('./clock');
const { Order } = require('./orders');

const TICKET = /^(\S+)\s+order\s+(\d+)\s*:\s*(.*)$/i;
const PORTIONS = /^(\d+)\s*x\s+(.+)$/i;

/** A log line that could not be read. Carries the 1-based line number. */
class TicketError extends Error {
  constructor(lineNumber, message) {
    super(`line ${lineNumber}: ${message}`);
    this.name = 'TicketError';
    this.lineNumber = lineNumber;
  }
}

/** "burger, 2x fries" -> ["burger", "fries", "fries"]. */
function parseDishes(text) {
  const dishes = [];
  for (const raw of text.split(',')) {
    const part = raw.trim().split(/\s+/).join(' ').toLowerCase();
    if (!part) continue;
    const match = PORTIONS.exec(part);
    if (match) {
      for (let i = 0; i < Number(match[1]); i++) dishes.push(match[2]);
    } else {
      dishes.push(part);
    }
  }
  return dishes;
}

/** Parse a single log line into an Order. */
function parseTicket(line, lineNumber = 1) {
  const match = TICKET.exec(line.trim());
  if (!match) throw new TicketError(lineNumber, `expected "<time> order <id>: <dishes>", got ${JSON.stringify(line.trim())}`);
  const [body, ...flags] = match[3].split('|');
  let arrival;
  let priority = false;
  let due = null;
  try {
    arrival = parseClock(match[1]);
    for (const flag of flags.map(f => f.trim().toLowerCase())) {
      if (flag === 'app') priority = true;
      else if (flag.startsWith('due ')) due = parseClock(flag.slice(4));
      else throw new TicketError(lineNumber, `unknown flag ${JSON.stringify(flag)}`);
    }
  } catch (error) {
    if (error instanceof ClockError) throw new TicketError(lineNumber, error.message);
    throw error;
  }
  const dishes = parseDishes(body);
  if (dishes.length === 0) throw new TicketError(lineNumber, 'ticket has no dishes');
  return new Order({ id: Number(match[2]), arrival, dishes, priority, due });
}

/**
 * Parse a whole log into the ticket rail.
 * The rail lists orders by arrival time. Tickets rung in during the same
 * minute keep their printer order. Order ids must be unique.
 */
function parseLog(text) {
  const orders = [];
  const seen = new Set();
  text.split('\n').forEach((line, index) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const order = parseTicket(line, index + 1);
    if (seen.has(order.id)) throw new TicketError(index + 1, `order ${order.id} appears twice`);
    seen.add(order.id);
    orders.push(order);
  });
  return orders.sort((a, b) => a.arrival - b.arrival);
}

module.exports = { TicketError, parseDishes, parseTicket, parseLog };
