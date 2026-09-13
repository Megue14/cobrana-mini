'use strict';

const { AppError } = require('../http-utils');

/**
 * The business backend is the only service that talks to control.
 *
 * The panel never calls control directly - it is not publicly reachable, and
 * anything the panel needs from it comes through here. See README.md.
 */

const CONTROL_BASE_URL = process.env.CONTROL_BASE_URL || 'http://localhost:3001';

async function getBillingConfig(tenantId) {
  const response = await fetch(`${CONTROL_BASE_URL}/internal/tenants/${tenantId}/billing-config`);
  if (response.status === 404) {
    throw new AppError('tenant_not_found', `Unknown tenant ${tenantId}`, 404);
  }
  if (!response.ok) {
    throw new AppError('control_unavailable', 'Control plane did not answer', 502);
  }
  return response.json();
}

/**
 * Creating a charge means creating an order with the provider, and control is
 * the only thing that talks to providers.
 */
async function createProviderOrder(provider, order) {
  const response = await fetch(`${CONTROL_BASE_URL}/internal/providers/${provider}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(order),
  });
  if (response.status === 404) {
    throw new AppError('unknown_provider', `Unknown provider ${provider}`, 400);
  }
  if (!response.ok) {
    throw new AppError('provider_order_failed', 'The provider did not accept the order', 502);
  }
  return response.json();
}

module.exports = { getBillingConfig, createProviderOrder };
