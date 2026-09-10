const Notification = require('../models/Notification');
const logger = require('../utils/logger');

async function sendWelcomeNotification({ userId, name, email }) {
  logger.info(`Simulated email sent to ${email}: Welcome ${name}!`, { userId, email });
  return Notification.create({ userId, email, type: 'welcome_email', status: 'sent' });
}

module.exports = { sendWelcomeNotification };
