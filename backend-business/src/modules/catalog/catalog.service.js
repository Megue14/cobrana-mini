'use strict';

const defaultControl = require('../../clients/control.client');
const { AppError } = require('../../http-utils');
const {
  SERVICE_METHODS,
  GATEWAY_METHODS,
  chargesCommission,
} = require('../../catalog/payment-methods');

const LABELS = {
  CASHPOINT: 'Cashpoint',
  PAGOYA: 'Pagoya',
  MONARCA: 'Monarca',
  EXTERNAL: 'Own gateway',
};

const RAILS = [
  {
    code: 'SERVICE',
    name: 'Services',
    description: 'We generate a 6-digit code. The customer pays it from their own banking app.',
    methods: SERVICE_METHODS,
  },
  {
    code: 'GATEWAY',
    name: 'Gateway',
    description: 'The customer is sent to a hosted checkout page and pays there.',
    methods: GATEWAY_METHODS,
  },
];

/** Only the methods this tenant actually has enabled, grouped by rail. */
async function listEnabledByRail(tenantId, control = defaultControl) {
  if (!tenantId) throw new AppError('tenant_required', 'tenantId is required', 400);
  const config = await control.getBillingConfig(tenantId);

  return RAILS.map((rail) => ({
    code: rail.code,
    name: rail.name,
    description: rail.description,
    methods: rail.methods
      .filter((code) => config.enabledPaymentMethods.includes(code))
      .map((code) => ({
        code,
        label: LABELS[code] || code,
        chargesCommission: chargesCommission(code),
      })),
  })).filter((rail) => rail.methods.length > 0);
}

module.exports = { listEnabledByRail, RAILS, LABELS };
