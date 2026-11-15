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

/**
 * Run the service described by `orders` through the kitchen line.
 * `menu` maps dish names to MenuItems (menu.get(name)), and `stations` lists
 * the Station objects of the line. Orders may be given in any order.
 * @returns {KitchenRun}
 */
function simulate(orders, menu, stations) {
  throw new Error('Not implemented: simulate (Phase 2)');
}

module.exports = { simulate };
