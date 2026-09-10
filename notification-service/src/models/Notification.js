const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  email: { type: String, required: true },
  type: { type: String, required: true, enum: ['welcome_email'] },
  status: { type: String, required: true, enum: ['sent', 'failed'] }
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('Notification', notificationSchema);
