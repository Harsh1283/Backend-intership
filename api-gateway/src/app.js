const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const userProxy = require('./routes/userProxy');
const notificationProxy = require('./routes/notificationProxy');
const services = require('./config/services');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
app.use(helmet());
app.use(cors());

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.get('/health/full', async (req, res) => {
  const check = async (url) => {
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch (error) {
      logger.warn('Backend health check failed', { url, error: error.message });
      return false;
    }
  };

  const [userService, notificationService] = await Promise.all([
    check(services.user),
    check(services.notification)
  ]);
  const healthy = userService && notificationService;
  return res.status(healthy ? 200 : 503).json({
    gateway: 'ok',
    userService: userService ? 'ok' : 'unavailable',
    notificationService: notificationService ? 'ok' : 'unavailable'
  });
});

// Keep proxy routes before any JSON parser so request bodies stream unchanged.
app.use('/api/auth', userProxy);
app.use('/api/notifications', notificationProxy);
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
