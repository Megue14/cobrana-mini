'use strict';

const defaultControl = require('../../clients/control.client');
const { AppError } = require('../../http-utils');

/**
 * Everything the panel shows on "My commerce" is owned by the control plane.
 * The panel cannot reach control, so the business backend fetches it and hands
 * it over. This is the shape to copy whenever the panel needs platform data.
 */
async function getMyCommerce(tenantId, control = defaultControl) {
  if (!tenantId) throw new AppError('tenant_required', 'tenantId is required', 400);
  const config = await control.getBillingConfig(tenantId);

  return {
    tenantId: config.tenantId,
    name: config.name,
    panelUrl: `https://${config.subdomain}.cobrana.pe`,
    commercialPlan: config.commercialPlan,
    commissionRate: config.commissionRate,
    limits: config.limits,
    enabledPaymentMethods: config.enabledPaymentMethods,
  };
}

module.exports = { getMyCommerce };
