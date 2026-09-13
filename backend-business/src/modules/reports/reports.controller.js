'use strict';

const store = require('../../data/store');
const { chargesCommission } = require('../../catalog/payment-methods');
const { AppError } = require('../../http-utils');

/**
 * Monthly totals for the merchant's panel.
 *
 * Pass-through methods are deliberately excluded from the commission total:
 * that money never reaches us.
 */
function monthly(url) {
  const tenantId = url.searchParams.get('tenantId');
  const month = url.searchParams.get('month');
  if (!tenantId) throw new AppError('tenant_required', 'tenantId is required', 400);

  const charges = store.listCharges({ tenantId, status: 'PAID' })
    .filter((charge) => !month || charge.paidAt?.startsWith(month));

  const collected = charges.reduce((total, charge) => total + charge.amount, 0);
  const commission = charges
    .filter((charge) => chargesCommission(charge.paymentMethod))
    .reduce((total, charge) => total + Math.round(charge.amount * (charge.commissionRate ?? 0.01)), 0);

  return { tenantId, month: month || 'all', paidCharges: charges.length, collected, commission };
}

module.exports = { monthly };
