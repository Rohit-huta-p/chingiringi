import AdminSettings from './adminSettingsModel.js';

/**
 * GET /api/admin/settings
 * Returns the singleton config doc. Creates it with defaults if missing.
 */
export const getSettings = async (req, res) => {
  const settings = await AdminSettings.get();
  res.json({ status: 'success', data: { settings } });
};

/**
 * PATCH /api/admin/settings
 * Update any subset of fields. Silently ignores unknown keys.
 */
export const updateSettings = async (req, res) => {
  const ALLOWED = [
    'passThroughPercent',
    'coinsPerRupee',
    'defaultLockDays',
    'cuelinksPublisherId',
    'amazonAssociateTag',
  ];
  const updates = {};
  for (const k of ALLOWED) if (req.body[k] !== undefined) updates[k] = req.body[k];

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

  const settings = await AdminSettings.findOneAndUpdate(
    { key: 'default' },
    { $set: updates },
    { new: true, upsert: true },
  );
  res.json({ status: 'success', data: { settings } });
};
