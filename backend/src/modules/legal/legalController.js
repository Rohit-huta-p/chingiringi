import { PRIVACY_MD, TERMS_MD, ABOUT_MD } from './legalDocs.js';
import User from '../users/userModel.js';
import { generateAndStoreOTP, verifyUserOTP } from '../auth/authService.js';
import { sendMail, isEmailConfigured } from '../../services/email.js';
import { deleteUserAndData } from '../users/accountDeletion.js';

// Dependency-free markdown → HTML for our own trusted legal docs. Handles the
// subset the docs use: #/##/### headings, "- " bullets, **bold**, "---" rule,
// blank-line-separated paragraphs. Not a general Markdown engine.
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inline(s) {
  // esc first (so any & < > are neutralised), then turn **bold** into <strong>.
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
function mdToHtml(md) {
  const out = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('- ')) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    closeList();
    if (line === '') continue;
    else if (line === '---') out.push('<hr/>');
    else if (line.startsWith('### ')) out.push(`<h3>${inline(line.slice(4))}</h3>`);
    else if (line.startsWith('## ')) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.startsWith('# ')) out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('\n');
}

function page(title, md) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="index,follow"/>
<title>${esc(title)} — Chingiringi</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f0f4f8; color: #1e293b;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6; -webkit-text-size-adjust: 100%; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 1.7rem; line-height: 1.25; margin: 0 0 .25rem; }
  h2 { font-size: 1.15rem; margin: 1.6rem 0 .4rem; }
  h3 { font-size: 1rem; margin: 1.1rem 0 .3rem; }
  p { margin: .5rem 0; }
  ul { margin: .4rem 0 .8rem; padding-left: 1.25rem; }
  li { margin: .2rem 0; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 2rem 0; }
  strong { font-weight: 700; }
  @media (prefers-color-scheme: dark) {
    body { background: #0f172a; color: #e2e8f0; }
    hr { border-top-color: #334155; }
  }
</style>
</head>
<body><main class="wrap">
${mdToHtml(md)}
</main></body>
</html>`;
}

// Public, no-auth HTML pages. Override CSP so the inline <style> is allowed
// (helmet's app-level default forbids inline styles); everything else stays locked.
function send(res, html) {
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:");
  res.status(200).type('html').send(html);
}

export const privacyPage = (req, res) => send(res, page('Privacy Policy', PRIVACY_MD));
export const termsPage = (req, res) => send(res, page('Terms & Conditions', TERMS_MD));
export const aboutPage = (req, res) => send(res, page('About', ABOUT_MD));

// ── Account deletion (Google Play requirement) ───────────────────────────────
// Email-verified two-step flow: request a 6-digit code → confirm it → the account
// and its personal data are permanently deleted. There is deliberately NO
// unauthenticated delete-by-identifier — the code is emailed to the address on
// file, proving ownership before anything is deleted.
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'https://chingiringi.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /delete-account → the interactive page is the static page on the web app.
export const deleteAccountPage = (req, res) => res.redirect(302, `${WEB_ORIGIN}/delete-account`);

// POST /delete-account/request  { email }  → email a verification code.
export const deleteAccountRequest = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ status: 'error', message: 'Enter a valid email address.' });
  }
  if (!isEmailConfigured()) {
    return res.status(503).json({
      status: 'error',
      message: 'Email verification is temporarily unavailable. You can delete your account in the app: Settings → Delete Account.',
    });
  }
  // Only send when the account exists, but always respond identically so the
  // endpoint can't be used to test whether an email is registered.
  const user = await User.findOne({ email }).select('_id').lean();
  if (user) {
    const otp = await generateAndStoreOTP(null, email);
    try {
      await sendMail({
        to: email,
        subject: 'Your Chingiringi account deletion code',
        text: `Your Chingiringi account deletion code is ${otp}.\n\nIt expires in 5 minutes. Enter it on the deletion page to permanently delete your account.\n\nIf you did not request this, ignore this email — nothing will be changed.`,
      });
    } catch (err) {
      console.error('[delete-account] email send failed:', err.message);
      return res.status(502).json({ status: 'error', message: 'Could not send the verification email. Please try again shortly.' });
    }
  }
  return res.status(200).json({
    status: 'success',
    message: 'If an account exists for that email, a 6-digit verification code has been sent.',
  });
};

// POST /delete-account/confirm  { email, otp }  → verify code, then delete.
export const deleteAccountConfirm = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '').trim();
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ status: 'error', message: 'Enter your email and the 6-digit code.' });
  }
  let user;
  try {
    user = await verifyUserOTP(email, otp); // throws on invalid / expired / too many attempts
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message || 'Invalid or expired code.' });
  }
  if (user) {
    await deleteUserAndData(user._id);
  }
  return res.status(200).json({
    status: 'success',
    message: 'Your account and associated data have been permanently deleted.',
  });
};
