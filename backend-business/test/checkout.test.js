'use strict';

const test = require('node:test');
const assert = require('node:assert');

const store = require('../src/data/store');
const { createCharge, startCheckout, cancelCharge } = require('../src/modules/charges/charges.service');

let orderCounter = 0;
const voided = [];

const fakeControl = {
  async getBillingConfig() {
    return {
      tenantId: 'tnt_sanmartin',
      commissionRate: 0.01,
      enabledPaymentMethods: ['CASHPOINT', 'PAGOYA', 'MONARCA'],
      limits: { maxOpenChargesPerCustomer: 3, maxChargeAmount: 20000 },
    };
  },

  async createProviderOrder(provider, order) {
    orderCounter += 1;
    return {
      providerOrderId: `ord_test_${orderCounter}`,
      paymentLink: `https://checkout.test.pe/${orderCounter}`,
      expiresAt: order.expiresAt,
    };
  },

  async voidProviderOrder(provider, providerOrderId) {
    voided.push({ provider, providerOrderId });
    return { providerOrderId, status: 'VOIDED' };
  },
};

test.beforeEach(() => {
  store.reset();
  orderCounter = 0;
  voided.length = 0;
});

function newGatewayCharge() {
  return createCharge({
    tenantId: 'tnt_sanmartin',
    customerId: 'cus_002',
    amount: 2000,
    concept: 'Matricula',
    paymentMethod: 'MONARCA',
  }, store, fakeControl);
}

test('opening the payment link opens the order at the provider', async () => {
  const charge = await newGatewayCharge();
  const checkout = await startCheckout(charge.id, store, fakeControl);

  assert.equal(checkout.chargeId, charge.id);
  assert.equal(checkout.providerOrderId, 'ord_test_1');
  assert.match(checkout.redirectUrl, /^https:\/\//);
});

test('every pass through the link is its own order', async () => {
  const charge = await newGatewayCharge();
  const first = await startCheckout(charge.id, store, fakeControl);
  const second = await startCheckout(charge.id, store, fakeControl);

  assert.notEqual(first.providerOrderId, second.providerOrderId);
});

test('a cancelled charge cannot be checked out', async () => {
  const charge = await newGatewayCharge();
  await cancelCharge(charge.id, 'tnt_sanmartin', store, fakeControl);

  await assert.rejects(() => startCheckout(charge.id, store, fakeControl), /cancelled/);
});

test('cancelling a gateway charge has no order to void', async () => {
  const charge = await newGatewayCharge();
  await cancelCharge(charge.id, 'tnt_sanmartin', store, fakeControl);

  assert.deepEqual(voided, []);
});

test('a paid charge cannot be checked out', async () => {
  await assert.rejects(() => startCheckout('chg_1005', store, fakeControl), /already paid/);
});

test('a service charge is not paid through a checkout page', async () => {
  await assert.rejects(() => startCheckout('chg_1003', store, fakeControl), /not paid through a checkout page/);
});
