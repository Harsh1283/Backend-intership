require('dotenv').config();

const app = require('./src/app');
const { connectDatabase } = require('./src/config/db');
const { connectRabbitMQ, closeRabbitMQ } = require('./src/config/rabbitmq');
const logger = require('./src/utils/logger');

const port = Number(process.env.PORT || 4001);

async function start() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  await connectDatabase();
  await connectRabbitMQ();
  const server = app.listen(port, () => logger.info(`User Service listening on port ${port}`));

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}; shutting down`);
    server.close(async () => {
      await closeRabbitMQ();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  logger.error('User Service failed to start', { error: error.message, stack: error.stack });
  process.exit(1);
});
