require('dotenv').config();

const app = require('./src/app');
const { connectDatabase } = require('./src/config/db');
const { connectAndConsume, closeConsumer } = require('./src/consumers/userEventsConsumer');
const logger = require('./src/utils/logger');

const port = Number(process.env.PORT || 4002);

async function start() {
  await connectDatabase();
  await connectAndConsume();
  const server = app.listen(port, () => logger.info(`Notification Service listening on port ${port}`));

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}; shutting down`);
    server.close(async () => {
      await closeConsumer();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  logger.error('Notification Service failed to start', { error: error.message, stack: error.stack });
  process.exit(1);
});
