// Orders as the kitchen sees them.

class Order {
  /**
   * @param {object} fields
   * @param {number} fields.id
   * @param {number} fields.arrival   minute the ticket was rung in (see clock.js)
   * @param {string[]} fields.dishes  one entry per portion, in ticket order
   * @param {boolean} [fields.priority] delivery-app order: cooks take these first
   * @param {number|null} [fields.due]  ready time promised to the guest, if any
   */
  constructor({ id, arrival, dishes, priority = false, due = null }) {
    if (!dishes || dishes.length === 0) throw new Error(`order ${id} has no dishes`);
    this.id = id;
    this.arrival = arrival;
    this.dishes = dishes;
    this.priority = priority;
    this.due = due;
  }

  /**
   * Host-stand estimate: arrival plus the slowest dish on the ticket.
   * This assumes every station is idle when the ticket comes in, so it is only
   * honest on a quiet afternoon. During a rush, dishes queue behind other
   * tickets; see simulator.js.
   */
  quote(menu) {
    return this.arrival + Math.max(...this.dishes.map(dish => menu.get(dish).prep));
  }

  /** The set of stations this ticket needs. */
  stations(menu) {
    return new Set(this.dishes.map(dish => menu.get(dish).station));
  }
}

module.exports = { Order };
