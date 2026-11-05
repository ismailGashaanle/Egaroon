const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: require('../services/deployInfo.service').describeDeployment() });
});

router.use('/auth', require('./auth.routes'));
router.use('/teams', require('./team.routes'));
router.use('/stadiums', require('./stadium.routes'));
router.use('/fields', require('./field.routes'));
router.use('/availability-blocks', require('./availability.routes'));
router.use('/bookings', require('./booking.routes'));
router.use('/lineups', require('./lineup.routes'));
router.use('/payments', require('./payment.routes'));
router.use('/webhooks', require('./webhook.routes'));
router.use('/tournaments', require('./tournament.routes'));
router.use('/owner', require('./owner.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/gifts', require('./freeMatchGift.routes'));
router.use('/platform', require('./platform.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/uploads', require('./upload.routes'));
router.use('/weather', require('./weather.routes'));

module.exports = router;
