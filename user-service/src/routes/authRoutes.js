const express = require('express');
const { body } = require('express-validator');
const { signup, login, me } = require('../controllers/authController');
const validateRequest = require('../middleware/validateRequest');
const authenticate = require('../middleware/auth');

const router = express.Router();

const signupValidation = [
  body('name').isString().trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
  body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
  body('password').isString().notEmpty().withMessage('Password is required')
];

router.post('/signup', signupValidation, validateRequest, signup);
router.post('/login', loginValidation, validateRequest, login);
router.get('/me', authenticate, me);

module.exports = router;
