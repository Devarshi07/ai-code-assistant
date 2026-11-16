// Plans cartons for the sample export and prints the bench manifests.
import { CARTON_TYPES, smallestCartonFor } from './src/cartons.ts';
import { readOrders } from './src/orders.ts';
import { packOrder } from './src/packer.ts';
import { carrierLabels, formatManifest } from './src/manifest.ts';
import { formatGrams } from './src/units.ts';

const SAMPLE = new URL('./data/orders.csv', import.meta.url);

function main(): void {
  for (const order of readOrders(SAMPLE)) {
    // Orders that fit one carton get the smallest box that holds them;
    // everything else is split across Large boxes.
    const kind = smallestCartonFor(order.totalWeightG, order.hasFragile) ?? CARTON_TYPES.L;
    console.log(`${order.orderId}: ${order.unitCount} units, ${formatGrams(order.totalWeightG)} -> ${kind.name}`);
    try {
      const cartons = packOrder(order, kind);
      console.log(formatManifest(order.orderId, cartons));
      console.log('  labels: ' + carrierLabels(order.orderId, cartons).join('; '));
    } catch (error) {
      if (!(error instanceof Error) || !/^Not implemented/.test(error.message)) throw error;
      console.log(`  packing: ${error.message}`);
    }
    console.log('');
  }
}

main();
