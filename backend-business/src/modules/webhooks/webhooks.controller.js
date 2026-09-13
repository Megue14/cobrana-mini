'use strict';

const service = require('./inbound.service');
const { AppError } = require('../../http-utils');

/** Both are called by the control plane, never by a provider directly. */

function serviceNotification(body) {
  if (!body.provider) throw new AppError('provider_required', 'provider is required', 400);
  return { received: true, ...service.handleServiceNotification(body.provider, body) };
}

function gatewayNotification(body) {
  if (!body.provider) throw new AppError('provider_required', 'provider is required', 400);
  return { received: true, ...service.handleGatewayNotification(body.provider, body) };
}

module.exports = { serviceNotification, gatewayNotification };
