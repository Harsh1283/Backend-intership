const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const services = require('../config/services');
const authenticate = require('../middleware/authMiddleware');
const { loginRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const proxyOptions = {
  target: services.user,
  changeOrigin: true,
  proxyTimeout: 5000,
  pathRewrite: (path) => `/api/auth${path}`,
  on: {
    error: (error, req, res) => {
      if (!res.headersSent && !res.destroyed) res.status(503).json({ success: false, message: 'Service temporarily unavailable' });
    }
  }
};

const authProxy = createProxyMiddleware(proxyOptions);
router.post('/signup', authProxy);
router.post('/login', loginRateLimiter, authProxy);
router.use(authenticate);
router.use(authProxy);

module.exports = router;
