const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { rateLimit } = require('../middleware/common');

// 20 попыток за 15 минут с одного IP — защита от перебора паролей
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many attempts, try again later' });

router.post('/login', authLimiter, authController.login);
router.post('/register', authLimiter, authController.register);
router.get('/me', authenticate, authController.me);

module.exports = router;
