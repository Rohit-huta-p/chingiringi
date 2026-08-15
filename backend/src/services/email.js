import nodemailer from 'nodemailer';

// SMTP email sender. Configured entirely via env so no provider is hard-coded:
//   SMTP_HOST, SMTP_PORT (587 STARTTLS / 465 TLS), SMTP_USER, SMTP_PASS, MAIL_FROM
// Works with the pratdevix.com mailbox or any SMTP (SendGrid/Resend/Mailgun SMTP).
let transporter = null;

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isEmailConfigured()) {
    throw new Error('Email not configured (set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).');
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587/25 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Fail fast instead of hanging forever if the SMTP host can't be reached
    // (otherwise the delete-account request blocks and the UI sticks on "Sending…").
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  return getTransporter().sendMail({ from, to, subject, text, html });
}

// Tests the SMTP connection/credentials without sending. Used by the temporary
// /delete-account/smtp-check diagnostic to surface the exact failure reason.
export async function verifyEmail() {
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message, code: err.code };
  }
}
