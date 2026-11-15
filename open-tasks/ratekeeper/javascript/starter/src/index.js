// Public entry point: `const { RateKeeper, ConfigError } = require('./src')`.
const errors = require('./errors');
const { RateKeeper, REASONS } = require('./rateKeeper');

module.exports = { RateKeeper, REASONS, ...errors };
