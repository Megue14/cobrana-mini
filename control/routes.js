'use strict';

const tenantsService = require('./src/tenants.service');
const providersService = require('./src/providers.service');
const businessClient = require('./src/clients/business.client');
const providerClient = require('./src/clients/provider.client');

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

/**
 * Control owns the provider integrations, so provider notifications land here.
 * Everything else on this server is internal: only other Cobrana services call
 * it.
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://control.internal');
  const path = url.pathname;

  const notification = path.match(/^\/webhooks\/providers\/([^/]+)$/);
  if (req.method === 'POST' && notification) {
    const code = notification[1];
    const provider = providersService.getProvider(code);
    if (!provider) return json(res, 404, { error: { code: 'unknown_provider', provider: code } });

    const raw = await readBody(req);
    const missing = providersService.missingFields(provider.rail, raw);
    if (missing.length > 0) {
      return json(res, 400, { error: { code: 'missing_fields', fields: missing } });
    }

    const body = provider.rail === 'SERVICE'
      ? providersService.normalizeService(code, raw)
      : providersService.normalizeGateway(code, raw);

    const forwarded = await businessClient.forwardProviderNotification(provider.rail, body);
    return json(res, forwarded.status, forwarded.payload);
  }

  const newOrder = path.match(/^\/internal\/providers\/([^/]+)\/orders$/);
  if (req.method === 'POST' && newOrder) {
    const provider = providersService.getProvider(newOrder[1]);
    if (!provider) return json(res, 404, { error: { code: 'unknown_provider', provider: newOrder[1] } });

    const order = await readBody(req);
    const created = await providerClient.createOrder(provider, order);
    return json(res, 201, created);
  }

  if (req.method === 'GET' && path === '/internal/providers') {
    return json(res, 200, { providers: Object.values(providersService.providers) });
  }

  if (req.method === 'GET' && path === '/internal/tenants') {
    return json(res, 200, { tenants: tenantsService.listTenants() });
  }

  const billing = path.match(/^\/internal\/tenants\/([^/]+)\/billing-config$/);
  if (req.method === 'GET' && billing) {
    const config = tenantsService.getBillingConfig(billing[1]);
    if (!config) return json(res, 404, { error: { code: 'tenant_not_found' } });
    return json(res, 200, config);
  }

  const tenant = path.match(/^\/internal\/tenants\/([^/]+)$/);
  if (req.method === 'GET' && tenant) {
    const found = tenantsService.getTenant(tenant[1]);
    if (!found) return json(res, 404, { error: { code: 'tenant_not_found' } });
    return json(res, 200, found);
  }

  return json(res, 404, { error: { code: 'not_found', path } });
}

module.exports = { handleRequest };
