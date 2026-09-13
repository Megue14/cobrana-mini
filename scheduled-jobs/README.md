# Scheduled jobs

Everything that runs on a clock lives here, not inside the business backend.

Each job is deployed on its own and triggered by its own scheduler, so a
backend restart or a bad release cannot silently stop it. A job that did not
run is the kind of failure nobody notices until a merchant complains.

Every job in here is idempotent: it can be triggered twice for the same period
and the second run does nothing. See `daily-reconciliation.js` for the shape.

Run one by hand:

```
node scheduled-jobs/daily-reconciliation.js 2026-03-10
```
