const logger = require('../utils/logger');

function errorHandler(error, req, res, next) {
  logger.error('Request failed', { method: req.method, path: req.path, error: error.message, stack: error.stack });

  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: 'Email is already registered' });
  }

  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : error.message
  });
}

module.exports = errorHandler;
