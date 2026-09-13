'use strict';

const service = require('./catalog.service');

async function paymentMethods(url) {
  const rails = await service.listEnabledByRail(url.searchParams.get('tenantId'));
  return { rails };
}

module.exports = { paymentMethods };
