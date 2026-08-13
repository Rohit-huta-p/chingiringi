// Model of the withdrawal coin invariant across request + admin transitions.
//   run: node src/modules/wallet/withdrawal.selfcheck.js
//
// Rules (mirrors requestWithdrawal + updateWithdrawal):
//   request  → hold: debit coins, coinsHeld=true
//   complete → if !held: debit + held=true;  if held: no-op (already paid for)
//   reject   → if held: refund + held=false;  if !held: no-op
//   pending/processing → no coin change
// Invariants: no double debit / double refund; a rejected withdrawal returns
// the exact coins; a completed one has debited exactly once.
import assert from 'node:assert/strict';

const COINS = 100;
function run(events) {
  let balance = 1000, held = false;
  for (const ev of events) {
    if (ev === 'request') { assert.ok(balance >= COINS, 'over-withdraw blocked'); balance -= COINS; held = true; }
    else if (ev === 'complete') { if (!held) { balance -= COINS; held = true; } }
    else if (ev === 'reject')   { if (held)  { balance += COINS; held = false; } }
    // 'pending' | 'processing' → no coin change
  }
  return { balance, held };
}

// Happy path: request holds, complete keeps it debited (paid).
assert.equal(run(['request']).balance, 900, 'request holds coins');
assert.equal(run(['request', 'complete']).balance, 900, 'complete does not double-debit a held withdrawal');

// Reject refunds exactly once.
assert.equal(run(['request', 'reject']).balance, 1000, 'reject refunds the hold');
assert.equal(run(['request', 'reject', 'reject']).balance, 1000, 'second reject cannot double-refund');

// Revert a rejected one, then complete → debits once at completion.
assert.equal(run(['request', 'reject', 'pending', 'complete']).balance, 900, 'reject→pending→complete debits exactly once');

// Status churn among non-terminal states never moves coins.
assert.equal(run(['request', 'processing', 'pending', 'processing']).balance, 900, 'pending/processing churn is coin-neutral');

// Legacy pre-hold withdrawal (no hold at request) debits on complete.
assert.equal(run(['complete']).balance, 900, 'legacy unheld withdrawal debits on complete');
assert.equal(run(['reject']).balance, 1000, 'legacy unheld reject is a no-op');

console.log('withdrawal self-check: all invariants hold');
