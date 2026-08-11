// backend/src/modules/shares/shareRedirectController.js
import crypto from 'crypto';
import mongoose from 'mongoose';
import ShareEvent from './shareModel.js';
import ShareClick from './shareClickModel.js';
import Wallet from '../wallet/walletModel.js';
import Transaction from '../transactions/transactionModel.js';
import { notify } from '../notifications/notificationService.js';
import { evaluateShareConfirm } from './shareConfirm.js';

const SCHEME   = process.env.SHARE_APP_SCHEME || 'chingiringapp';
const WEB_BASE = process.env.SHARE_WEB_BASE || 'https://chingiring.com';
const VALID_TYPES = new Set(['product', 'store']);

function parseSharerId(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('cr_')) return null;
  const id = ref.slice(3);
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
// safe to embed in a <script> block (neutralizes </script> and quotes)
function jsString(s) { return JSON.stringify(String(s)).replace(/</g, '\\u003c').replace(/>/g, '\\u003e'); }

// Attempts the app; falls back to web after ~1.5s unless the app took over
// (page goes hidden). Manual link covers in-app browsers that block schemes.
function interstitial(type, id, nonce) {
  const appUrl = `${SCHEME}://${type}/${id}`;
  const webUrl = `${WEB_BASE}/${type}/${id}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening…</title></head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 24px;color:#1e1b45">
<p style="font-size:16px">Opening in the app…</p>
<p><a id="web" href="${escapeHtml(webUrl)}" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#5b4be6;color:#fff;border-radius:10px;text-decoration:none">Continue on web</a></p>
<script nonce="${nonce}">
(function(){var app=${jsString(appUrl)},web=${jsString(webUrl)};
var t=setTimeout(function(){location.href=web},1500);
document.addEventListener('visibilitychange',function(){if(document.hidden)clearTimeout(t)});
location.href=app;})();
</script></body></html>`;
}

async function confirmAndCredit(ev) {
  // ponytail: non-transactional confirm-then-credit (matches existing wallet code). The atomic
  // flip precedes the credit to keep exactly-once; rare cost is a save failure leaving a confirmed
  // event uncredited (recoverable), never a double-pay.
  // Atomic guard: only the update that flips pending→confirmed credits.
  const won = await ShareEvent.findOneAndUpdate(
    { _id: ev._id, status: 'pending' },
    { $set: { status: 'confirmed', confirmedAt: new Date() } },
    { new: true },
  );
  if (!won) return false; // someone else confirmed first
  let wallet = await Wallet.findOne({ userId: ev.userId });
  if (!wallet) wallet = await Wallet.create({ userId: ev.userId });
  wallet.coins += ev.coinsAwarded;
  wallet.lifetimeEarned += ev.coinsAwarded;
  await wallet.save();
  await Transaction.create({
    userId: ev.userId, type: 'coin_credit', amount: ev.coinsAwarded, status: 'confirmed',
    description: `Share reward — ${ev.itemType}`,
    metadata: { reason: 'share', itemType: ev.itemType, itemId: String(ev.itemId) },
  });
  notify({ userId: ev.userId, type: 'share_confirmed', data: { coins: ev.coinsAwarded, itemType: ev.itemType } }).catch(() => {});
  return true;
}

// GET /s/:type/:id?ref=cr_<userId>
export const shareRedirect = async (req, res) => {
  const { type, id } = req.params;
  const nonce = crypto.randomBytes(16).toString('base64');
  res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'`);

  if (!VALID_TYPES.has(type) || !mongoose.Types.ObjectId.isValid(id)) {
    return res.redirect(302, WEB_BASE); // invalid link — send home, don't echo untrusted input
  }

  try {
    const sharerId = parseSharerId(req.query.ref);
    if (sharerId) {
      // Most recent still-pending share of this item by this user, within 30d.
      const ev = await ShareEvent.findOne({
        userId: sharerId, itemType: type, itemId: id, status: 'pending',
      }).sort({ createdAt: -1 });

      if (ev) {
        const visitorIp = req.ip;
        const visitorUa = req.headers['user-agent'] || '';
        const ageSeconds = (Date.now() - new Date(ev.createdAt).getTime()) / 1000;
        const decision = evaluateShareConfirm({
          status: ev.status, sharerIp: ev.sharerIp, visitorIp, visitorUa, ageSeconds,
        });
        let confirmed = false;
        if (decision.confirm) confirmed = await confirmAndCredit(ev);
        ShareClick.create({
          shareEventId: ev._id, sharerUserId: sharerId, itemType: type, itemId: id,
          visitorIp, visitorUa, confirmed, reason: decision.reason,
        }).catch(() => {});
      }
    }
  } catch (err) {
    // Never fail the opener's landing on a logging/confirm error.
    console.error('[shareRedirect] confirm error:', err?.message);
  }

  return res.status(200).send(interstitial(type, id, nonce));
};
