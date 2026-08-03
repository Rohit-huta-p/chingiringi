import AdminSettings from './adminSettingsModel.js';

// Never leak the raw Razorpay secret to the client. Return a masked hint plus
// a boolean so the UI can show "Connected" without ever holding the secret.
function presentSettings(doc) {
  const s = doc.toObject ? doc.toObject() : { ...doc };
  const secret = s.razorpayKeySecret || '';
  s.razorpayConfigured = !!(s.razorpayKeyId && secret);
  s.razorpayKeySecretMasked = secret ? `••••••••${secret.slice(-4)}` : '';
  delete s.razorpayKeySecret;

  const webhookSecret = s.razorpayWebhookSecret || '';
  s.razorpayWebhookConfigured = !!webhookSecret;
  s.razorpayWebhookSecretMasked = webhookSecret ? `••••••••${webhookSecret.slice(-4)}` : '';
  delete s.razorpayWebhookSecret;
  return s;
}

/**
 * GET /api/admin/settings
 * Returns the singleton config doc. Creates it with defaults if missing.
 * The Razorpay secret is masked — see presentSettings.
 */
export const getSettings = async (req, res) => {
  const settings = await AdminSettings.get();
  res.json({ status: 'success', data: { settings: presentSettings(settings) } });
};

/**
 * PATCH /api/admin/settings
 * Update any subset of fields. Silently ignores unknown keys.
 */
export const updateSettings = async (req, res) => {
  const ALLOWED = [
    'passThroughPercent',
    'coinsPerRupee',
    'coinsPerShare',
    'maxSharesPerDay',
    'defaultLockDays',
    'cuelinksPublisherId',
    'amazonAssociateTag',
    'razorpayKeyId',
    'razorpayAccountNumber',
    'razorpayEnabled',
  ];
  const updates = {};
  for (const k of ALLOWED) if (req.body[k] !== undefined) updates[k] = req.body[k];

  // The secret is write-only and optional: only overwrite it when a non-empty
  // value is sent, so re-saving the form without re-typing the secret keeps
  // the stored one. Sending an explicit empty string via razorpayKeySecret
  // won't clear it — use a dedicated clear flow if that's ever needed.
  if (typeof req.body.razorpayKeySecret === 'string' && req.body.razorpayKeySecret.trim()) {
    updates.razorpayKeySecret = req.body.razorpayKeySecret.trim();
  }
  // Webhook secret is write-only + optional, same as the key secret.
  if (typeof req.body.razorpayWebhookSecret === 'string' && req.body.razorpayWebhookSecret.trim()) {
    updates.razorpayWebhookSecret = req.body.razorpayWebhookSecret.trim();
  }

  if (updates.passThroughPercent !== undefined) {
    const n = Number(updates.passThroughPercent);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      res.status(400);
      throw new Error('passThroughPercent must be between 0 and 1');
    }
    updates.passThroughPercent = n;
  }
  if (updates.coinsPerRupee !== undefined) {
    const n = Number(updates.coinsPerRupee);
    if (!Number.isFinite(n) || n < 1) {
      res.status(400);
      throw new Error('coinsPerRupee must be >= 1');
    }
    updates.coinsPerRupee = n;
  }
  if (updates.defaultLockDays !== undefined) {
    const n = Number(updates.defaultLockDays);
    if (!Number.isFinite(n) || n < 0) {
      res.status(400);
      throw new Error('defaultLockDays must be >= 0');
    }
    updates.defaultLockDays = n;
  }
  for (const key of ['coinsPerShare', 'maxSharesPerDay']) {
    if (updates[key] !== undefined) {
      const n = Number(updates[key]);
      if (!Number.isFinite(n) || n < 0) { res.status(400); throw new Error(`${key} must be >= 0`); }
      updates[key] = n;
    }
  }

  const settings = await AdminSettings.findOneAndUpdate(
    { key: 'default' },
    { $set: updates },
    { new: true, upsert: true },
  );
  res.json({ status: 'success', data: { settings: presentSettings(settings) } });
};
