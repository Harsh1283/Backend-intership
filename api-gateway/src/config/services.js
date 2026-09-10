const services = {
  user: process.env.USER_SERVICE_URL || 'http://localhost:4001',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4002'
};

module.exports = services;
