const { body } = require('express-validator');
const env = require('../config/env');
const validate = require('../middleware/validate');
const { sanitizePersonName, assertAllowedFields } = require('../utils/sanitizeInput');

const OPERATORS = ['hormuud', 'telesom', 'somtel', 'golis'];

const BASE_ALLOWED = [
  'bookingId',
  'teamId',
  'side',
  'coverFullMatch',
  'operator',
  'carrierId',
  'phone',
  'payerPhone',
  'payerName',
  'idempotencyKey',
  'teamBContactPhone',
  'teamBContactName',
  'invitePhoneTeamB',
  'currency',
  'payCurrency',
  'amount',
  'amountUsd',
  'amountSll',
  'exchangeRate',
];

/** Client-sent base prices or manipulation fields are rejected. */
const FORBIDDEN_PRICE_FIELDS = [
  'totalPrice',
  'teamShare',
  'discountAmount',
  'discountPercent',
  'baseTotalPrice',
  'price',
  'pricing',
];

function allowedFields() {
  const list = [...BASE_ALLOWED];
  if (env.nodeEnv !== 'production') list.push('forceInsufficient');
  return list;
}

/**
 * Strict payment initiate body validation.
 * Amounts/discounts are ignored at service layer; these fields are rejected if sent.
 */
const paymentInitiateRules = [
  body().custom((_, { req }) => {
    try {
      assertAllowedFields(req.body, allowedFields());
    } catch (err) {
      if (err.code === 'UNEXPECTED_FIELDS') {
        const banned = (err.fields || []).filter((f) => FORBIDDEN_PRICE_FIELDS.includes(f));
        if (banned.length) {
          throw new Error('Client prices are not accepted — amount comes from server pricing only');
        }
        throw new Error('Unexpected fields in request');
      }
      throw err;
    }
    return true;
  }),

  body('bookingId').isMongoId().withMessage('Invalid bookingId'),

  body('teamId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid teamId'),

  body('side')
    .optional({ values: 'falsy' })
    .isIn(['teamA', 'teamB'])
    .withMessage('side must be teamA or teamB'),

  body('coverFullMatch').optional().isBoolean().toBoolean(),

  body('operator')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .toLowerCase()
    .isIn(OPERATORS)
    .withMessage(`operator must be one of: ${OPERATORS.join(', ')}`),

  body('carrierId')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .toLowerCase()
    .isIn(OPERATORS)
    .withMessage(`carrierId must be one of: ${OPERATORS.join(', ')}`),

  body().custom((_, { req }) => {
    const op = req.body.operator || req.body.carrierId;
    if (!op || !OPERATORS.includes(String(op).toLowerCase())) {
      throw new Error(`Choose carrier: ${OPERATORS.join(', ')}`);
    }
    return true;
  }),

  body('phone')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ min: 7, max: 20 })
    .withMessage('Invalid phone'),

  body('payerPhone')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ min: 7, max: 20 })
    .withMessage('Invalid payerPhone'),

  body().custom((_, { req }) => {
    if (!req.body.payerPhone && !req.body.phone) {
      throw new Error('payerPhone is required / Lambarka lacag bixinta waa loo baahan yahay');
    }
    return true;
  }),

  body('payerName')
    .exists({ values: 'falsy' })
    .withMessage('Captain name is required / Magaca kabtanka waa loo baahan yahay')
    .custom((value) => {
      const name = sanitizePersonName(value);
      if (!name) {
        throw new Error(
          'Captain name: 2–80 letters/spaces only / Magaca: xarafyo iyo boosas kaliya'
        );
      }
      return true;
    }),

  body('idempotencyKey')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ min: 8, max: 128 })
    .matches(/^[\w.:\-]+$/)
    .withMessage('Invalid idempotencyKey'),

  body('teamBContactPhone')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ min: 7, max: 20 }),

  body('teamBContactName')
    .optional({ values: 'falsy' })
    .custom((value) => {
      const name = sanitizePersonName(value);
      if (value && !name) throw new Error('Invalid teamBContactName');
      return true;
    }),

  body('invitePhoneTeamB')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ min: 7, max: 20 })
    .withMessage('Invalid invitePhoneTeamB'),

  body('forceInsufficient').optional().isBoolean().toBoolean(),

  body('currency')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .toUpperCase()
    .isIn(['USD', 'SLL', 'SLSH'])
    .withMessage('currency must be USD or SLL'),

  body('payCurrency')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .toUpperCase()
    .isIn(['USD', 'SLL', 'SLSH'])
    .withMessage('payCurrency must be USD or SLL'),

  body('amount').optional(),
  body('amountUsd').optional(),
  body('amountSll').optional(),
  body('exchangeRate').optional(),
];

const validatePaymentInitiate = [...paymentInitiateRules, validate];

module.exports = {
  OPERATORS,
  paymentInitiateRules,
  validatePaymentInitiate,
  allowedFields,
};
