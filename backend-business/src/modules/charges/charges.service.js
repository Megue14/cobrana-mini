'use strict';

const defaultStore = require('../../data/store');
const defaultControl = require('../../clients/control.client');
const { AppError } = require('../../http-utils');
const { isKnownMethod, isGatewayMethod, chargesCommission } = require('../../catalog/payment-methods');
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

const CHECKOUT_BASE_URL = process.env.CHECKOUT_BASE_URL || 'https://pay.cobrana.pe';

function checkoutToken() {
  return Math.random().toString(36).slice(2, 12);
}

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

  let providerOrderId = null;
  let paymentCode = null;
  let paymentLink = null;

  if (isGatewayMethod(paymentMethod)) {
    // Nothing goes to the provider here. The charge gets a payment link and
    // waits - see startCheckout below.
    paymentLink = `${CHECKOUT_BASE_URL}/${checkoutToken()}`;
  } else {
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
    providerOrderId = order.providerOrderId;
    paymentCode = order.paymentCode || null;
  }

  const charge = {
    id: nextChargeId(),
    tenantId,
    customerId,
    amount,
    concept,
    paymentMethod,
    providerOrderId,
    paymentCode,
    paymentLink,
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

/**
 * The payer opened the payment link.
 *
 * The order at the gateway is opened here, not when the charge was created. It
 * is the provider's object for one pass at paying, and it answers with the URL
 * to send the payer to. The same charge can come through here more than once -
 * a declined card, a closed tab, a retry - and each pass leaves its own order
 * at the provider. Our charge is settled by whichever one goes through.
 */
async function startCheckout(chargeId, store = defaultStore, control = defaultControl) {
  const charge = store.findCharge(chargeId);
  if (!charge) throw new AppError('charge_not_found', `Unknown charge ${chargeId}`, 404);

  if (!isGatewayMethod(charge.paymentMethod)) {
    throw new AppError(
      'not_a_checkout_charge',
      `${charge.paymentMethod} is not paid through a checkout page`,
      400,
    );
  }
  if (charge.status === 'PAID') {
    throw new AppError('charge_already_paid', 'This charge is already paid', 409);
  }
  if (charge.status === 'CANCELLED') {
    throw new AppError('charge_cancelled', 'This charge was cancelled', 409);
  }

  const customer = store.findCustomer(charge.customerId);

  const order = await control.createProviderOrder(charge.paymentMethod, {
    tenantId: charge.tenantId,
    chargeId: charge.id,
    amount: charge.amount,
    concept: charge.concept,
    expiresAt: charge.expiresAt,
    customer: customer
      ? { name: customer.name, email: customer.email, documentNumber: customer.documentNumber }
      : null,
  });

  return {
    chargeId: charge.id,
    providerOrderId: order.providerOrderId,
    redirectUrl: order.paymentLink,
  };
}

/**
 * Cancelling a charge. On the service rail there is an order at the provider
 * holding the payment code, and it has to be voided - a code that stays live
 * behind a cancelled charge can still be paid from a banking app. On the
 * gateway rail there is no order until someone opens the link, so there is
 * nothing at the provider to void.
 */
async function cancelCharge(chargeId, tenantId, store = defaultStore, control = defaultControl) {
  if (!tenantId) throw new AppError('tenant_required', 'tenantId is required', 400);

  const charge = store.findCharge(chargeId);
  if (!charge || charge.tenantId !== tenantId) {
    throw new AppError('charge_not_found', `No charge ${chargeId} for this merchant`, 404);
  }
  if (charge.status === 'PAID') {
    throw new AppError('charge_already_paid', 'A paid charge cannot be cancelled', 409);
  }
  if (charge.status === 'CANCELLED') {
    return charge;
  }

  if (charge.providerOrderId) {
    await control.voidProviderOrder(charge.paymentMethod, charge.providerOrderId);
  }

  // The code stays on the record: the order was voided at the provider, but a
  // notification can still arrive for it and we want to be able to match it.
  return store.updateCharge(chargeId, {
    status: 'CANCELLED',
    cancelledAt: new Date().toISOString(),
  });
}

function markAsPaid(chargeId, paidAt, store = defaultStore) {
  const charge = store.findCharge(chargeId);
  if (!charge) throw new AppError('charge_not_found', `Unknown charge ${chargeId}`, 404);
  if (charge.status === 'PAID') return charge;
  return store.updateCharge(chargeId, { status: 'PAID', paidAt });
}

module.exports = { listCharges, createCharge, startCheckout, cancelCharge, markAsPaid };
