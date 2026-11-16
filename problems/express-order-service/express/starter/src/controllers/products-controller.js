function productsController(products) {
  return {
    async list(req, res) {
      res.json({data: await products.listProducts()});
    },

    async show(req, res) {
      res.json(await products.getProduct(req.params.sku));
    }
  };
}

module.exports = {productsController};
