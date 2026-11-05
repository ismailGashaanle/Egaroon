const express = require('express');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const fieldCtrl = require('../controllers/field.controller');
const availabilityCtrl = require('../controllers/availability.controller');
const platformCtrl = require('../controllers/platform.controller');

const router = express.Router();

router.get('/:fieldId/slots', optionalAuth, platformCtrl.getFieldSlots);
router.get('/:fieldId', fieldCtrl.getField);
router.patch('/:fieldId', requireAuth, requireRole(ROLES.STADIUM_OWNER, ROLES.STADIUM_MANAGER), fieldCtrl.updateField);
router.post(
  '/:fieldId/ops',
  requireAuth,
  requireRole(ROLES.STADIUM_OWNER, ROLES.STADIUM_MANAGER),
  fieldCtrl.setFieldOps
);
router.delete('/:fieldId', requireAuth, requireRole(ROLES.STADIUM_OWNER), fieldCtrl.deleteField);

router.get('/:fieldId/availability', availabilityCtrl.listBlocksForField);
router.post(
  '/:fieldId/availability',
  requireAuth,
  requireRole(ROLES.STADIUM_OWNER, ROLES.STADIUM_MANAGER),
  (req, res, next) => {
    req.body.fieldId = req.params.fieldId;
    next();
  },
  availabilityCtrl.createBlock
);

module.exports = router;
