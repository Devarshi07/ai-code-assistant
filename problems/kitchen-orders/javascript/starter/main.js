// Replays Saturday's lunch log through the kitchen model.
const fs = require('node:fs');
const path = require('node:path');
const { HOUSE_LINE, HOUSE_MENU } = require('./src/menu');
const { parseLog } = require('./src/tickets');
const { simulate } = require('./src/simulator');
const { rail, serviceReport } = require('./src/report');

const LOG = path.join(__dirname, 'data', 'saturday_lunch.txt');

function main() {
  const orders = parseLog(fs.readFileSync(LOG, 'utf8'));
  console.log('Ticket rail with host-stand quotes');
  console.log(rail(orders, HOUSE_MENU).join('\n'));
  console.log('');
  let run;
  try {
    run = simulate(orders, HOUSE_MENU, HOUSE_LINE);
  } catch (error) {
    if (!/^Not implemented/.test(error.message)) throw error;
    console.log(`Service simulation unavailable: ${error.message}`);
    return;
  }
  console.log(serviceReport('Saturday lunch', orders, HOUSE_MENU, HOUSE_LINE, run));
}

if (require.main === module) main();
