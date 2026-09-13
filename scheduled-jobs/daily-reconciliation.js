'use strict';

const defaultStore = require('../backend-business/src/data/store');

/**
 * Daily reconciliation.
 *
 * We only learn that a charge was paid when a provider tells us. Notifications
 * get lost: the provider times out, we redeploy mid-request, a network blip
 * eats it. This job asks the provider what it settled on a given day and
 * closes whatever our side missed.
 *
 * IDEMPOTENCY
 * -----------
 * This job can be triggered more than once for the same day. The scheduler
 * retries on timeout, and support re-runs it by hand while looking into a
 * complaint. Every scheduled process here keys its work and skips what it has
 * already done, so a second run is a no-op.
 *
 * We move money. Doing the same thing twice is the one mistake we cannot
 * take back.
 */

const completedRuns = new Set();

function runKey(jobName, period) {
  return `${jobName}:${period}`;
}

/** Stand-in for the provider's settlement report. */
async function fetchSettledPayments(date) {
  const report = {
    '2026-03-10': [{ paymentCode: '730915', paidAt: '2026-03-10T10:31:00.000Z' }],
  };
  return report[date] || [];
}

async function runDailyReconciliation(
  date = new Date().toISOString().slice(0, 10),
  store = defaultStore,
  fetchSettled = fetchSettledPayments,
) {
  const key = runKey('daily-reconciliation', date);
  if (completedRuns.has(key)) {
    return { date, skipped: true, reason: 'already ran for this date', settled: 0 };
  }

  const settled = await fetchSettled(date);
  let closed = 0;

  for (const payment of settled) {
    const charge = store
      .listCharges({ status: 'PENDING' })
      .find((candidate) => candidate.paymentCode === payment.paymentCode);

    if (!charge) continue;
    store.updateCharge(charge.id, { status: 'PAID', paidAt: payment.paidAt });
    closed += 1;
  }

  completedRuns.add(key);
  return { date, skipped: false, settled: settled.length, closed };
}

module.exports = { runDailyReconciliation, runKey };

if (require.main === module) {
  const date = process.argv[2];
  runDailyReconciliation(date).then((result) => {
    console.log('[daily-reconciliation]', result);
  });
}
