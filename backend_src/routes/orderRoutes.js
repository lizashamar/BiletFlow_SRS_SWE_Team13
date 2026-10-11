const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize, ROLES } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/', authorize(ROLES.ATTENDEE), orderController.createOrder);
router.get('/', authorize(ROLES.ATTENDEE), orderController.getMyOrders);
router.get('/:id', authorize(ROLES.ATTENDEE), orderController.getOrderById);

module.exports = router;
