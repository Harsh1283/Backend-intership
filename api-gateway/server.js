require('dotenv').config();

const app = require('./src/app');
const logger = require('./src/utils/logger');

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET is not configured');
  process.exit(1);
}

const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => logger.info(`API Gateway listening on port ${port}`));

function shutdown(signal) {
  logger.info(`Received ${signal}; shutting down`);
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
