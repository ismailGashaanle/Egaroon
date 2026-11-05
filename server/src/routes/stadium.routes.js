const express = require('express');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const ctrl = require('../controllers/stadium.controller');
const fieldCtrl = require('../controllers/field.controller');
const managerCtrl = require('../controllers/manager.controller');
const availabilityCtrl = require('../controllers/availability.controller');
const policyCtrl = require('../controllers/bookingPolicy.controller');

const router = express.Router();
const ownerOrManager = requireRole(ROLES.STADIUM_OWNER, ROLES.STADIUM_MANAGER);

router.get('/', optionalAuth, ctrl.listStadiums);
router.get('/:stadiumId/policy', policyCtrl.getStadiumPolicy);
router.get('/:stadiumId', optionalAuth, ctrl.getStadium);
router.get('/:stadiumId/fields', optionalAuth, fieldCtrl.listFieldsForStadium);
router.get(
  '/:stadiumId/availability-blocks',
  requireAuth,
  ownerOrManager,
  availabilityCtrl.listBlocksForStadium
);
router.post(
  '/:stadiumId/lock',
  requireAuth,
  ownerOrManager,
  availabilityCtrl.createStadiumLock
);

router.post('/', requireAuth, requireRole(ROLES.STADIUM_OWNER), ctrl.createStadium);
router.patch('/:stadiumId', requireAuth, ownerOrManager, ctrl.updateStadium);
router.post('/:stadiumId/ops', requireAuth, ownerOrManager, ctrl.setStadiumOps);
router.delete('/:stadiumId', requireAuth, requireRole(ROLES.STADIUM_OWNER), ctrl.deleteStadium);

router.post('/:stadiumId/fields', requireAuth, ownerOrManager, fieldCtrl.createField);

router.get('/:stadiumId/managers', requireAuth, requireRole(ROLES.STADIUM_OWNER), managerCtrl.listManagers);
router.post('/:stadiumId/managers', requireAuth, requireRole(ROLES.STADIUM_OWNER), managerCtrl.inviteManager);
router.delete(
  '/:stadiumId/managers/:managerId',
  requireAuth,
  requireRole(ROLES.STADIUM_OWNER),
  managerCtrl.revokeManager
);

router.post(
  '/:stadiumId/verify',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  ctrl.setStadiumStatus
);

module.exports = router;
