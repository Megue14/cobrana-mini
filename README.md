# Cobrana

Cobrana lets a business collect payments from its customers through their own
banking apps, at a much lower fee than a card terminal. Most of our merchants
sell high-ticket items: private schools, clinics, dealerships, tuition.

This repository is a trimmed-down copy of the platform. It carries the same
architecture and the same conventions as the real one, with a fraction of the
code.

## Architecture

Three tiers plus the providers:

```
  outbound   frontend -> backend-business -> control -> provider
  inbound                backend-business <- control <- provider
```

- **`frontend/`** - the panel each merchant logs into. Talks **only** to the
  business backend.
- **`backend-business/`** - the single API the frontend calls. Owns everything
  scoped to one tenant: charges, customers, reports. When it needs something
  platform-level, or anything from a provider, it goes through control.
- **`control/`** - the control plane. Owns tenants, their commercial plan,
  their limits, and the provider integrations. It is the only thing that talks
  to a provider, in either direction.

**The frontend cannot and must not reach control directly.** It is not exposed
publicly in production, and anything the panel needs from it goes through the
business backend. `backend-business/src/clients/control.client.js` is how that
call is made.

Provider notifications come back the other way: the provider posts to control,
and control forwards them to the business backend, which owns the charge.

## Tenancy

The panel is served per tenant at `https://<tenant>.cobrana.pe`. There is no
single canonical frontend URL.

## Running it

No install step. No database. Node 18 or newer.

```
npm start     # control on :3001, business + panel on http://localhost:3000
npm test      # unit tests
```

The panel has four screens: dashboard, charges, new charge, my commerce.

Useful calls:

```
curl "http://localhost:3000/api/charges?tenantId=tnt_sanmartin"
curl "http://localhost:3000/api/payment-methods?tenantId=tnt_sanmartin"
curl "http://localhost:3000/api/my-commerce?tenantId=tnt_sanmartin"

curl -X POST http://localhost:3000/api/charges \
  -H 'content-type: application/json' \
  -d '{"tenantId":"tnt_sanmartin","customerId":"cus_001","amount":1500,"concept":"Pension marzo","paymentMethod":"CASHPOINT"}'

# cancel a charge that has not been paid
curl -X POST http://localhost:3000/api/charges/chg_1004/cancel \
  -H 'content-type: application/json' \
  -d '{"tenantId":"tnt_sanmartin"}'

# providers post to control. Service rail - reported at charge level:
curl -X POST http://localhost:3001/webhooks/providers/CASHPOINT \
  -H 'content-type: application/json' \
  -d '{"tenantId":"tnt_sanmartin","paymentCode":"730915","status":"PAID","amount":1500}'

# gateway rail - reported at transaction level:
curl -X POST http://localhost:3001/webhooks/providers/MONARCA \
  -H 'content-type: application/json' \
  -d '{"tenantId":"tnt_sanmartin","chargeId":"chg_1005","transactionId":"trx_mon_9002","status":"DECLINED","declineReason":"insufficient_funds"}'
```

`/api/my-commerce` and `/api/payment-methods` both read data the control plane
owns. Look at how they get it - that is the shape to follow whenever the panel
needs something from control.

## Where things are

```
frontend/                  tenant panel (plain HTML + fetch, hash routing)
backend-business/          tenant-scoped API
control/                   control plane
scheduled-jobs/            anything that runs on a schedule
docs/                      how the product works and where it runs
CONVENTIONS.md             how we write things here
```

Start with `docs/payment-rails.md` if you have never seen the product, then
`docs/architecture.md` for where each piece runs. Both are short.
