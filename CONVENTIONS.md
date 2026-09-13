# Conventions

## Scheduled work does not live inside the backend

Anything that runs on a clock lives in `scheduled-jobs/`, deployed on its own
and triggered by its own scheduler. It does **not** run as a cron inside the
business backend.

The reason is availability: a restart, a deploy or a bad release of the backend
would silently stop the clock, and nobody notices a job that did not run. Jobs
that touch tenant data call the backend's internal endpoints or the store
directly, but they own their own schedule.

`scheduled-jobs/daily-reconciliation.js` is the reference implementation. Copy
its shape.

## Scheduled work must be idempotent

Every job can be triggered more than once for the same period: the scheduler
retries on timeout, and operators re-run jobs by hand when something looks off.
A job that creates something has to key its work so a second run is a no-op.

We are a payments platform. Producing the same side effect twice is the one
class of bug we cannot walk back.

## Tests

`node --test`, no test dependency. Run with `npm test`.

Fakes are injected as a **defaulted last parameter**:

```js
async function createCharge(input, store = defaultStore, control = controlClient) { ... }
```

Production never passes them, so there is no flag, no branch and no config to
get wrong at runtime. When a function needs a third seam, convert the tail to
an options object rather than adding a fourth positional argument.

## Storage

This copy keeps everything in memory (`backend-business/src/data/store.js`,
`control/src/data/tenants.json`). The real platform runs Postgres with one
database per tenant plus a control database. The shape of the data is the same.

## Money

Amounts are integers in PEN. No floats anywhere near a charge.
