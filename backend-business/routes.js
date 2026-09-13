'use strict';

const { json, readBody } = require('./src/http-utils');
const charges = require('./src/modules/charges/charges.controller');
const customers = require('./src/modules/customers/customers.controller');
const reports = require('./src/modules/reports/reports.controller');
const commerce = require('./src/modules/commerce/commerce.controller');
const catalog = require('./src/modules/catalog/catalog.controller');
const webhooks = require('./src/modules/webhooks/webhooks.controller');

async function handleApiRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/api/charges') {
      return json(res, 200, charges.list(url));
    }
    if (req.method === 'POST' && path === '/api/charges') {
      return json(res, 201, await charges.create(await readBody(req)));
    }
    // What the hosted payment page calls when the payer opens the link.
    const startCheckout = path.match(/^\/api\/charges\/([^/]+)\/checkout$/);
    if (req.method === 'POST' && startCheckout) {
      return json(res, 200, await charges.checkout(startCheckout[1]));
    }
    const cancelCharge = path.match(/^\/api\/charges\/([^/]+)\/cancel$/);
    if (req.method === 'POST' && cancelCharge) {
      return json(res, 200, await charges.cancel(cancelCharge[1], await readBody(req)));
    }
    if (req.method === 'GET' && path === '/api/customers') {
      return json(res, 200, customers.list(url));
    }
    if (req.method === 'GET' && path === '/api/my-commerce') {
      return json(res, 200, await commerce.show(url));
    }
    if (req.method === 'GET' && path === '/api/payment-methods') {
      return json(res, 200, await catalog.paymentMethods(url));
    }
    if (req.method === 'POST' && path === '/internal/provider-notifications/service') {
      return json(res, 200, webhooks.serviceNotification(await readBody(req)));
    }
    if (req.method === 'POST' && path === '/internal/provider-notifications/gateway') {
      return json(res, 200, webhooks.gatewayNotification(await readBody(req)));
    }
    if (req.method === 'GET' && path === '/api/reports/monthly') {
      return json(res, 200, reports.monthly(url));
    }
    return json(res, 404, { error: { code: 'not_found', message: `No route for ${req.method} ${path}` } });
  } catch (err) {
    return json(res, err.statusCode || 500, {
      error: { code: err.code || 'internal_error', message: err.message },
    });
  }
}

module.exports = { handleApiRequest };
