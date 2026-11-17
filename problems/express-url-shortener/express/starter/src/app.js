const express = require('express');
const errorHandler = require('./middleware/error-handler');
const {createStore} = require('./store/memory-store');
const seed = require('./store/seed');
const {createLinkService} = require('./services/link-service');
const {linksController} = require('./controllers/links-controller');
const linksRouter = require('./routes/links');
const redirectRouter = require('./routes/redirect');

// Builds the app without listening, so tests can start it on any port.
// options.store:  a MemoryStore (defaults to the sample data in store/seed.js)
// options.now:    a clock, () => Date (defaults to the real time)
// options.random: () => number in [0, 1) used to generate slugs
function createApp({store = createStore(seed), now, random} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({limit: '100kb'}));

  const links = createLinkService({store, now, random});
  const controller = linksController(links);

  app.get('/health', (req, res) => res.json({status: 'ok'}));
  app.use('/api/links', linksRouter(controller));
  app.use('/', redirectRouter(controller));

  app.use((req, res) => {
    res.status(404).json({error: {code: 'not_found', message: `No route for ${req.method} ${req.path}.`}});
  });
  app.use(errorHandler);

  app.locals.store = store;
  return app;
}

module.exports = {createApp};
