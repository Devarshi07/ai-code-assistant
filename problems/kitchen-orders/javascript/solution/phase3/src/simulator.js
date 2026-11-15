// Kitchen simulation: when will each order really be ready?
//
// The host-stand quote (Order#quote) assumes every station is idle. On a busy
// service, dishes queue at their station behind other tickets, so expo needs a
// simulation of the line.
//
// House rules, as agreed with the head chef:
//
// 1. When an order arrives, each of its dishes joins the queue of its station.
// 2. A station has `cooks` identical cooks. A cook makes one dish at a time,
//    start to finish, which takes the dish's prep minutes.
// 3. A free cook always takes the waiting dish that ranks first: delivery-app
//    orders before everything else, then the earliest order arrival, then the
//    lowest order id, then the dish's position on its ticket.
// 4. Everything that happens in a minute (cooks finishing, orders arriving)
//    counts before free cooks pick their next dish in that minute. A cook who
//    finishes at 12:10pm can start another dish at 12:10pm.
// 5. An order is ready when its last dish is finished.
const { Heap } = require('./heap');

/**
 * Outcome of one simulated service.
 * @typedef {object} KitchenRun
 * @property {Map<number, number>} ready  order id -> minute its last dish finished
 * @property {{id: number, minutesLate: number}[]} late  late orders, ascending id
 */

/** True when waiting dish `a` ranks ahead of `b` under the house rules. */
function ranksAhead(a, b) {
  if (a.priority !== b.priority) return a.priority;
  if (a.arrival !== b.arrival) return a.arrival < b.arrival;
  if (a.orderId !== b.orderId) return a.orderId < b.orderId;
  return a.position < b.position;
}

const finishesFirst = (a, b) => a < b;

/**
 * Run the service described by `orders` through the kitchen line.
 * `menu` maps dish names to MenuItems (menu.get(name)), and `stations` lists
 * the Station objects of the line. Orders may be given in any order.
 *
 * Stations never share cooks or dishes, so each one is simulated on its own as
 * a discrete-event loop (see runStation). An order's ready time is the latest
 * finish over all of its dishes. O(D log D) for D dishes.
 * @returns {KitchenRun}
 */
function simulate(orders, menu, stations) {
  const cooks = new Map(stations.map(station => [station.name, station.cooks]));
  const tickets = new Map(stations.map(station => [station.name, []])); // every dish bound for each station
  for (const order of orders) {
    order.dishes.forEach((dish, position) => {
      const item = menu.get(dish);
      const queue = tickets.get(item.station);
      if (!queue) throw new Error(`"${dish}" needs station "${item.station}", which is not on the line`);
      queue.push({ priority: order.priority, arrival: order.arrival, orderId: order.id, position, prep: item.prep });
    });
  }

  const ready = new Map();
  for (const [name, dishes] of tickets) {
    dishes.sort((a, b) => a.arrival - b.arrival);
    runStation(dishes, cooks.get(name), ready);
  }

  const late = orders
    .filter(order => order.due !== null && ready.get(order.id) > order.due)
    .map(order => ({ id: order.id, minutesLate: ready.get(order.id) - order.due }))
    .sort((a, b) => a.id - b.id);
  return { ready, late };
}

/**
 * Simulate one station. `dishes` is sorted by arrival; updates `ready` in place.
 * waiting: heap of queued dishes in house-rule order.
 * stove:   heap of finish minutes of the dishes being cooked.
 * The clock only visits minutes where something happens: the next arrival when
 * nothing is queued, or the next cook finishing when nobody is free.
 */
function runStation(dishes, cooks, ready) {
  const waiting = new Heap(ranksAhead);
  const stove = new Heap(finishesFirst);
  let free = cooks;
  let clock = -Infinity;
  let i = 0;
  while (i < dishes.length || waiting.size) {
    if (!waiting.size) clock = Math.max(clock, dishes[i].arrival);
    else if (!free) clock = Math.max(clock, stove.peek());
    while (stove.size && stove.peek() <= clock) {
      stove.pop();
      free += 1;
    }
    while (i < dishes.length && dishes[i].arrival <= clock) waiting.push(dishes[i++]);
    while (free && waiting.size) {
      const dish = waiting.pop();
      const done = clock + dish.prep;
      stove.push(done);
      free -= 1;
      if (!(ready.get(dish.orderId) >= done)) ready.set(dish.orderId, done);
    }
  }
}

module.exports = { simulate, ranksAhead };
