const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkinController');
const { authenticate, authorize, ROLES } = require('../middleware/authMiddleware');

router.use(authenticate, authorize(ROLES.ORGANIZER, ROLES.EVENT_ADMIN));

router.get('/events', checkinController.getScannerEvents);
router.post('/verify', checkinController.verifyTicket);
router.post('/manual', checkinController.manualCheckIn);
router.post('/undo', checkinController.undoCheckIn);
router.get('/stats/:eventId', checkinController.getStats);
router.get('/search/:eventId', checkinController.searchAttendees);
router.get('/manifest/:eventId', checkinController.getManifest);
router.post('/sync', checkinController.syncCheckins);

module.exports = router;
