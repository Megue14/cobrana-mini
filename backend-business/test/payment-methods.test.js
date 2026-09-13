'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  isKnownMethod,
  isGatewayMethod,
  chargesCommission,
  commissionableMethods,
} = require('../src/catalog/payment-methods');

test('recognises the methods in the catalog', () => {
  assert.equal(isKnownMethod('CASHPOINT'), true);
  assert.equal(isKnownMethod('MONARCA'), true);
  assert.equal(isKnownMethod('SOMETHING_ELSE'), false);
});

test('EXTERNAL runs on the gateway rail', () => {
  assert.equal(isGatewayMethod('EXTERNAL'), true);
  assert.equal(isGatewayMethod('CASHPOINT'), false);
});

test('EXTERNAL is a gateway but carries no commission', () => {
  assert.equal(isGatewayMethod('EXTERNAL'), true);
  assert.equal(chargesCommission('EXTERNAL'), false);
  assert.equal(chargesCommission('MONARCA'), true);
});

test('commissionable methods exclude pass-through ones', () => {
  assert.deepEqual(commissionableMethods().sort(), ['CASHPOINT', 'MONARCA', 'PAGOYA']);
});
