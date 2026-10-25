const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkinController');
const { authenticate, authorize, ROLES } = require('../middleware/authMiddleware');

router.use(authenticate, authorize(ROLES.ORGANIZER, ROLES.EVENT_ADMIN));

router.post('/verify', checkinController.verifyTicket);
router.get('/manifest/:eventId', checkinController.getManifest);
router.post('/sync', checkinController.syncCheckins);

module.exports = router;
