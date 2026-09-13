'use strict';

const test = require('node:test');
const assert = require('node:assert');

const store = require('../src/data/store');
const { cancelCharge } = require('../src/modules/charges/charges.service');
const { handleServiceNotification } = require('../src/modules/webhooks/inbound.service');

const voided = [];
const fakeControl = {
  async voidProviderOrder(provider, providerOrderId) {
    voided.push({ provider, providerOrderId });
    return { providerOrderId, status: 'VOIDED' };
  },
};

test.beforeEach(() => {
  store.reset();
  voided.length = 0;
});

test('cancelling voids the order the provider is holding', async () => {
  const charge = await cancelCharge('chg_1003', 'tnt_sanmartin', store, fakeControl);

  assert.equal(charge.status, 'CANCELLED');
  assert.ok(charge.cancelledAt);
  assert.deepEqual(voided, [{ provider: 'CASHPOINT', providerOrderId: 'ord_4023' }]);
});

test('cancelling keeps the payment code on the record', async () => {
  const charge = await cancelCharge('chg_1003', 'tnt_sanmartin', store, fakeControl);
  assert.equal(charge.paymentCode, '730915');
});

test('a paid charge cannot be cancelled', async () => {
  await assert.rejects(
    () => cancelCharge('chg_1001', 'tnt_sanmartin', store, fakeControl),
    /cannot be cancelled/,
  );
  assert.equal(store.findCharge('chg_1001').status, 'PAID');
});

test('cancelling twice is a no-op', async () => {
  await cancelCharge('chg_1003', 'tnt_sanmartin', store, fakeControl);
  await cancelCharge('chg_1003', 'tnt_sanmartin', store, fakeControl);
  assert.equal(voided.length, 1);
});

test('a charge of another merchant cannot be cancelled', async () => {
  await assert.rejects(
    () => cancelCharge('chg_1003', 'tnt_clinicavida', store, fakeControl),
    /No charge chg_1003 for this merchant/,
  );
});

test('a payment reported for a cancelled charge does not settle it', async () => {
  const charge = store.findCharge('chg_1003');
  const code = charge.paymentCode;
  await cancelCharge('chg_1003', 'tnt_sanmartin', store, fakeControl);

  const result = handleServiceNotification('CASHPOINT', {
    provider: 'CASHPOINT',
    tenantId: 'tnt_sanmartin',
    paymentCode: code,
    status: 'PAID',
  }, store);

  assert.equal(result.chargeStatus, 'CANCELLED');
  assert.equal(result.anomaly, 'payment_reported_for_cancelled_charge');
});
