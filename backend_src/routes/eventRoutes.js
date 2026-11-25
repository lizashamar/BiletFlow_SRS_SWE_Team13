const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticate, optionalAuth, authorize, ROLES } = require('../middleware/authMiddleware');

const organizerOnly = [authenticate, authorize(ROLES.ORGANIZER)];

router.get('/', eventController.getEvents);
router.get('/mine', ...organizerOnly, eventController.getMyEvents);
router.post('/', ...organizerOnly, eventController.createEvent);

router.get('/:id', optionalAuth, eventController.getEventById);
router.get('/:id/calendar.ics', optionalAuth, eventController.getEventCalendar);
router.patch('/:id', ...organizerOnly, eventController.updateEvent);
router.post('/:id/activate-paid-sales', ...organizerOnly, eventController.activatePaidSales);
router.get('/:id/stats', ...organizerOnly, eventController.getEventStats);
router.get('/:id/attendees', ...organizerOnly, eventController.getAttendees);

router.get('/:id/analytics', ...organizerOnly, eventController.getEventAnalytics);

module.exports = router;
