import { Linking } from 'react-native';

// Best-effort "open the inbox" for common providers; falls back to the OS mail
// app via mailto:. Shared by the auth modals and the email-verify sheet.
const MAIL_INBOX: Record<string, string> = {
  'gmail.com': 'https://mail.google.com/mail/u/0/#inbox',
  'googlemail.com': 'https://mail.google.com/mail/u/0/#inbox',
  'outlook.com': 'https://outlook.live.com/mail/0/inbox',
  'hotmail.com': 'https://outlook.live.com/mail/0/inbox',
  'live.com': 'https://outlook.live.com/mail/0/inbox',
  'yahoo.com': 'https://mail.yahoo.com/',
  'icloud.com': 'https://www.icloud.com/mail',
  'proton.me': 'https://mail.proton.me/u/0/inbox',
  'protonmail.com': 'https://mail.proton.me/u/0/inbox',
};

export function openMailInbox(email?: string) {
  const domain = (email?.split('@')[1] || '').toLowerCase();
  Linking.openURL(MAIL_INBOX[domain] || 'mailto:').catch(() => {});
}
