// Link-preview crawlers fetch a shared URL before any human clicks. Without
// this, every share auto-confirms from the preview bot.
const BOT_RE = /facebookexternalhit|whatsapp|telegrambot|twitterbot|slackbot|linkedinbot|discordbot|bot|crawler|spider|preview|curl|wget|python-requests|headless/i;

export function isLikelyBot(ua) {
  if (!ua || !ua.trim()) return true; // no UA → not a real browser open
  return BOT_RE.test(ua);
}

// Pure decision — no I/O. The DB confirm is guarded separately (atomic update).
export function evaluateShareConfirm({ status, sharerIp, visitorIp, visitorUa, ageSeconds, minAgeSeconds = 15 }) {
  if (status === 'confirmed') return { confirm: false, reason: 'already_confirmed' };
  if (status === 'expired')   return { confirm: false, reason: 'expired' };
  if (status !== 'pending')   return { confirm: false, reason: 'not_found' };
  if (isLikelyBot(visitorUa)) return { confirm: false, reason: 'bot' };
  if (!visitorIp)             return { confirm: false, reason: 'no_visitor_ip' };
  if (visitorIp === sharerIp) return { confirm: false, reason: 'self_ip' };
  if (ageSeconds < minAgeSeconds) return { confirm: false, reason: 'too_soon' };
  return { confirm: true, reason: 'ok' };
}
