# Architecture

Where each piece of the platform runs today.

## Core

| Piece | Runs on |
|---|---|
| `frontend/` | Static build on S3, served through CloudFront. One distribution per tenant subdomain. |
| `backend-business/` | EC2. Public - this is the API the panel calls. |
| `control/` | A separate EC2. Private, except for the provider webhook path, which is exposed so providers can reach it. |

Both backends use the same Postgres instance: one control database plus one
database per tenant.

```
  browser -> frontend (S3 + CloudFront)
                 |
                 v
          backend-business (EC2) <---+
                 |                   |
                 v                   | provider notifications
           control (EC2) <--------- providers
```

The panel calls the business backend, and the business backend calls control
for anything platform-level. Provider notifications go the other way: they land
on control, which owns the provider integrations, and control forwards them to
the business backend, which owns the charge.

## Lambdas

Work that does not happen inside a request runs as a Lambda, one per job.

| Lambda | What it does | Triggered by |
|---|---|---|
| `whatsapp-sender` | Sends the queued WhatsApp messages through the Meta API. | The business backend, when it queues a message. |
| `email-sender` | Sends transactional email through SES. | The business backend and the control backend. |
| `webhook-dispatcher` | Posts outbound webhooks to merchants that run their own systems. | The business backend, when it queues an event. |
| `daily-reconciliation` | Asks each provider what it settled on a date and closes the charges our side missed. | A schedule, every morning. |
| `bounce-handler` | Records bounces and complaints coming back from SES. | SNS. |

Lambdas are deployed separately from the backends, each with its own
configuration.
