const { normalizeSomaliPhone, digitsOnly } = require('../../utils/somaliPhone');

/** Mask phone for logs: 61****00 (never full number). */
function maskPhone(input) {
  const n = normalizeSomaliPhone(input) || digitsOnly(input);
  if (!n || n.length < 4) return '****';
  const national = n.startsWith('252') ? n.slice(3) : n.replace(/^\+/, '');
  if (national.length >= 8) {
    return `${national.slice(0, 2)}****${national.slice(-2)}`;
  }
  if (national.length >= 4) {
    return `${national.slice(0, 2)}****${national.slice(-1)}`;
  }
  return '****';
}

/** Mask email for logs: a***@domain.com */
function maskEmail(email) {
  const s = String(email || '').trim().toLowerCase();
  const at = s.indexOf('@');
  if (at < 1) return '***';
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}

function maskTarget(channel, target) {
  if (channel === 'email' || (typeof target === 'string' && target.includes('@'))) {
    return maskEmail(target);
  }
  return maskPhone(target);
}

module.exports = { maskPhone, maskEmail, maskTarget };
