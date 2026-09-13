'use strict';

/**
 * Provider registry.
 *
 * Providers on the same rail post the same body, whatever their own API looks
 * like. Agreeing on the shape is part of onboarding a provider, so there is no
 * per-provider parsing in our code - but the two rails report different things
 * and so they have different contracts.
 *
 * SERVICE - reported at charge level:
 *
 *   { provider, tenantId, paymentCode, status, paidAt, amount }
 *
 * GATEWAY - reported at transaction level, because one charge can collect
 * several attempts:
 *
 *   { provider, tenantId, chargeId, transactionId, status, declineReason,
 *     amount, processedAt }
 */

const providers = {
  CASHPOINT: { code: 'CASHPOINT', name: 'Cashpoint', rail: 'SERVICE' },
  PAGOYA: { code: 'PAGOYA', name: 'Pagoya', rail: 'SERVICE' },
  MONARCA: { code: 'MONARCA', name: 'Monarca', rail: 'GATEWAY' },
  EXTERNAL: { code: 'EXTERNAL', name: 'Own gateway', rail: 'GATEWAY' },
};

function getProvider(code) {
  return providers[code] || null;
}

function normalizeService(code, body) {
  return {
    provider: code,
    tenantId: body.tenantId,
    paymentCode: body.paymentCode,
    status: body.status || 'PAID',
    paidAt: body.paidAt || new Date().toISOString(),
    amount: body.amount ?? null,
  };
}

function normalizeGateway(code, body) {
  return {
    provider: code,
    tenantId: body.tenantId,
    chargeId: body.chargeId,
    transactionId: body.transactionId,
    status: body.status,
    declineReason: body.declineReason || null,
    amount: body.amount ?? null,
    processedAt: body.processedAt || new Date().toISOString(),
  };
}

/** Missing fields, by rail. Empty means the body is usable. */
function missingFields(rail, body) {
  const required = rail === 'SERVICE'
    ? ['tenantId', 'paymentCode']
    : ['tenantId', 'chargeId', 'transactionId', 'status'];
  return required.filter((field) => !body[field]);
}

module.exports = { getProvider, normalizeService, normalizeGateway, missingFields, providers };
