'use strict';

const service = require('./charges.service');

function list(url) {
  const charges = service.listCharges({
    tenantId: url.searchParams.get('tenantId'),
    customerId: url.searchParams.get('customerId') || undefined,
    status: url.searchParams.get('status') || undefined,
  });
  return { charges };
}

async function create(body) {
  return service.createCharge(body);
}

module.exports = { list, create };
