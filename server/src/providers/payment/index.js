const MockProvider = require('./MockProvider');
const WaafiPayProvider = require('./WaafiPayProvider');
const DahabPayProvider = require('./DahabPayProvider');
const SifaloPayProvider = require('./SifaloPayProvider');

/**
 * Resolve adapter.
 * - PAYMENT_PROVIDER=mock|waafipay|dahabpay|sifalopay (explicit)
 * - PAYMENT_PROVIDER=auto → hormuud→waafi, golis→dahab, else mock (dev-friendly)
 */
function getPaymentProvider(name, { operator } = {}) {
  const configured = (name || process.env.PAYMENT_PROVIDER || 'auto').toLowerCase();

  const op = String(operator || '').toLowerCase();
  if (configured === 'auto' || configured === 'demo' || configured === 'mock') {
    if (op === 'hormuud' || op === 'telesom') return new WaafiPayProvider();
    if (op === 'golis' || op === 'somtel') return new DahabPayProvider();
    return new MockProvider();
  }

  switch (configured) {
    case 'sifalopay':
    case 'sifalo':
      return new SifaloPayProvider();
    case 'waafipay':
      return new WaafiPayProvider();
    case 'dahabpay':
    case 'edahab':
      return new DahabPayProvider();
    case 'mock':
    default:
      if (op === 'hormuud' || op === 'telesom') return new WaafiPayProvider();
      if (op === 'golis' || op === 'somtel') return new DahabPayProvider();
      return new MockProvider();
  }
}

module.exports = { getPaymentProvider, MockProvider, WaafiPayProvider, DahabPayProvider, SifaloPayProvider };
