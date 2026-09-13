'use strict';

const service = require('./customers.service');

function list(url) {
  const customers = service.listCustomers({ tenantId: url.searchParams.get('tenantId') });
  return { customers };
}

module.exports = { list };
