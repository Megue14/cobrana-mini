'use strict';

/**
 * Outbound webhooks for merchants that run their own systems.
 *
 * Deliveries are queued, never sent inline: a merchant's server being slow or
 * down must never sit in the path of a payment confirmation.
 */

const queue = [];

function enqueue(event) {
  queue.push({
    id: `evt_${queue.length + 1}`,
    type: event.type,
    tenantId: event.tenantId,
    payload: event.payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  });
  return queue[queue.length - 1];
}

function pending() {
  return queue.filter((event) => event.attempts === 0);
}

module.exports = { enqueue, pending };
