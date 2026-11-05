const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Field = require('../models/Field');
const managerService = require('../services/manager.service');
const { FIELD_TYPES, capacityForType, sortStadiumFields } = require('../constants/fieldFormats');
const { attachFieldOps } = require('../utils/fieldAvailability');

const createField = asyncHandler(async (req, res) => {
  await managerService.assertStadiumAccess(req.params.stadiumId, req.user);

  const {
    name,
    type,
    images,
    pricingMode,
    pricePerPlayer,
    fixedPrice,
    openingTime,
    closingTime,
    slotDurationMinutes,
  } = req.body;

  if (!FIELD_TYPES.includes(type)) {
    throw ApiError.badRequest(`Field type must be one of: ${FIELD_TYPES.join(', ')}`);
  }

  const field = await Field.create({
    stadium: req.params.stadiumId,
    name,
    type,
    capacity: capacityForType(type),
    images,
    pricingMode,
    pricePerPlayer,
    fixedPrice,
    openingTime,
    closingTime,
    slotDurationMinutes,
  });
  sendSuccess(res, 201, { field: attachFieldOps(field) });
});

const listFieldsForStadium = asyncHandler(async (req, res) => {
  const Stadium = require('../models/Stadium');
  const stadium = await Stadium.findById(req.params.stadiumId).select('owner status');
  if (!stadium) throw ApiError.notFound('Stadium not found');
  await require('./stadium.controller').assertStadiumVisible(stadium, req.user);
  const fields = await Field.find({ stadium: req.params.stadiumId, status: 'active' });
  sendSuccess(res, 200, { fields: sortStadiumFields(fields.map(attachFieldOps)) });
});

const getField = asyncHandler(async (req, res) => {
  const field = await Field.findById(req.params.fieldId).populate('stadium');
  if (!field) throw ApiError.notFound('Field not found');
  sendSuccess(res, 200, { field: attachFieldOps(field) });
});

const updateField = asyncHandler(async (req, res) => {
  const field = await Field.findById(req.params.fieldId);
  if (!field) throw ApiError.notFound('Field not found');
  await managerService.assertStadiumAccess(field.stadium.toString(), req.user);

  const editable = [
    'name',
    'type',
    'images',
    'pricingMode',
    'pricePerPlayer',
    'fixedPrice',
    'openingTime',
    'closingTime',
    'slotDurationMinutes',
    'status',
  ];
  for (const key of editable) {
    if (req.body[key] !== undefined) field[key] = req.body[key];
  }
  if (req.body.type) {
    if (!FIELD_TYPES.includes(req.body.type)) {
      throw ApiError.badRequest(`Field type must be one of: ${FIELD_TYPES.join(', ')}`);
    }
    field.capacity = capacityForType(req.body.type);
  }
  await field.save();
  sendSuccess(res, 200, { field: attachFieldOps(field) });
});

const deleteField = asyncHandler(async (req, res) => {
  const field = await Field.findById(req.params.fieldId);
  if (!field) throw ApiError.notFound('Field not found');
  await managerService.assertStadiumAccess(field.stadium.toString(), req.user, { ownerOnly: true });
  field.status = 'inactive';
  await field.save();
  sendSuccess(res, 200, { field: attachFieldOps(field) });
});

const setFieldOps = asyncHandler(async (req, res) => {
  const field = await Field.findById(req.params.fieldId);
  if (!field) throw ApiError.notFound('Field not found');
  await managerService.assertStadiumAccess(field.stadium.toString(), req.user);

  const mode = req.body.mode; // 'online' | 'offline'
  if (mode === 'online') {
    field.isOnline = true;
    field.offlineFrom = undefined;
    field.offlineUntil = undefined;
    field.offlineReason = undefined;
  } else if (mode === 'offline') {
    field.isOnline = false;
    field.offlineFrom = req.body.offlineFrom ? new Date(req.body.offlineFrom) : new Date();
    field.offlineUntil = req.body.offlineUntil ? new Date(req.body.offlineUntil) : undefined;
    if (req.body.reason !== undefined || req.body.offlineReason !== undefined) {
      field.offlineReason = String(req.body.reason || req.body.offlineReason || '').trim();
    }
  } else if (
    req.body.isOnline !== undefined ||
    req.body.offlineUntil !== undefined ||
    req.body.offlineFrom !== undefined
  ) {
    if (req.body.isOnline !== undefined) field.isOnline = Boolean(req.body.isOnline);
    if (req.body.offlineFrom !== undefined) {
      field.offlineFrom = req.body.offlineFrom ? new Date(req.body.offlineFrom) : undefined;
    }
    if (req.body.offlineUntil !== undefined) {
      field.offlineUntil = req.body.offlineUntil ? new Date(req.body.offlineUntil) : undefined;
    }
    if (req.body.reason !== undefined || req.body.offlineReason !== undefined) {
      field.offlineReason = String(req.body.reason || req.body.offlineReason || '').trim();
    }
    if (field.isOnline) {
      field.offlineFrom = undefined;
      field.offlineUntil = undefined;
      field.offlineReason = undefined;
    }
  } else {
    throw ApiError.badRequest('Send mode: online|offline, or isOnline / offlineFrom / offlineUntil');
  }

  if (field.offlineFrom && field.offlineUntil && field.offlineUntil <= field.offlineFrom) {
    throw ApiError.badRequest('offlineUntil must be after offlineFrom');
  }

  await field.save();
  sendSuccess(res, 200, { field: attachFieldOps(field) });
});

module.exports = {
  createField,
  listFieldsForStadium,
  getField,
  updateField,
  deleteField,
  setFieldOps,
};
