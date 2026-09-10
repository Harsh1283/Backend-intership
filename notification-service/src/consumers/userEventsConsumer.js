const amqp = require('amqplib');
const logger = require('../utils/logger');
const { sendWelcomeNotification } = require('../services/notificationService');

const EXCHANGE = 'user_events';
const QUEUE = 'user_events';
const DLX = 'user_events_dlx';
const DLQ = 'user_events_dlq';

let connection;
let channel;
const RETRIES = 10;
const RETRY_DELAY_MS = 3000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function validateEvent(event) {
  if (!event || typeof event !== 'object') throw new Error('Event must be an object');
  for (const field of ['userId', 'name', 'email']) {
    if (typeof event[field] !== 'string' || !event[field].trim()) throw new Error(`Missing or invalid ${field}`);
  }
}

async function connectRabbitMQ() {
  if (!process.env.RABBITMQ_URL) throw new Error('RABBITMQ_URL is not configured');
  connection = await amqp.connect(process.env.RABBITMQ_URL);
  connection.on('error', (error) => logger.error('RabbitMQ connection error', { error: error.message }));
  connection.on('close', () => logger.warn('RabbitMQ connection closed'));
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, 'direct', { durable: true });
  await channel.assertExchange(DLX, 'direct', { durable: true });
  await channel.assertQueue(DLQ, { durable: true });
  await channel.bindQueue(DLQ, DLX, 'user.created');
  await channel.assertQueue(QUEUE, { durable: true, arguments: { 'x-dead-letter-exchange': DLX } });
  await channel.bindQueue(QUEUE, EXCHANGE, 'user.created');
  await channel.prefetch(1);
}

async function connectAndConsume() {
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      await connectRabbitMQ();
      break;
    } catch (error) {
      logger.error('RabbitMQ consumer connection attempt failed', { attempt, error: error.message });
      if (attempt === RETRIES) throw error;
      await delay(RETRY_DELAY_MS);
    }
  }

  await channel.consume(QUEUE, async (msg) => {
    if (!msg) return;
    logger.info('Received user event', { routingKey: msg.fields.routingKey });
    try {
      const event = JSON.parse(msg.content.toString());
      validateEvent(event);
      await sendWelcomeNotification(event);
      channel.ack(msg);
      logger.info('Processed user event successfully', { userId: event.userId });
    } catch (error) {
      logger.error('Failed to process user event; routing to DLQ', { error: error.message });
      channel.nack(msg, false, false);
    }
  });
  logger.info('Notification Service consuming user_events');
}

async function closeConsumer() {
  if (channel) await channel.close();
  if (connection) await connection.close();
}

module.exports = { connectAndConsume, closeConsumer };
