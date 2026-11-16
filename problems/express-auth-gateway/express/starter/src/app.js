const express = require('express');
const {createStore} = require('./store/memory-store');
const seed = require('./store/seed');
const authenticate = require('./middleware/authenticate');
const rateLimit = require('./middleware/rate-limit');
const errorHandler = require('./middleware/error-handler');
const {createRateLimiter} = require('./lib/rate-limiter');
const {createDocService} = require('./services/doc-service');
const {createAuditService} = require('./services/audit-service');
const {docsController} = require('./controllers/docs-controller');
const {adminController} = require('./controllers/admin-controller');
const docsRouter = require('./routes/docs');
const adminRouter = require('./routes/admin');

// Builds the app without listening.
// options.store:     a MemoryStore (defaults to the sample data)
// options.clock:     () => milliseconds since the epoch (defaults to Date.now)
// options.rateLimit: {limit, windowMs} per API token (defaults to 600 a minute)
function createApp({store = createStore(seed), clock = Date.now, rateLimit: limits = {limit: 600, windowMs: 60000}} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({limit: '100kb'}));

  const docs = createDocService({store, clock});
  const audit = createAuditService({store, clock});
  const limiter = createRateLimiter({...limits, now: clock});

  // Everything after this line needs a valid token.
  app.use(authenticate(store));
  app.use(rateLimit(limiter));

  // Load balancer health check.
  app.get('/health', (req, res) => res.json({status: 'ok'}));

  app.use('/docs', docsRouter(docsController(docs)));
  app.use('/admin', adminRouter(adminController({audit})));

  app.use((req, res) => {
    res.status(404).json({error: {code: 'not_found', message: `No route for ${req.method} ${req.path}.`}});
  });
  app.use(errorHandler);
  return app;
}

module.exports = {createApp};
