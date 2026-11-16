// HTTP in, HTTP out: controllers read the request, call the service and
// choose the status code. Business rules live in the services.
function ordersController(orders) {
  return {
    async create(req, res) {
      const order = await orders.createOrder(req.body);
      res.json(order);
    },

    async show(req, res) {
      res.json(await orders.getOrder(req.params.id));
    },

    async list(req, res) {
      res.json(await orders.listOrders(req.query));
    },

    async cancel(req, res) {
      res.json(await orders.cancelOrder(req.params.id));
    }
  };
}

module.exports = {ordersController};
