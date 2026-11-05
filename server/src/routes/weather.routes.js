const express = require('express');
const { optionalAuth, requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const ctrl = require('../controllers/weather.controller');

const router = express.Router();

/** Place + day weather. Super Admin always; everyone else when weatherEnabled. */
router.get('/', optionalAuth, ctrl.lookup);
router.get('/cities', optionalAuth, ctrl.listCities);
router.get('/alerts', optionalAuth, ctrl.listAlerts);

router.post('/cities', requireAuth, requireRole(ROLES.SUPER_ADMIN), ctrl.addCity);
router.delete('/cities/:id', requireAuth, requireRole(ROLES.SUPER_ADMIN), ctrl.removeCity);
router.post('/refresh', requireAuth, requireRole(ROLES.SUPER_ADMIN), ctrl.refresh);

module.exports = router;
