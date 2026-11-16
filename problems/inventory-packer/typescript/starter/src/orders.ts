// Loads orders from the WMS order export (CSV).
//
//   order_id,sku,description,weight_kg,qty,flags
//   A1001,MUG-STN-350,Stoneware mug 350 ml,0.38,2,fragile
//
// weight_kg is the weight of ONE unit. flags is empty or a '|'-separated list
// drawn from: fragile, hazmat. Lines of one order need not be adjacent; orders
// come back in the order they first appear in the export.
import { readFileSync } from 'node:fs';
import { Item, Order, OrderLine } from './catalog.ts';
import type { ItemFlags } from './catalog.ts';
import { parseWeightKg } from './units.ts';

export const COLUMNS: readonly string[] = ['order_id', 'sku', 'description', 'weight_kg', 'qty', 'flags'];
const FLAGS: readonly string[] = ['fragile', 'hazmat'];

/** The export is malformed. The message names the offending line. */
export class OrderFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderFormatError';
  }
}

export function loadOrders(text: string): Order[] {
  const lines = String(text).split(/\r?\n/);
  const header = splitCsvLine(lines[0] || '').map(cell => cell.trim());
  if (header.join(',') !== COLUMNS.join(',')) {
    throw new OrderFormatError(`line 1: expected header ${COLUMNS.join(',')}`);
  }
  const orders = new Map<string, Order>();
  lines.slice(1).forEach((line, index) => {
    const lineNo = index + 2;
    const row = splitCsvLine(line);
    if (!row.some(cell => cell.trim())) return;
    if (row.length !== COLUMNS.length) {
      throw new OrderFormatError(`line ${lineNo}: expected ${COLUMNS.length} fields, found ${row.length}`);
    }
    const [orderId, sku, description, weight, qty, flags] = row.map(cell => cell.trim());
    let item: Item;
    let quantity: number;
    try {
      const { fragile, hazmat } = parseFlags(flags);
      item = new Item(sku, description, parseWeightKg(weight), { fragile, hazmat });
      quantity = parseQuantity(qty);
    } catch (error) {
      throw new OrderFormatError(`line ${lineNo}: ${(error as Error).message}`);
    }
    let order = orders.get(orderId);
    if (!order) {
      order = new Order(orderId);
      orders.set(orderId, order);
    }
    order.lines.push(new OrderLine(item, quantity));
  });
  return [...orders.values()];
}

export function readOrders(file: string | URL): Order[] {
  return loadOrders(readFileSync(file, 'utf8'));
}

/** Split one CSV line, honouring "quoted, fields" and "" escapes. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cell); cell = ''; }
    else cell += ch;
  }
  cells.push(cell);
  return line.length ? cells : [];
}

function parseFlags(text: string): Required<ItemFlags> {
  const names = text.split('|').map(name => name.trim().toLowerCase()).filter(Boolean);
  const unknown = names.filter(name => !FLAGS.includes(name));
  if (unknown.length) throw new Error(`unknown flag '${unknown[0]}'`);
  return { fragile: names.includes('fragile'), hazmat: names.includes('hazmat') };
}

function parseQuantity(text: string): number {
  if (!/^\d+$/.test(text) || Number(text) < 1) throw new Error(`quantity '${text}' must be a whole number, at least 1`);
  return Number(text);
}
