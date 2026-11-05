// Maps every booking/payment/stadium status to one of 4 muted semantic
// palettes — deliberately not "a different bright color per status".
export const STATUS_GROUP = {
  HELD: 'pending',
  PAYMENT_PENDING: 'pending',
  PENDING: 'pending',

  CONFIRMED: 'confirmed',
  CHECKED_IN: 'confirmed',
  IN_PROGRESS: 'confirmed',
  COMPLETED: 'confirmed',
  SETTLED: 'confirmed',
  SUCCESS: 'confirmed',
  APPROVED: 'confirmed',
  ACTIVE: 'confirmed',

  EXPIRED: 'cancelled',
  CANCELLED: 'cancelled',
  NO_SHOW: 'cancelled',
  FAILED: 'cancelled',
  REJECTED: 'cancelled',
  SUSPENDED: 'cancelled',

  DISPUTED: 'info',
  PROCESSING: 'info',
  REFUNDED: 'info',
};

export const STATUS_CLASSES = {
  confirmed: 'bg-status-confirmed-bg text-status-confirmed-text',
  pending: 'bg-status-pending-bg text-status-pending-text',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled-text',
  info: 'bg-status-info-bg text-status-info-text',
};

export const STATUS_LABELS = {
  HELD: 'Held',
  PAYMENT_PENDING: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked in',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  SETTLED: 'Settled',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
  DISPUTED: 'Disputed',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SUCCESS: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
  ACTIVE: 'Active',
};

export function classesForStatus(status) {
  const group = STATUS_GROUP[status] || 'info';
  return STATUS_CLASSES[group];
}

export function labelForStatus(status) {
  return STATUS_LABELS[status] || status;
}
