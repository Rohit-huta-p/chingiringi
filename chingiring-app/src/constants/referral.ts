// Referee sign-up reward shown to a logged-out guest who arrived via a referral
// link. Hardcoded per design (guests can't call the auth'd stats endpoint).
// Keep in sync with AdminSettings.coinsPerReferralReferee: 5000 coins ÷
// coinsPerRupee 1000 = ₹5.
export const REFEREE_REWARD_LABEL = '₹5';
