const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const ctrl = require('../controllers/availability.controller');

const router = express.Router();
const ownerOrManager = requireRole(ROLES.STADIUM_OWNER, ROLES.STADIUM_MANAGER);

router.patch('/:blockId', requireAuth, ownerOrManager, ctrl.updateBlock);
router.delete('/:blockId', requireAuth, ownerOrManager, ctrl.deleteBlock);

module.exports = router;
