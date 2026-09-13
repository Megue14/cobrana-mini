'use strict';

const BUSINESS_BASE_URL = process.env.BUSINESS_BASE_URL || 'http://localhost:3000';

/**
 * Control forwards provider notifications to the business backend, which owns
 * the charge and settles it. One endpoint per rail.
 */
async function forwardProviderNotification(rail, notification) {
  const path = rail === 'SERVICE'
    ? '/internal/provider-notifications/service'
    : '/internal/provider-notifications/gateway';

  const response = await fetch(`${BUSINESS_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(notification),
  });

  return { status: response.status, payload: await response.json() };
}

module.exports = { forwardProviderNotification };
