// Transactional email via Resend's HTTP API. Render's free tier blocks outbound
// SMTP, so we send over HTTPS instead of nodemailer/SMTP.
//   Env: RESEND_API_KEY (required)
//        MAIL_FROM       a verified-domain sender, e.g. "Chingiringi <contact@pratdevix.com>"
// Until pratdevix.com is verified in Resend, sending only works to the account
// owner's address via the default onboarding@resend.dev sender.

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail({ to, subject, text, html }) {
  if (!isEmailConfigured()) throw new Error('Email not configured (set RESEND_API_KEY).');
  const from = process.env.MAIL_FROM || 'Chingiringi <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch (_) { detail = res.statusText; }
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
  return res.json();
}

// Lightweight config check for the diagnostic endpoint — confirms Resend accepts
// the API key (no email sent).
export async function verifyEmail() {
  if (!isEmailConfigured()) return { ok: false, error: 'RESEND_API_KEY not set' };
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (res.ok) return { ok: true };
    let detail = '';
    try { detail = await res.text(); } catch (_) { /* ignore */ }
    return { ok: false, error: `Resend ${res.status}`, detail };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
