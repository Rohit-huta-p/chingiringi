# Sending Emails (Chingiringi)

How transactional email works in this project. Reuse this whenever you add an
email (signup/login OTP, verification, notifications, password reset, etc.).

## TL;DR

- All transactional email goes through **Resend** (HTTP API) — **not SMTP**.
- **Why not SMTP:** Render's free tier **blocks outbound SMTP ports** (25 / 465 / 587)
  since Sept 2025. Any SMTP host (Hostinger, GoDaddy, Gmail…) just times out
  (`ETIMEDOUT`). HTTP APIs go over port 443, which isn't blocked.
- Sender: **`support@chingiringi.com`** (domain `chingiringi.com`, verified in Resend).
- One helper does it all: `backend/src/services/email.js` → `sendMail(...)`.

## Environment variables (Render → backend service → Environment)

| Var | Value | Notes |
|-----|-------|-------|
| `RESEND_API_KEY` | `re_…` from Resend | **Secret. Never commit it.** Set only in Render. |
| `MAIL_FROM` | `Chingiringi <support@chingiringi.com>` | Must be an address on a **verified** Resend domain. |

Without `RESEND_API_KEY`, `isEmailConfigured()` is false and senders return a
clean error (HTTP 503) instead of hanging — nothing sends, nothing breaks.

## How to send an email (in code)

```js
import { sendMail } from '../../services/email.js';

await sendMail({
  to: 'user@example.com',
  subject: 'Your Chingiringi code',
  text: 'Your code is 123456. It expires in 5 minutes.',
  // html: '<p>…</p>',   // optional
});
```

`sendMail` throws on failure — wrap it in try/catch and respond gracefully
(see `deleteAccountRequest` in `backend/src/modules/legal/legalController.js`).

## One-time Resend setup (also: creating a new environment / new domain)

1. **Sign up** at <https://resend.com> (free — 3,000 emails/mo, 100/day, 1 domain).
2. **Verify the domain.** Resend → *Domains → Add* `chingiringi.com`. It shows a
   few DNS records (a DKIM key + a `send.` subdomain).
   - `chingiringi.com` DNS is at **GoDaddy** (nameservers `*.domaincontrol.com`).
     Add Resend's records there.
   - The existing root SPF is `v=spf1 include:secureserver.net -all` (GoDaddy email).
     Resend uses a `send.` **subdomain**, so it does **not** clash — just add
     exactly what Resend lists. Wait until Resend shows **Verified**.
3. **Create an API key** (Resend → *API Keys*). Copy it once.
4. In Render (backend service) set `RESEND_API_KEY` and
   `MAIL_FROM=Chingiringi <support@chingiringi.com>`. Render redeploys on save.

## Gotchas (read before debugging)

- **Never use nodemailer / SMTP on Render.** It will `ETIMEDOUT`. Use Resend.
- **Domain must be verified** to email real users from `@chingiringi.com`. Until
  then Resend only delivers to **your own Resend account email** via the default
  `onboarding@resend.dev` sender (leave `MAIL_FROM` unset to use it for a quick test).
- **Receiving** at `support@chingiringi.com` is separate — that's GoDaddy email
  (`MX → secureserver.net`). Make sure the mailbox exists so replies/grievances land.
- **API key is a secret.** Env var only, never in git. If it's ever pasted in
  chat / a screenshot / a commit, rotate it in Resend.
- Free tier caps: 100/day, 3,000/mo, 1 domain — ample for OTP-style mail.

## Current usage — account deletion

- `POST /delete-account/request { email }` → `generateAndStoreOTP` + `sendMail`
  (6-digit code, 5-min expiry). Only sends if the account exists; response is
  neutral either way (no account enumeration).
- `POST /delete-account/confirm { email, otp }` → verify code → `deleteUserAndData`.
- Page: `https://chingiringi.com/delete-account/` (source:
  `chingiring-app/public/delete-account/index.html`, mirrored as `delete-account.html`).
- **Temporary diagnostic:** `GET /delete-account/smtp-check` → `{"ok":true}` when
  the Resend key is valid. **Remove this route before public launch**
  (`legalRoutes.js` + `deleteAccountSmtpCheck` in `legalController.js`).

## Testing

```bash
# Is the Resend key wired correctly? (expects {"configured":true,"ok":true})
curl -s https://chingiringi-backend.onrender.com/delete-account/smtp-check

# End-to-end: run the flow on the page, or:
curl -sX POST https://chingiringi-backend.onrender.com/delete-account/request \
  -H 'Content-Type: application/json' -d '{"email":"you@example.com"}'
```

Before the domain is verified, test with the **email you registered on Resend**
(the only address `onboarding@resend.dev` can reach).

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `ETIMEDOUT` connecting to an SMTP host | Render blocks SMTP — that's why we use Resend. Not fixable; use the HTTP API. |
| Page stuck on "Sending…" | Old SMTP hang (fixed with timeouts). If it recurs, the backend request isn't returning — check `RESEND_API_KEY` is set and the endpoint responds. |
| Resend `403` / "from address not allowed" | Domain not verified, or `MAIL_FROM` uses an unverified address. Verify `chingiringi.com` or fall back to `onboarding@resend.dev`. |
| Resend `401` | Bad or missing `RESEND_API_KEY`. |
| Code never arrives (but API returns success) | Domain unverified (real users can't receive), or the mail is in spam — confirm SPF/DKIM are verified in Resend. |

## Files

- `backend/src/services/email.js` — `sendMail`, `isEmailConfigured`, `verifyEmail`.
- `backend/src/modules/legal/legalController.js` — deletion request/confirm handlers.
- `backend/src/modules/auth/authService.js` — `generateAndStoreOTP` / `verifyUserOTP` (OTP store + check).
