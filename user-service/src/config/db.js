const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000
  });
  logger.info('Connected to MongoDB');
}

module.exports = { connectDatabase };
