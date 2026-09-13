'use strict';

/**
 * Provider integrations.
 *
 * Control holds the credentials and speaks each provider's API. What comes
 * back is not the same on both rails: a service provider returns a payment
 * code, a gateway returns a link to its checkout page.
 *
 * Stubbed here - the real client signs and posts to the provider.
 */

let counter = 4400;

function nextOrderId(prefix) {
  counter += 1;
  return `${prefix}_${counter}`;
}

function sixDigits() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function token() {
  return Math.random().toString(36).slice(2, 12);
}

async function createOrder(provider, order) {
  if (provider.rail === 'SERVICE') {
    return {
      rail: 'SERVICE',
      providerOrderId: nextOrderId('ord'),
      paymentCode: sixDigits(),
      expiresAt: order.expiresAt,
    };
  }

  return {
    rail: 'GATEWAY',
    providerOrderId: nextOrderId('ord'),
    paymentLink: `https://checkout.${provider.code.toLowerCase()}.pe/${token()}`,
    expiresAt: order.expiresAt,
  };
}

module.exports = { createOrder };
