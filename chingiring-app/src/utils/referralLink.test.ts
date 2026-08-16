// Runnable check for the referral-link parser. No framework — run with:
//   node --experimental-strip-types src/utils/referralLink.test.ts
import { parseReferralCode } from './referralLink.ts';

let n = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error('FAIL:', m); process.exit(1); } };

ok(parseReferralCode('https://chingiringi.com/?ref=A1B2C3D4') === 'A1B2C3D4', 'basic ?ref=');
ok(parseReferralCode('https://chingiringi.com/app/home?foo=1&ref=abcd1234&x=2') === 'ABCD1234', 'mid-query + uppercased');
ok(parseReferralCode('chingiring://signup?ref=deadBEEF') === 'DEADBEEF', 'custom scheme deep link');
ok(parseReferralCode('https://chingiringi.com/?ref=a1b2%20c3') === 'A1B2C3', 'url-decoded + non-alnum stripped');
ok(parseReferralCode('https://x/?aref=nope&ref=YES1') === 'YES1', 'param boundary — aref= is not ref=');
ok(parseReferralCode('https://chingiringi.com/?ref=') === null, 'empty ref → null');
ok(parseReferralCode('https://chingiringi.com/?other=1') === null, 'no ref param → null');
ok(parseReferralCode('') === null, 'empty url → null');
ok(parseReferralCode(null) === null, 'null url → null');
ok(parseReferralCode(undefined) === null, 'undefined url → null');
ok(parseReferralCode('https://x/?ref=!!!') === null, 'all-junk ref → null');
ok(parseReferralCode('https://x/?ref=abcdefghijklmnopqrstuvwxyz') === 'ABCDEFGHIJKLMNOP', 'capped at 16 chars');

console.log(`referralLink.test: ${n} checks passed`);
