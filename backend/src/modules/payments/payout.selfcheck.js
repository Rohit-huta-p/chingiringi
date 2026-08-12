// Standalone self-check for the payout money-path branches.
//   run: node src/modules/payments/payout.selfcheck.js
// No DB needed — outcomeFromStatus is pure; importing the model only registers
// the mongoose schema, it does not connect.
import assert from 'node:assert/strict';
import { outcomeFromStatus } from './cashfreeService.js';

// Terminal status → outcome. A wrong branch here would mark a FAILED payout as
// paid (or refund a SUCCESS), so this is the branch most worth locking.
for (const s of ['SUCCESS', 'ACKNOWLEDGED', 'COMPLETED', 'TRANSFER_SUCCESS', 'transfer_success']) {
  assert.equal(outcomeFromStatus(s), 'paid', `${s} should map to paid`);
}
for (const s of ['FAILED', 'REJECTED', 'REVERSED', 'RETURNED', 'TRANSFER_FAILED']) {
  assert.equal(outcomeFromStatus(s), 'failed', `${s} should map to failed`);
}
for (const s of ['RECEIVED', 'PENDING', 'APPROVAL_PENDING', '', null, undefined]) {
  assert.equal(outcomeFromStatus(s), null, `${s} should be in-flight (null / no-op)`);
}

// Cap boundary — mirrors requestWithdrawal's instant decision. Instant only
// while today's instant total + this request stays within the cap.
const withinCap = (todayInstant, rupees, cap) => cap > 0 && todayInstant + rupees <= cap;
assert.equal(withinCap(0, 500, 500), true, 'exactly at cap → instant');
assert.equal(withinCap(1, 500, 500), false, 'over cap → admin queue');
assert.equal(withinCap(400, 100, 500), true, 'cumulative within cap → instant');
assert.equal(withinCap(0, 500, 0), false, 'cap 0 → never instant');

console.log('payout self-check: all assertions passed');
