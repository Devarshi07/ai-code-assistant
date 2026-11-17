const express = require('express');
const requestId = require('./middleware/request-id');
const errorHandler = require('./middleware/error-handler');
const {createStore} = require('./store/memory-store');
const seed = require('./store/seed');
const {createGroupService} = require('./services/group-service');
const {createExpenseService} = require('./services/expense-service');
const {createBalanceService} = require('./services/balance-service');
const {groupsController} = require('./controllers/groups-controller');
const {expensesController} = require('./controllers/expenses-controller');
const {balancesController} = require('./controllers/balances-controller');
const groupsRouter = require('./routes/groups');

// Builds the app without listening, so tests can start it on any port.
// options.store: a MemoryStore (defaults to the sample data in store/seed.js)
// options.now:   a clock, () => Date (defaults to the real time)
function createApp({store = createStore(seed), now} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(express.json({limit: '100kb'}));

  const groups = createGroupService({store, now});
  const expenses = createExpenseService({store, now});
  const balances = createBalanceService({store, now});

  app.get('/health', (req, res) => res.json({status: 'ok'}));
  app.use('/api/groups', groupsRouter({
    groups: groupsController(groups),
    expenses: expensesController(expenses),
    balances: balancesController(balances)
  }));

  app.use((req, res) => {
    res.status(404).json({error: {code: 'not_found', message: `No route for ${req.method} ${req.path}.`}});
  });
  app.use(errorHandler);

  app.locals.store = store;
  return app;
}

module.exports = {createApp};
