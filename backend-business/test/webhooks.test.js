'use strict';

const test = require('node:test');
const assert = require('node:assert');

const store = require('../src/data/store');
const {
  handleServiceNotification,
  handleGatewayNotification,
} = require('../src/modules/webhooks/inbound.service');

const serviceNote = (overrides) => ({
  provider: 'CASHPOINT',
  tenantId: 'tnt_sanmartin',
  paymentCode: '730915',
  status: 'PAID',
  ...overrides,
});

const gatewayNote = (overrides) => ({
  provider: 'MONARCA',
  tenantId: 'tnt_sanmartin',
  chargeId: 'chg_1005',
  transactionId: 'trx_mon_9001',
  status: 'APPROVED',
  ...overrides,
});

test.beforeEach(() => store.reset());

/* --------------------------------------------------------- service rail */

test('service: settles the charge behind a payment code', () => {
  const result = handleServiceNotification('CASHPOINT', serviceNote({
    paidAt: '2026-03-09T10:00:00.000Z',
  }), store);

  assert.equal(result.chargeStatus, 'PAID');
  assert.equal(store.findCharge('chg_1003').status, 'PAID');
});

test('service: a repeated notification does not settle twice', () => {
  handleServiceNotification('CASHPOINT', serviceNote(), store);
  const second = handleServiceNotification('CASHPOINT', serviceNote(), store);

  assert.equal(second.alreadySettled, true);
});

test('service: does not settle a payment code from another merchant', () => {
  assert.throws(
    () => handleServiceNotification('CASHPOINT', serviceNote({ tenantId: 'tnt_clinicavida' }), store),
    /No charge matches/,
  );
  assert.equal(store.findCharge('chg_1003').status, 'PENDING');
});

test('service: rejects a gateway provider', () => {
  assert.throws(
    () => handleServiceNotification('MONARCA', serviceNote({ provider: 'MONARCA' }), store),
    /not a service-rail provider/,
  );
});

/* --------------------------------------------------------- gateway rail */

test('gateway: an approved transaction settles the charge', () => {
  store.updateCharge('chg_1005', { status: 'PENDING', paidAt: null });

  const result = handleGatewayNotification('MONARCA', gatewayNote(), store);

  assert.equal(result.transactionStatus, 'APPROVED');
  assert.equal(result.chargeStatus, 'PAID');
  assert.equal(store.findTransaction('trx_mon_9001').status, 'APPROVED');
});

test('gateway: a declined transaction is recorded and the charge stays open', () => {
  store.updateCharge('chg_1005', { status: 'PENDING', paidAt: null });

  const result = handleGatewayNotification('MONARCA', gatewayNote({
    status: 'DECLINED',
    declineReason: 'insufficient_funds',
  }), store);

  assert.equal(result.transactionStatus, 'DECLINED');
  assert.equal(result.chargeStatus, 'PENDING');
  assert.equal(store.findTransaction('trx_mon_9001').declineReason, 'insufficient_funds');
});

test('gateway: several attempts can live under the same charge', () => {
  store.updateCharge('chg_1005', { status: 'PENDING', paidAt: null });

  handleGatewayNotification('MONARCA', gatewayNote({ transactionId: 'trx_a', status: 'DECLINED' }), store);
  handleGatewayNotification('MONARCA', gatewayNote({ transactionId: 'trx_b', status: 'APPROVED' }), store);

  const attempts = store.listTransactions({ chargeId: 'chg_1005' });
  assert.equal(attempts.length, 4);
  assert.equal(store.findCharge('chg_1005').status, 'PAID');
});

test('gateway: the same transaction reported twice is not recorded twice', () => {
  handleGatewayNotification('MONARCA', gatewayNote(), store);
  const second = handleGatewayNotification('MONARCA', gatewayNote(), store);

  assert.equal(second.alreadyProcessed, true);
  assert.equal(store.listTransactions({ chargeId: 'chg_1005' }).length, 3);
});

test('gateway: rejects a charge that belongs to another merchant', () => {
  assert.throws(
    () => handleGatewayNotification('MONARCA', gatewayNote({ tenantId: 'tnt_clinicavida' }), store),
    /No charge chg_1005 for this merchant/,
  );
});
