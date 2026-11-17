// Replays Saturday's lunch log through the kitchen model.
import { readFileSync } from 'node:fs';
import { HOUSE_LINE, HOUSE_MENU } from './src/menu.ts';
import { parseLog } from './src/tickets.ts';
import { simulate } from './src/simulator.ts';
import type { KitchenRun } from './src/simulator.ts';
import { rail, serviceReport } from './src/report.ts';

const LOG = new URL('./data/saturday_lunch.txt', import.meta.url);

function main(): void {
  const orders = parseLog(readFileSync(LOG, 'utf8'));
  console.log('Ticket rail with host-stand quotes');
  console.log(rail(orders, HOUSE_MENU).join('\n'));
  console.log('');
  let run: KitchenRun;
  try {
    run = simulate(orders, HOUSE_MENU, HOUSE_LINE);
  } catch (error) {
    if (!(error instanceof Error) || !/^Not implemented/.test(error.message)) throw error;
    console.log(`Service simulation unavailable: ${error.message}`);
    return;
  }
  console.log(serviceReport('Saturday lunch', orders, HOUSE_MENU, HOUSE_LINE, run));
}

main();
