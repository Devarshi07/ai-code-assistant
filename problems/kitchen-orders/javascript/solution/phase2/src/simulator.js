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

/**
 * Run the service described by `orders` through the kitchen line.
 * `menu` maps dish names to MenuItems (menu.get(name)), and `stations` lists
 * the Station objects of the line. Orders may be given in any order.
 *
 * The clock advances one minute at a time. Each minute, newly arrived dishes
 * join their station's queue, cooks whose dish is done are released, and every
 * free cook takes the best-ranked waiting dish.
 * @returns {KitchenRun}
 */
function simulate(orders, menu, stations) {
  const cooks = new Map(stations.map(station => [station.name, station.cooks]));
  const arrivals = new Map(); // minute -> orders rung in then
  let clock = Infinity;
  let left = 0;
  for (const order of orders) {
    if (!arrivals.has(order.arrival)) arrivals.set(order.arrival, []);
    arrivals.get(order.arrival).push(order);
    clock = Math.min(clock, order.arrival);
    left += order.dishes.length;
  }
  const waiting = new Map(stations.map(station => [station.name, []])); // queued dishes per station
  const stoves = new Map(stations.map(station => [station.name, []])); // finish minute of each dish cooking
  const ready = new Map();

  while (left > 0) {
    for (const order of arrivals.get(clock) || []) {
      order.dishes.forEach((dish, position) => {
        const item = menu.get(dish);
        if (!waiting.has(item.station)) throw new Error(`"${dish}" needs station "${item.station}", which is not on the line`);
        waiting.get(item.station).push({ priority: order.priority, arrival: order.arrival, orderId: order.id, position, prep: item.prep });
      });
    }
    for (const [name, queue] of waiting) {
      const stove = stoves.get(name).filter(done => done > clock);
      stoves.set(name, stove);
      while (queue.length && stove.length < cooks.get(name)) {
        let best = 0;
        for (let i = 1; i < queue.length; i++) if (ranksAhead(queue[i], queue[best])) best = i;
        const [dish] = queue.splice(best, 1);
        const done = clock + dish.prep;
        stove.push(done);
        ready.set(dish.orderId, Math.max(ready.get(dish.orderId) ?? done, done));
        left -= 1;
      }
    }
    clock += 1;
  }

  const late = orders
    .filter(order => order.due !== null && ready.get(order.id) > order.due)
    .map(order => ({ id: order.id, minutesLate: ready.get(order.id) - order.due }))
    .sort((a, b) => a.id - b.id);
  return { ready, late };
}

module.exports = { simulate, ranksAhead };
