# Payment rails

Cobrana supports two rails. A merchant can have either or both enabled; which
ones are available to them is part of their commercial plan and lives in the
control plane.

## Service rail - CASHPOINT, PAGOYA

Most of our volume runs here.

1. The merchant creates a charge in the panel. The business backend asks
   control to open an order with the provider; the provider answers with a
   6-digit payment code, which we store on the charge.
2. The merchant passes the code to their customer - in person, over WhatsApp,
   printed on the invoice, however that merchant works.
3. The customer opens their own banking app, goes to "Pay services", picks the
   provider from the list, types the code and confirms the amount.
4. The provider posts a notification to control, which forwards it to the
   business backend. The charge moves to PAID there.
5. For merchants running their own systems, we queue an outbound webhook.

The provider settles the money to Cobrana and we pay the
merchant out on their settlement schedule.

## Gateway rail - MONARCA, EXTERNAL

1. The merchant creates a charge in the panel. The charge gets a payment link.
2. The merchant passes the link to their customer - in person, over WhatsApp,
   printed on the invoice, however that merchant works.
3. The customer opens the link. The business backend asks control to open an
   order with the provider, and the customer is sent to the provider's
   checkout page to enter their card.
4. The provider posts a notification to control, which forwards it to the
   business backend. The charge moves to PAID there.

`EXTERNAL` is the case where the merchant holds their own gateway
certification. We proxy to a service they run, the money settles into their own
merchant account, and those charges carry no Cobrana commission.

## Creating a charge

The panel calls the business backend, which writes the charge.

Anything that reaches a provider goes through control: the business backend
asks control, control talks to the provider. Control holds the credentials;
nothing else speaks to a provider. The body is tenant, amount, concept,
customer and expiresAt. A service provider answers with a `paymentCode`, a
gateway with the URL to send the payer to.

## What each rail reports

Providers post to `POST /webhooks/providers/:provider` on control. Providers on
the same rail send the same body, whatever their own API looks like - agreeing
on the shape is part of onboarding one, so there is no per-provider parsing
anywhere in our code.

The two rails report different things, so their contracts are different.

### Service - reported at charge level

The customer typed a payment code into their banking app and the provider
settled it. There is nothing below the charge to record.

```json
{
  "provider":    "CASHPOINT",
  "tenantId":    "tnt_sanmartin",
  "paymentCode": "730915",
  "status":      "PAID",
  "paidAt":      "2026-03-09T10:00:00.000Z",
  "amount":      1500
}
```

Payment codes are six digits and only unique within a merchant, so `tenantId`
says whose charge this is and the lookup is scoped by it.

### Gateway - reported at transaction level

One charge can collect several attempts: a declined card, a closed tab, a
retry. Each attempt is its own transaction with its own outcome, and the charge
is settled by an approved one.

```json
{
  "provider":      "MONARCA",
  "tenantId":      "tnt_sanmartin",
  "chargeId":      "chg_1005",
  "transactionId": "trx_mon_7756",
  "status":        "APPROVED",
  "declineReason": null,
  "amount":        2800,
  "processedAt":   "2026-02-21T19:10:00.000Z"
}
```

`status` is `APPROVED` or `DECLINED`. Declined attempts are recorded and the
charge stays open.

## Cancelling a charge

A charge that has not been paid can be cancelled from the panel, and it moves
to `CANCELLED`. A paid charge cannot be cancelled.

If an order is open for it, the business backend asks control to void it and
control tells the provider. The payment code stays on our record after that -
the order is voided at the provider, not deleted here.

## Notifications get lost

Providers time out, we redeploy mid-request, a network blip eats a POST. Some
providers retry on a non-200, some send the notification exactly once and never
again. `scheduled-jobs/daily-reconciliation.js` asks the provider what it
settled on a given date and closes whatever our side missed.
