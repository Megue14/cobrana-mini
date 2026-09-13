'use strict';

/**
 * WhatsApp notifications.
 *
 * Messages are queued here and picked up by the messaging service. Sends go
 * out through the Cobrana business number unless the merchant has connected
 * their own.
 */

const outbox = [];

function queueChargeNotification(charge, customer) {
  const message = {
    id: `msg_${outbox.length + 1}`,
    to: customer.phone,
    tenantId: charge.tenantId,
    template: 'charge_created',
    variables: {
      customerName: customer.name,
      concept: charge.concept,
      amount: charge.amount,
      paymentCode: charge.paymentCode,
    },
    queuedAt: new Date().toISOString(),
  };

  outbox.push(message);
  console.log(`[whatsapp] queued ${message.template} to ${message.to} for ${charge.id}`);
  return message;
}

function listQueued(tenantId) {
  return outbox.filter((message) => !tenantId || message.tenantId === tenantId);
}

module.exports = { queueChargeNotification, listQueued };
