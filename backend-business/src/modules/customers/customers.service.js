'use strict';

const defaultStore = require('../../data/store');
const { AppError } = require('../../http-utils');

function listCustomers(filters, store = defaultStore) {
  if (!filters.tenantId) {
    throw new AppError('tenant_required', 'tenantId is required', 400);
  }
  return store.listCustomers(filters);
}

module.exports = { listCustomers };
