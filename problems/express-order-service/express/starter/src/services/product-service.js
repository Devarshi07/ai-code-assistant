const {NotFoundError} = require('../errors');

function createProductService({store}) {
  async function listProducts() {
    const products = await store.listProducts();
    return products.sort((a, b) => a.sku.localeCompare(b.sku));
  }

  async function getProduct(sku) {
    const product = await store.getProduct(sku);
    if (!product) throw new NotFoundError('Product', sku);
    return product;
  }

  return {listProducts, getProduct};
}

module.exports = {createProductService};
