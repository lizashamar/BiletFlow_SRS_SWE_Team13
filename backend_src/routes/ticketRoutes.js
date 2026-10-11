const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticate, authorize, ROLES } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(ROLES.ATTENDEE), ticketController.getMyTickets);
router.get('/:id', authorize(ROLES.ATTENDEE), ticketController.getTicketById);

module.exports = router;
