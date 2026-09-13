'use strict';

const defaultStore = require('../../data/store');
const { AppError } = require('../../http-utils');
const { SERVICE_METHODS, GATEWAY_METHODS } = require('../../catalog/payment-methods');
const outbound = require('./outbound.service');

/**
 * Provider notifications, forwarded by the control plane.
 *
 * The two rails report different things, so they have different contracts.
 * See docs/payment-rails.md.
 */

function settle(charge, paidAt, store) {
  store.updateCharge(charge.id, { status: 'PAID', paidAt });
  outbound.enqueue({
    type: 'charge.paid',
    tenantId: charge.tenantId,
    payload: { chargeId: charge.id, amount: charge.amount },
  });
}

/* ------------------------------------------------------------- service rail */

/**
 * The service rail reports at charge level: the customer typed a payment code
 * into their banking app and the provider settled it. There is nothing below
 * the charge to record.
 *
 *   { provider, tenantId, paymentCode, status, paidAt, amount }
 *
 * Payment codes are six digits and only unique within a merchant, so the
 * lookup is scoped by tenantId.
 */
function handleServiceNotification(provider, notification, store = defaultStore) {
  if (!SERVICE_METHODS.includes(provider)) {
    throw new AppError('wrong_rail', `${provider} is not a service-rail provider`, 400);
  }
  if (!notification.tenantId) throw new AppError('tenant_required', 'tenantId is required', 400);

  const charge = store
    .listCharges({ tenantId: notification.tenantId })
    .find((candidate) => candidate.paymentCode === notification.paymentCode);

  if (!charge) {
    throw new AppError('charge_not_found', `No charge matches payment code ${notification.paymentCode}`, 404);
  }

  if (charge.status === 'PAID') {
    return { chargeId: charge.id, chargeStatus: charge.status, alreadySettled: true };
  }

  settle(charge, notification.paidAt || new Date().toISOString(), store);
  return { chargeId: charge.id, chargeStatus: 'PAID', alreadySettled: false };
}

/* ------------------------------------------------------------- gateway rail */

/**
 * The gateway rail reports at transaction level. A customer can try to pay the
 * same charge several times - a declined card, a closed tab, a retry - and
 * each attempt is its own transaction with its own outcome. The charge is only
 * settled by an approved one.
 *
 *   { provider, tenantId, chargeId, transactionId, status, declineReason,
 *     amount, processedAt }
 *
 * `status` is APPROVED or DECLINED.
 */
function handleGatewayNotification(provider, notification, store = defaultStore) {
  if (!GATEWAY_METHODS.includes(provider)) {
    throw new AppError('wrong_rail', `${provider} is not a gateway provider`, 400);
  }
  if (!notification.tenantId) throw new AppError('tenant_required', 'tenantId is required', 400);
  if (!notification.transactionId) throw new AppError('transaction_required', 'transactionId is required', 400);

  const charge = store.findCharge(notification.chargeId);
  if (!charge || charge.tenantId !== notification.tenantId) {
    throw new AppError('charge_not_found', `No charge ${notification.chargeId} for this merchant`, 404);
  }

  // The same attempt can be reported more than once.
  const existing = store.findTransaction(notification.transactionId);
  if (existing) {
    return {
      chargeId: charge.id,
      transactionId: existing.id,
      transactionStatus: existing.status,
      chargeStatus: charge.status,
      alreadyProcessed: true,
    };
  }

  const status = notification.status === 'APPROVED' ? 'APPROVED' : 'DECLINED';
  const processedAt = notification.processedAt || new Date().toISOString();

  store.insertTransaction({
    id: notification.transactionId,
    tenantId: charge.tenantId,
    chargeId: charge.id,
    provider,
    status,
    declineReason: status === 'DECLINED' ? notification.declineReason || null : null,
    amount: notification.amount ?? charge.amount,
    processedAt,
  });

  if (status === 'APPROVED' && charge.status !== 'PAID') {
    settle(charge, processedAt, store);
  }

  return {
    chargeId: charge.id,
    transactionId: notification.transactionId,
    transactionStatus: status,
    chargeStatus: store.findCharge(charge.id).status,
    alreadyProcessed: false,
  };
}

module.exports = { handleServiceNotification, handleGatewayNotification };
