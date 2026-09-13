'use strict';

/**
 * Single source of truth for how a payment method is classified.
 *
 * Two separate lists, on purpose:
 *
 *   - the RAIL says how the payer pays (service code vs hosted checkout)
 *   - PASS_THROUGH says who the money settles to
 *
 * EXTERNAL is a gateway by rail, but the funds land in the merchant's own
 * account, so Cobrana bills nothing on it. Do not collapse these two lists
 * into one: the day someone does, we start charging commission on money we
 * never received.
 */

const SERVICE_METHODS = ['CASHPOINT', 'PAGOYA'];
const GATEWAY_METHODS = ['MONARCA', 'EXTERNAL'];
const PASS_THROUGH_METHODS = ['EXTERNAL'];

const ALL_METHODS = [...SERVICE_METHODS, ...GATEWAY_METHODS];

function isKnownMethod(code) {
  return ALL_METHODS.includes(code);
}

function isGatewayMethod(code) {
  return GATEWAY_METHODS.includes(code);
}

/** Methods Cobrana actually earns commission on. */
function commissionableMethods() {
  return [...SERVICE_METHODS, ...GATEWAY_METHODS].filter(
    (code) => !PASS_THROUGH_METHODS.includes(code),
  );
}

function chargesCommission(code) {
  return commissionableMethods().includes(code);
}

module.exports = {
  SERVICE_METHODS,
  GATEWAY_METHODS,
  PASS_THROUGH_METHODS,
  ALL_METHODS,
  isKnownMethod,
  isGatewayMethod,
  commissionableMethods,
  chargesCommission,
};
