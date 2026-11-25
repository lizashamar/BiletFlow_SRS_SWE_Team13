const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const checkinController = require('../controllers/checkinController');
const { authenticate, authorize, ROLES } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/check-in', authorize(ROLES.ORGANIZER, ROLES.EVENT_ADMIN), checkinController.mobileCheckIn);

router.get('/', authorize(ROLES.ATTENDEE), ticketController.getMyTickets);
router.get('/:id', authorize(ROLES.ATTENDEE), ticketController.getTicketById);

module.exports = router;
