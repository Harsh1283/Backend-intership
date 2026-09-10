const amqp = require('amqplib');
const logger = require('../utils/logger');

const EXCHANGE = 'user_events';
const QUEUE = 'user_events';
const DLX = 'user_events_dlx';
const RETRIES = 10;
const RETRY_DELAY_MS = 3000;

let connection;
let channel;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectRabbitMQ() {
  if (!process.env.RABBITMQ_URL) throw new Error('RABBITMQ_URL is not configured');
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      connection = await amqp.connect(process.env.RABBITMQ_URL);
      connection.on('error', (error) => logger.error('RabbitMQ connection error', { error: error.message }));
      connection.on('close', () => logger.warn('RabbitMQ connection closed'));
      channel = await connection.createConfirmChannel();
      await channel.assertExchange(EXCHANGE, 'direct', { durable: true });
      await channel.assertExchange(DLX, 'direct', { durable: true });
      await channel.assertQueue(QUEUE, { durable: true, arguments: { 'x-dead-letter-exchange': DLX } });
      await channel.bindQueue(QUEUE, EXCHANGE, 'user.created');
      logger.info('Connected to RabbitMQ and declared user_events topology');
      return;
    } catch (error) {
      logger.error('RabbitMQ connection attempt failed', { attempt, error: error.message });
      if (attempt === RETRIES) throw error;
      await delay(RETRY_DELAY_MS);
    }
  }
}

async function publishUserCreated(user) {
  if (!channel) throw new Error('RabbitMQ publisher is not connected');
  const payload = Buffer.from(JSON.stringify(user));
  logger.info('Publishing user.created event', { userId: user.userId });
  try {
    channel.publish(EXCHANGE, 'user.created', payload, { contentType: 'application/json', persistent: true, type: 'user.created' });
    await channel.waitForConfirms();
    logger.info('Published user.created event', { userId: user.userId });
  } catch (error) {
    logger.error('Failed to publish user.created event', { userId: user.userId, error: error.message });
    throw error;
  }
}

async function closeRabbitMQ() {
  if (channel) await channel.close();
  if (connection) await connection.close();
}

module.exports = { connectRabbitMQ, publishUserCreated, closeRabbitMQ };
