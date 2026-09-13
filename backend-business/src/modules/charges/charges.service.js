'use strict';

const defaultStore = require('../../data/store');
const defaultControl = require('../../clients/control.client');
const { AppError } = require('../../http-utils');
const { isKnownMethod, chargesCommission } = require('../../catalog/payment-methods');
const whatsapp = require('../messaging/whatsapp.service');

/**
 * Charge creation. See docs/payment-rails.md for what happens after this.
 */

let sequence = 9000;

function nextChargeId() {
  sequence += 1;
  return `chg_${sequence}`;
}

const DEFAULT_EXPIRY_DAYS = 30;

function expiryFor(dueDate) {
  if (dueDate) return `${dueDate}T23:59:59.000Z`;
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_EXPIRY_DAYS);
  return date.toISOString();
}

function listCharges(filters, store = defaultStore) {
  if (!filters.tenantId) {
    throw new AppError('tenant_required', 'tenantId is required', 400);
  }
  return store.listCharges(filters);
}

async function createCharge(input, store = defaultStore, control = defaultControl) {
  const { tenantId, customerId, amount, concept, paymentMethod, dueDate } = input;
  const notifyByWhatsapp = input.notifyByWhatsapp !== false;

  if (!tenantId) throw new AppError('tenant_required', 'tenantId is required', 400);
  if (!customerId) throw new AppError('customer_required', 'customerId is required', 400);
  if (!concept) throw new AppError('concept_required', 'concept is required', 400);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError('invalid_amount', 'amount must be a positive integer in PEN', 400);
  }
  if (!isKnownMethod(paymentMethod)) {
    throw new AppError('unknown_payment_method', `Unknown payment method ${paymentMethod}`, 400);
  }

  const customer = store.findCustomer(customerId);
  if (!customer || customer.tenantId !== tenantId) {
    throw new AppError('customer_not_found', `Unknown customer ${customerId}`, 404);
  }

  // Commercial rules live in control, not here.
  const config = await control.getBillingConfig(tenantId);

  if (!config.enabledPaymentMethods.includes(paymentMethod)) {
    throw new AppError('method_not_enabled', `${paymentMethod} is not enabled for this tenant`, 400);
  }
  if (amount > config.limits.maxChargeAmount) {
    throw new AppError('amount_over_limit', `amount exceeds the tenant limit of ${config.limits.maxChargeAmount}`, 400);
  }

  const open = store.listCharges({ tenantId, customerId, status: 'PENDING' });
  if (open.length >= config.limits.maxOpenChargesPerCustomer) {
    throw new AppError(
      'too_many_open_charges',
      `Customer already has ${open.length} open charges, the limit is ${config.limits.maxOpenChargesPerCustomer}`,
      409,
    );
  }

  const expiresAt = expiryFor(dueDate);

  // Control is the only thing that talks to providers.
  const order = await control.createProviderOrder(paymentMethod, {
    tenantId,
    amount,
    concept,
    expiresAt,
    customer: {
      name: customer.name,
      email: customer.email,
      documentNumber: customer.documentNumber,
    },
  });

  const charge = {
    id: nextChargeId(),
    tenantId,
    customerId,
    amount,
    concept,
    paymentMethod,
    providerOrderId: order.providerOrderId,
    paymentCode: order.paymentCode || null,
    paymentLink: order.paymentLink || null,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    dueDate: dueDate || null,
    expiresAt,
    paidAt: null,
    commissionRate: chargesCommission(paymentMethod) ? config.commissionRate : 0,
    notifyByWhatsapp,
  };

  store.insertCharge(charge);

  if (notifyByWhatsapp) {
    whatsapp.queueChargeNotification(charge, customer);
  }

  return charge;
}

function markAsPaid(chargeId, paidAt, store = defaultStore) {
  const charge = store.findCharge(chargeId);
  if (!charge) throw new AppError('charge_not_found', `Unknown charge ${chargeId}`, 404);
  if (charge.status === 'PAID') return charge;
  return store.updateCharge(chargeId, { status: 'PAID', paidAt });
}

module.exports = { listCharges, createCharge, markAsPaid };
