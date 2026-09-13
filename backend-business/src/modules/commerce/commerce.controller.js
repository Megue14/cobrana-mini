'use strict';

const service = require('./commerce.service');

async function show(url) {
  return service.getMyCommerce(url.searchParams.get('tenantId'));
}

module.exports = { show };
