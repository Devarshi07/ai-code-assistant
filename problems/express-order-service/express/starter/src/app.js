const express = require('express');
const requestId = require('./middleware/request-id');
const errorHandler = require('./middleware/error-handler');
const {createStore} = require('./store/memory-store');
const seed = require('./store/seed');
const {createOrderService} = require('./services/order-service');
const {createProductService} = require('./services/product-service');
const {ordersController} = require('./controllers/orders-controller');
const {productsController} = require('./controllers/products-controller');
const ordersRouter = require('./routes/orders');
const productsRouter = require('./routes/products');

// Builds the app without listening, so tests can start it on any port.
// options.store: a MemoryStore (defaults to the sample data in store/seed.js)
// options.now:   a clock, () => Date (defaults to the real time)
function createApp({store = createStore(seed), now} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(express.json({limit: '100kb'}));

  const orders = createOrderService({store, now});
  const products = createProductService({store});

  app.get('/health', (req, res) => res.json({status: 'ok'}));
  app.use('/products', productsRouter(productsController(products)));
  app.use('/orders', ordersRouter(ordersController(orders)));

  app.use((req, res) => {
    res.status(404).json({error: {code: 'not_found', message: `No route for ${req.method} ${req.path}.`}});
  });
  app.use(errorHandler);

  app.locals.store = store;
  return app;
}

module.exports = {createApp};
