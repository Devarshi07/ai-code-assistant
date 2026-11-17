// Plain-text reports for the expo screen and the end-of-service email.
import { formatClock, formatDuration } from './clock.ts';
import type { Menu, Station } from './menu.ts';
import type { Order } from './orders.ts';
import type { KitchenRun } from './simulator.ts';

function flagsOf(order: Order): string {
  const flags: string[] = [];
  if (order.priority) flags.push('app');
  if (order.due !== null) flags.push(`due ${formatClock(order.due)}`);
  return flags.length ? `  [${flags.join(', ')}]` : '';
}

/** The ticket rail as the line sees it: one row per order with its quote. */
export function rail(orders: Order[], menu: Menu): string[] {
  return orders.map(order =>
    `${String(order.id).padStart(5)}  ${formatClock(order.arrival).padStart(7)}  quote ${formatClock(order.quote(menu)).padEnd(11)}` +
    `${order.dishes.join(', ')}${flagsOf(order)}`);
}

/** Map of station -> {dishes, minutes} for the whole service. */
export function stationLoad(orders: Order[], menu: Menu, stations: Station[]): Map<string, { dishes: number; minutes: number }> {
  const load = new Map(stations.map(station => [station.name, { dishes: 0, minutes: 0 }]));
  for (const order of orders) {
    for (const dish of order.dishes) {
      const item = menu.get(dish);
      if (!load.has(item.station)) load.set(item.station, { dishes: 0, minutes: 0 });
      const entry = load.get(item.station)!;
      entry.dishes += 1;
      entry.minutes += item.prep;
    }
  }
  return load;
}

/** Share of each station's cook-minutes spent cooking, first ticket to last plate. */
export function utilisation(orders: Order[], menu: Menu, stations: Station[], ready: Map<number, number>): Map<string, number> {
  const span = Math.max(Math.max(...ready.values()) - Math.min(...orders.map(o => o.arrival)), 1);
  const load = stationLoad(orders, menu, stations);
  return new Map(stations.map(s => [s.name, load.get(s.name)!.minutes / (s.cooks * span)]));
}

/** Per-order ready times and lateness, then how hard each station worked. */
export function serviceReport(title: string, orders: Order[], menu: Menu, stations: Station[], run: KitchenRun): string {
  const late = new Map(run.late.map(entry => [entry.id, entry.minutesLate]));
  const first = Math.min(...orders.map(o => o.arrival));
  const last = Math.max(...run.ready.values());
  const dishes = orders.reduce((sum, o) => sum + o.dishes.length, 0);
  const lines = [
    `${title}: ${orders.length} orders, ${dishes} dishes, first ticket ${formatClock(first)}, last plate ${formatClock(last)}`,
    '',
    'order  in       ready      wait  due      status',
  ];
  const byArrival = [...orders].sort((a, b) => a.arrival - b.arrival || a.id - b.id);
  for (const order of byArrival) {
    const ready = run.ready.get(order.id)!;
    const due = order.due !== null ? formatClock(order.due) : '';
    let status = '';
    if (late.has(order.id)) status = `LATE ${formatDuration(late.get(order.id)!)}`;
    else if (order.due !== null) status = 'on time';
    if (order.priority) status = status ? `${status}, app` : 'app';
    lines.push((`${String(order.id).padStart(5)}  ${formatClock(order.arrival).padStart(7)}  ${formatClock(ready).padEnd(9)}` +
      `${formatDuration(ready - order.arrival).padStart(6)}  ${due.padEnd(7)}  ${status}`).trimEnd());
  }

  const promised = orders.filter(o => o.due !== null).length;
  let longest: { id: number; wait: number } | null = null;
  for (const order of orders) {
    const wait = run.ready.get(order.id)! - order.arrival;
    if (!longest || wait > longest.wait || (wait === longest.wait && order.id < longest.id)) longest = { id: order.id, wait };
  }
  const lateMinutes = [...late.values()].reduce((sum, m) => sum + m, 0);
  lines.push(
    '',
    `${late.size} of ${promised} promised orders late (${formatDuration(lateMinutes)} in total). ` +
      `Longest wait: ${formatDuration(longest!.wait)} (order ${longest!.id}).`,
    '',
    'station  cooks  dishes  cooking   busy',
  );
  const load = stationLoad(orders, menu, stations);
  const shares = utilisation(orders, menu, stations, run.ready);
  for (const station of stations) {
    const { dishes: count, minutes } = load.get(station.name)!;
    const share = `${Math.round(shares.get(station.name)! * 100)}%`;
    lines.push(`${station.name.padEnd(8)} ${String(station.cooks).padStart(5)}  ${String(count).padStart(6)}  ` +
      `${formatDuration(minutes).padStart(7)}  ${share.padStart(5)}`);
  }
  return lines.join('\n');
}
