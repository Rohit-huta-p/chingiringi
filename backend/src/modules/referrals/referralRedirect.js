import express from 'express';
import { pickStoreUrl } from './referralService.js';

const router = express.Router();

const STORES = () => ({
  ios:     process.env.IOS_STORE_URL     || 'https://apps.apple.com/app/id0000000000',
  android: process.env.ANDROID_STORE_URL || 'https://play.google.com/store/apps/details?id=com.vcrohithuta.chingiringapp',
  web:     process.env.WEB_SIGNUP_URL    || 'https://chingiringi.com/signup',
});

function page({ code, appUrl, storeUrl }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Join Chingiringi</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0F172A;color:#fff;text-align:center;padding:48px 20px}
.btn{display:block;max-width:320px;margin:12px auto;padding:16px;border-radius:12px;font-weight:700;text-decoration:none}
.p{background:#6d28d9;color:#fff}.s{background:#1E293B;color:#cbd5e1}.code{font-size:22px;letter-spacing:2px;font-weight:800;margin:8px 0 24px}</style>
</head><body>
<h2>You've been invited 🎁</h2>
<p>Your referral code</p><div class="code">${code || '—'}</div>
<a class="btn p" href="${appUrl}">Open in app</a>
<a class="btn s" href="${storeUrl}">Get the app</a>
<script>
  // Try the installed app; if nothing takes over, send to the store.
  try { window.location.href = ${JSON.stringify(appUrl)}; } catch (e) {}
  setTimeout(function(){ window.location.href = ${JSON.stringify(storeUrl)}; }, 1500);
</script>
</body></html>`;
}

// GET /r/:code — best-effort, always 200s.
router.get('/:code', (req, res) => {
  const code = String(req.params.code || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 16);
  const storeUrl = pickStoreUrl(req.headers['user-agent'], STORES());
  const appUrl = `chingiring://signup?ref=${code}`;
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:");
  res.type('html').send(page({ code, appUrl, storeUrl }));
});

export default router;
