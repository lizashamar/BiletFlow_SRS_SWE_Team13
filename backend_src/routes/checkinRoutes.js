const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkinController');
const { authenticate, authorize, ROLES } = require('../middleware/authMiddleware');

router.post(
  '/verify',
  authenticate,
  authorize(ROLES.ORGANIZER, ROLES.EVENT_ADMIN),
  checkinController.verifyTicket
);

module.exports = router;
