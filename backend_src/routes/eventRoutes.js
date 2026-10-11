const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticate, authorize, ROLES } = require('../middleware/authMiddleware');

router.get('/', eventController.getEvents);

router.post('/', authenticate, authorize(ROLES.ORGANIZER, ROLES.EVENT_ADMIN), eventController.createEvent);

module.exports = router;
