const express = require('express');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const notificationService = require('../services/notification.service');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const notifications = await notificationService.listForUser(req.user.id);
    const unread = notifications.filter((n) => !n.readAt).length;
    sendSuccess(res, 200, { notifications, unread });
  })
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await notificationService.markRead(req.params.id, req.user.id);
    sendSuccess(res, 200, { notification });
  })
);

module.exports = router;
