const Razorpay = require('razorpay');

const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

const isConfigured = Boolean(keyId && keySecret);

// The Razorpay constructor throws when key_id is missing, which used to happen
// at require() time and took the whole server down before it could listen.
// Build the client only when it is actually configured; otherwise hand back a
// stub that fails with a useful message at the point a payment is attempted.
const notConfigured = () => {
  throw new Error(
    'Payments are not configured on this server. Set RAZORPAY_KEY_ID and ' +
      'RAZORPAY_KEY_SECRET in the environment, then restart.'
  );
};

const stub = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === 'isConfigured') return false;
      // Razorpay is used as razorpay.orders.create(...), so nested access must
      // also return something that throws only when finally invoked.
      return new Proxy(function () { notConfigured(); }, {
        get() {
          return function () { notConfigured(); };
        },
        apply() { notConfigured(); }
      });
    }
  }
);

if (!isConfigured) {
  console.warn('[Razorpay] ⚠️  RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set — payment routes will fail until configured.');
}

const razorpay = isConfigured
  ? new Razorpay({ key_id: keyId, key_secret: keySecret })
  : stub;

module.exports = razorpay;
module.exports.isConfigured = isConfigured;
