// Plans cartons for the sample export and prints the bench manifests.
const path = require('node:path');
const { CARTON_TYPES, smallestCartonFor } = require('./src/cartons');
const { readOrders } = require('./src/orders');
const { packOrder } = require('./src/packer');
const { carrierLabels, formatManifest } = require('./src/manifest');
const { formatGrams } = require('./src/units');

const SAMPLE = path.join(__dirname, 'data', 'orders.csv');

function main() {
  for (const order of readOrders(SAMPLE)) {
    // Orders that fit one carton get the smallest box that holds them;
    // everything else is split across Large boxes.
    const kind = smallestCartonFor(order.totalWeightG, order.hasFragile) || CARTON_TYPES.L;
    console.log(`${order.orderId}: ${order.unitCount} units, ${formatGrams(order.totalWeightG)} -> ${kind.name}`);
    try {
      const cartons = packOrder(order, kind);
      console.log(formatManifest(order.orderId, cartons));
      console.log('  labels: ' + carrierLabels(order.orderId, cartons).join('; '));
    } catch (error) {
      if (!/^Not implemented/.test(error.message)) throw error;
      console.log(`  packing: ${error.message}`);
    }
    console.log('');
  }
}

if (require.main === module) main();
