'use strict';

const test = require('node:test');
const assert = require('node:assert');

const store = require('../src/data/store');
const { createCharge, listCharges } = require('../src/modules/charges/charges.service');

/**
 * Control is faked through the defaulted last parameter - see CONVENTIONS.md.
 * Nothing in production passes it.
 */
const fakeControl = {
  async createProviderOrder(provider, order) {
    const gateway = provider === 'MONARCA' || provider === 'EXTERNAL';
    return {
      providerOrderId: 'ord_test_1',
      paymentCode: gateway ? null : '123456',
      paymentLink: gateway ? 'https://checkout.test.pe/abc' : null,
      expiresAt: order.expiresAt,
    };
  },

  async getBillingConfig() {
    return {
      tenantId: 'tnt_sanmartin',
      commissionRate: 0.01,
      enabledPaymentMethods: ['CASHPOINT', 'PAGOYA', 'MONARCA'],
      limits: { maxOpenChargesPerCustomer: 3, maxChargeAmount: 20000 },
    };
  },
};

test.beforeEach(() => store.reset());

test('creates a service-rail charge with a payment code', async () => {
  const charge = await createCharge({
    tenantId: 'tnt_sanmartin',
    customerId: 'cus_002',
    amount: 1500,
    concept: 'Pension abril',
    paymentMethod: 'CASHPOINT',
  }, store, fakeControl);

  assert.equal(charge.status, 'PENDING');
  assert.equal(charge.amount, 1500);
  assert.match(charge.paymentCode, /^\d{6}$/);
  assert.equal(charge.paymentLink, null);
  assert.equal(charge.paidAt, null);
  assert.ok(charge.expiresAt);
});

test('gateway charges get a payment link instead of a code', async () => {
  const charge = await createCharge({
    tenantId: 'tnt_sanmartin',
    customerId: 'cus_002',
    amount: 2000,
    concept: 'Matricula',
    paymentMethod: 'MONARCA',
  }, store, fakeControl);

  assert.equal(charge.paymentCode, null);
  assert.match(charge.paymentLink, /^https:\/\//);
});

test('rejects a non-integer amount', async () => {
  await assert.rejects(
    () => createCharge({
      tenantId: 'tnt_sanmartin',
      customerId: 'cus_002',
      amount: 1500.5,
      concept: 'Pension abril',
      paymentMethod: 'CASHPOINT',
    }, store, fakeControl),
    /positive integer/,
  );
});

test('rejects a method the tenant does not have enabled', async () => {
  await assert.rejects(
    () => createCharge({
      tenantId: 'tnt_sanmartin',
      customerId: 'cus_002',
      amount: 1500,
      concept: 'Pension abril',
      paymentMethod: 'EXTERNAL',
    }, store, fakeControl),
    /not enabled/,
  );
});

test('rejects a customer that is over the open-charge limit', async () => {
  const input = {
    tenantId: 'tnt_sanmartin',
    customerId: 'cus_002',
    amount: 100,
    concept: 'Extra',
    paymentMethod: 'CASHPOINT',
  };
  await createCharge(input, store, fakeControl);
  await createCharge(input, store, fakeControl);

  await assert.rejects(() => createCharge(input, store, fakeControl), /limit is 3/);
});

test('lists only the charges of the given tenant', () => {
  const charges = listCharges({ tenantId: 'tnt_clinicavida' }, store);
  assert.equal(charges.length, 1);
  assert.equal(charges[0].tenantId, 'tnt_clinicavida');
});
