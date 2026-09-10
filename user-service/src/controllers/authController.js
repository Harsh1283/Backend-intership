const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { publishUserCreated } = require('../config/rabbitmq');

function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, createdAt: user.createdAt };
}

async function signup(req, res, next) {
  try {
    const name = req.body.name.trim();
    const email = req.body.email.toLowerCase().trim();
    const existing = await User.findOne({ email }).select('_id');
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email is already registered' });
    }

    const password = await bcrypt.hash(req.body.password, 12);
    const user = await User.create({ name, email, password });
    await publishUserCreated({ userId: user._id.toString(), name: user.name, email: user.email });

    return res.status(201).json({ success: true, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email }).select('+password');
    const valid = user && await bcrypt.compare(req.body.password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    });
    return res.status(200).json({ success: true, token });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
}

module.exports = { signup, login, me };
