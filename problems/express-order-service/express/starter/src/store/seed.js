// Sample data for `npm start` and demo.js. Tests build their own stores.

const products = [
  {sku: 'oat-milk-1l', name: 'Oat milk, 1 l', priceCents: 349, stock: 40},
  {sku: 'sourdough', name: 'Sourdough loaf', priceCents: 525, stock: 12},
  {sku: 'eggs-12', name: 'Free-range eggs, 12', priceCents: 499, stock: 30},
  {sku: 'coffee-beans', name: 'Coffee beans, 250 g', priceCents: 1150, stock: 8},
  {sku: 'basil', name: 'Basil plant', priceCents: 275, stock: 5}
];

const line = (sku, quantity) => {
  const product = products.find(p => p.sku === sku);
  return {sku, name: product.name, quantity, unitPriceCents: product.priceCents, lineTotalCents: product.priceCents * quantity};
};

const order = (id, customerId, status, createdAt, lines) => {
  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const deliveryCents = subtotalCents >= 3500 ? 0 : 399;
  return {id, customerId, status, items: lines, subtotalCents, deliveryCents, totalCents: subtotalCents + deliveryCents, createdAt};
};

const orders = [
  order('ord_00001', 'cus_ana', 'shipped', '2026-03-02T08:15:00.000Z', [line('sourdough', 1), line('eggs-12', 1)]),
  order('ord_00002', 'cus_ben', 'paid', '2026-03-02T09:40:00.000Z', [line('coffee-beans', 3), line('oat-milk-1l', 2)]),
  order('ord_00003', 'cus_ana', 'cancelled', '2026-03-03T17:05:00.000Z', [line('basil', 2)]),
  order('ord_00004', 'cus_chen', 'pending', '2026-03-04T07:55:00.000Z', [line('oat-milk-1l', 6)]),
  order('ord_00005', 'cus_ben', 'pending', '2026-03-04T12:30:00.000Z', [line('eggs-12', 2), line('sourdough', 2)])
];

module.exports = {products, orders};
