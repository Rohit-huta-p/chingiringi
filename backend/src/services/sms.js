// Transactional SMS via MSG91 (India). Used to deliver phone-login OTPs.
//
// IMPORTANT: we still generate, hash, store, rate-limit and VERIFY the OTP
// ourselves (see authService.generateAndStoreOTP / verifyUserOTP). MSG91 is a
// pure transport here — the Flow API sends a DLT-approved template with our OTP
// injected as a template variable. This keeps the existing security model
// (hash-at-rest, 3-attempt cap, 5-min TTL) untouched and mirrors email.js.
//
// Configure with (MSG91 panel → Settings → API):
//   MSG91_AUTH_KEY            — your Auth Key (required)
//   MSG91_OTP_TEMPLATE_ID     — a DLT-approved Flow template that has ONE
//                               variable for the code (required)
//   MSG91_OTP_VAR             — the template's variable NAME for the code
//                               (default 'otp'; use 'var1' if your template
//                               uses positional variables — see notes below)
//   MSG91_SENDER_ID           — 6-char DLT header/sender id (optional; the
//                               template is usually already bound to a sender)
//   MSG91_DEFAULT_COUNTRY_CODE— prefixed to bare 10-digit numbers (default '91')
//   MSG91_BASE_URL            — override the API host (default control.msg91.com)
//
// Finding the right MSG91_OTP_VAR: open the Flow/template in the MSG91 panel.
// If the body reads "##otp## is your code", the variable is named `otp`. If the
// panel shows generic variables (VAR1, VAR2…), set MSG91_OTP_VAR=var1.

const BASE_URL = process.env.MSG91_BASE_URL || 'https://control.msg91.com';

export function isSmsConfigured() {
  return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_OTP_TEMPLATE_ID);
}

// MSG91 wants a country-coded number with NO '+' (e.g. 919876543210). We only
// normalize for the API call — the value we store/verify OTPs against is left
// exactly as the client sent it, so the verify lookup still matches.
export function normalizeMobile(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const cc = (process.env.MSG91_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '');
  if (digits.length === 10) return `${cc}${digits}`;                 // bare 10-digit → prepend CC
  if (digits.length === 11 && digits.startsWith('0')) return `${cc}${digits.slice(1)}`; // leading 0
  if (digits.startsWith(cc) && digits.length === cc.length + 10) return digits;         // already CC'd
  return digits; // pass through; MSG91 will reject a truly-invalid number
}

// Send a single OTP SMS. Throws on any delivery failure (caller decides the
// HTTP status). MSG91 replies 200 with { type: 'success' | 'error' }, so a 200
// with type:'error' is still a failure and is treated as one.
export async function sendOtpSms(phone, otp) {
  if (!isSmsConfigured()) {
    throw new Error('SMS not configured (set MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID).');
  }

  const mobiles = normalizeMobile(phone);
  if (!mobiles) throw new Error('Invalid mobile number');

  const varName = process.env.MSG91_OTP_VAR || 'otp';
  const body = {
    template_id: process.env.MSG91_OTP_TEMPLATE_ID,
    short_url: '0',
    recipients: [{ mobiles, [varName]: String(otp) }],
  };
  if (process.env.MSG91_SENDER_ID) body.sender = process.env.MSG91_SENDER_ID;

  const res = await fetch(`${BASE_URL}/api/v5/flow/`, {
    method: 'POST',
    headers: {
      authkey: process.env.MSG91_AUTH_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  let data = null;
  try { data = await res.json(); } catch (_) { /* non-JSON body */ }

  if (!res.ok || (data?.type && data.type !== 'success')) {
    const detail = data ? JSON.stringify(data) : res.statusText;
    throw new Error(`MSG91 ${res.status}: ${detail}`);
  }
  return data ?? { ok: true };
}

// Diagnostic — no SMS sent. Confirms config is present. (MSG91 has no cheap
// no-op verify endpoint, so this only checks that the keys are set.)
export function verifySms() {
  if (!isSmsConfigured()) {
    return { ok: false, error: 'MSG91 not configured (need MSG91_AUTH_KEY + MSG91_OTP_TEMPLATE_ID)' };
  }
  return { ok: true, transport: 'msg91', template: process.env.MSG91_OTP_TEMPLATE_ID };
}
