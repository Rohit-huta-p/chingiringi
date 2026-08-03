// ── About page content ────────────────────────────────────────────────────────
// Static marketing copy + palette for the About screens (desktop + mobile).
// Both AboutScreen.tsx and MobileAboutScreen.tsx read from here so the two
// form factors never drift apart. Figma: 518:4430 (desktop) / 403:2984 (mobile).

export const ABOUT_TAGLINE = "India's #1 cashback & deals platform";

export const ABOUT_MISSION =
  'To empower every Indian to earn passive income on their everyday purchases — turning shopping into a wealth-building habit, one cashback at a time.';

export interface AboutStat {
  emoji: string;
  value: string;
  label: string;
  iconBg: string;
}

export const ABOUT_STATS: AboutStat[] = [
  { emoji: '👥', value: '2.4M+',  label: 'Active Users',   iconBg: 'rgba(71,132,226,0.08)' },
  { emoji: '🏪', value: '850+',   label: 'Partner Stores', iconBg: 'rgba(124,58,237,0.08)' },
  { emoji: '💰', value: '₹48Cr+', label: 'Cashback Paid',  iconBg: 'rgba(5,150,105,0.08)' },
  { emoji: '⭐', value: '4.8★',   label: 'App Rating',     iconBg: 'rgba(217,119,6,0.08)' },
];

export interface AboutValue {
  emoji: string;
  title: string;
  desc: string;
  iconBg: string;
}

export const ABOUT_VALUES: AboutValue[] = [
  { emoji: '⚡', title: 'Fast Payouts',   desc: 'Instant withdrawals to your bank or UPI within 24 hours.', iconBg: 'rgba(71,132,226,0.08)' },
  { emoji: '🔒', title: '100% Secure',    desc: 'Bank-grade encryption keeps your money and data safe.',    iconBg: 'rgba(5,150,105,0.08)' },
  { emoji: '❤️', title: 'User First',     desc: 'Every feature is designed with our community in mind.',     iconBg: 'rgba(225,29,72,0.08)' },
  { emoji: '✅', title: 'Verified Deals', desc: 'Every deal is manually verified before it goes live.',      iconBg: 'rgba(217,119,6,0.08)' },
];

export interface AboutMilestone {
  year: string;
  text: string;
}

export const ABOUT_TIMELINE: AboutMilestone[] = [
  { year: '2019', text: 'ChingiRingi founded with a vision to democratize savings for every Indian household.' },
  { year: '2021', text: 'Crossed 1 million active users and launched the referral rewards ecosystem.' },
  { year: '2022', text: 'Introduced the Coins loyalty system and partnered with 500+ top brands.' },
  { year: '2023', text: 'Reached ₹25 Crore in total cashback paid and expanded to 850+ partner stores.' },
  { year: '2024', text: 'Launched the mobile-first app with instant UPI withdrawal & admin panel.' },
];

export const ABOUT_TEAM_QUOTE =
  '"We started ChingiRingi because we believed every Indian deserves to keep more of their hard-earned money. Today, our 200+ person team works every day to make that vision a reality for millions of users."';

export const ABOUT_TEAM_ATTRIB = '— The ChingiRingi Team, Bengaluru 🇮🇳';

// ── Palette ────────────────────────────────────────────────────────────────
// Shades that only the About page uses. Brand blue / muted greys already live
// in theme.ts (Colors), but the About design leans on a few extra slate tones.
export const AboutColors = {
  pageBg:        '#F0F4F8',
  cardBorder:    '#F0F2F7',
  missionBorder: '#E8F0FE',
  eyebrowBlue:   '#4784E2',
  eyebrowMuted:  '#94A3B8',
  heading:       '#0F172A',
  missionText:   '#1E293B',
  statLabel:     '#94A3B8',
  valueDesc:     '#64748B',
  timelineText:  '#475569',
  teamEyebrow:   '#93C5FD',
  teamQuote:     '#E2E8F0',
  teamAttrib:    '#64748B',
};

// 3-stop brand hero gradient — mirrors the mobile header used across the app.
// linear-gradient(135deg, #1E3A8A 0%, #4784E2 60%, #91BDFF 100%).
export const ABOUT_HERO_GRADIENT: readonly [string, string, string] = ['#1E3A8A', '#4784E2', '#91BDFF'];
export const ABOUT_HERO_LOCATIONS: readonly [number, number, number] = [0, 0.6, 1];

// Timeline rail + "From Our Team" card gradients.
export const ABOUT_TIMELINE_GRADIENT: readonly [string, string] = ['#4784E2', '#91BDFF'];
export const ABOUT_TEAM_GRADIENT: readonly [string, string] = ['#0F172A', '#1E293B'];
