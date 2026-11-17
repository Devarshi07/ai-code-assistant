// Orders as the kitchen sees them.
import type { Menu } from './menu.ts';

export interface OrderFields {
  id: number;
  /** minute the ticket was rung in (see clock.ts) */
  arrival: number;
  /** one entry per portion, in ticket order */
  dishes: string[];
  /** delivery-app order: cooks take these first */
  priority?: boolean;
  /** ready time promised to the guest, if any */
  due?: number | null;
}

export class Order {
  id: number;
  arrival: number;
  dishes: string[];
  priority: boolean;
  due: number | null;

  constructor({ id, arrival, dishes, priority = false, due = null }: OrderFields) {
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
   * tickets; see simulator.ts.
   */
  quote(menu: Menu): number {
    return this.arrival + Math.max(...this.dishes.map(dish => menu.get(dish).prep));
  }

  /** The set of stations this ticket needs. */
  stations(menu: Menu): Set<string> {
    return new Set(this.dishes.map(dish => menu.get(dish).station));
  }
}
