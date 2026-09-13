'use strict';

const tenants = require('./data/tenants.json');

function getTenant(tenantId) {
  return tenants[tenantId] || null;
}

/**
 * The slice of a tenant the business backend is allowed to read.
 * Anything commercial (plan, commission, limits) is owned here, not there.
 */
function getBillingConfig(tenantId) {
  const tenant = getTenant(tenantId);
  if (!tenant) return null;
  return {
    tenantId: tenant.id,
    name: tenant.name,
    subdomain: tenant.subdomain,
    commercialPlan: tenant.commercialPlan,
    commissionRate: tenant.commissionRate,
    enabledPaymentMethods: tenant.enabledPaymentMethods,
    limits: tenant.limits,
  };
}

function listTenants() {
  return Object.values(tenants).map((t) => ({
    id: t.id,
    name: t.name,
    subdomain: t.subdomain,
    status: t.status,
  }));
}

module.exports = { getTenant, getBillingConfig, listTenants };
