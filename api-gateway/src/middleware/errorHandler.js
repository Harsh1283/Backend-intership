const logger = require('../utils/logger');

function errorHandler(error, req, res, next) {
  logger.error('Gateway request failed', { method: req.method, path: req.path, error: error.message, stack: error.stack });
  return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Internal server error' });
}

module.exports = errorHandler;
