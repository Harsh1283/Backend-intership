const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const services = require('../config/services');
const authenticate = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(createProxyMiddleware({
  target: services.notification,
  changeOrigin: true,
  proxyTimeout: 5000,
  pathRewrite: (path) => `/api/notifications${path}`,
  on: {
    error: (error, req, res) => {
      if (!res.headersSent && !res.destroyed) res.status(503).json({ success: false, message: 'Service temporarily unavailable' });
    }
  }
}));

module.exports = router;
