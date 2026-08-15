// Transactional email — two transports, picked by which env is set:
//   • SMTP (nodemailer) — used when SMTP_HOST/USER/PASS are set. Good for LOCAL
//     dev and any host that allows outbound SMTP. Sends from your own mailbox
//     (e.g. contact@pratdevix.com via Hostinger). SMTP wins when configured.
//   • Resend (HTTP API) — the production path on Render, whose free tier blocks
//     outbound SMTP ports. Set RESEND_API_KEY (+ MAIL_FROM on a verified domain).
// Do NOT set SMTP_* on Render — it would try SMTP and time out. Leave it Resend.

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function isEmailConfigured() {
  return smtpConfigured() || Boolean(process.env.RESEND_API_KEY);
}

// Lazily-built, cached SMTP transporter (nodemailer is only imported when used).
let _smtp = null;
async function smtpTransport() {
  if (_smtp) return _smtp;
  const nodemailer = (await import('nodemailer')).default;
  const port = Number(process.env.SMTP_PORT) || 587;
  _smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // implicit TLS on 465; STARTTLS negotiated on 587
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return _smtp;
}

export async function sendMail({ to, subject, text, html }) {
  // SMTP first (local dev / real-domain sending); Resend as the fallback (prod).
  if (smtpConfigured()) {
    const from = process.env.MAIL_FROM || `Chingiringi <${process.env.SMTP_USER}>`;
    const tx = await smtpTransport();
    return tx.sendMail({ from, to, subject, text, html });
  }

  if (process.env.RESEND_API_KEY) {
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

  throw new Error('Email not configured (set SMTP_HOST/USER/PASS for local, or RESEND_API_KEY for production).');
}

// Diagnostic — no email sent. SMTP does a real connection/auth check (verify());
// Resend confirms the API key against the domains endpoint.
export async function verifyEmail() {
  if (smtpConfigured()) {
    try {
      const tx = await smtpTransport();
      await tx.verify();
      return { ok: true, transport: 'smtp' };
    } catch (err) {
      return { ok: false, transport: 'smtp', error: err.message };
    }
  }
  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'No email transport configured' };
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (res.ok) return { ok: true, transport: 'resend' };
    let detail = '';
    try { detail = await res.text(); } catch (_) { /* ignore */ }
    return { ok: false, transport: 'resend', error: `Resend ${res.status}`, detail };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
