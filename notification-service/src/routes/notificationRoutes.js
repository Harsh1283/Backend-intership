const express = require('express');
const Notification = require('../models/Notification');

const router = express.Router();
router.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
router.get('/api/notifications', async (req, res, next) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(100).lean();
    return res.status(200).json({ success: true, notifications });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
