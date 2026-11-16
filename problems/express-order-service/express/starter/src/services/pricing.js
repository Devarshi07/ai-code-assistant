// Money is always an integer number of cents, never a float.

const DELIVERY_FEE_CENTS = 399;
const FREE_DELIVERY_FROM_CENTS = 3500;

// One priced line per item, using the product's current price.
function priceLines(items, productsBySku) {
  return items.map(({sku, quantity}) => {
    const product = productsBySku.get(sku);
    return {
      sku,
      name: product.name,
      quantity,
      unitPriceCents: product.priceCents,
      lineTotalCents: product.priceCents * quantity
    };
  });
}

// Delivery is free once the subtotal reaches FREE_DELIVERY_FROM_CENTS.
function orderTotals(lines) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents, 0);
  const deliveryCents = subtotalCents >= FREE_DELIVERY_FROM_CENTS ? 0 : DELIVERY_FEE_CENTS;
  return {subtotalCents, deliveryCents, totalCents: subtotalCents + deliveryCents};
}

module.exports = {priceLines, orderTotals, DELIVERY_FEE_CENTS, FREE_DELIVERY_FROM_CENTS};
