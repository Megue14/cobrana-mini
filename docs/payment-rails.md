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
5. We issue the receipt and, for merchants running their own systems, queue an
   outbound webhook.

The provider settles the money to Cobrana and we pay the
merchant out on their settlement schedule.

## Gateway rail - MONARCA, EXTERNAL

1. The merchant creates a charge.
2. The customer opens the payment link. We mint the order with the provider at
   that moment - not at creation time - and send the customer to the provider's
   hosted checkout page.
3. The customer enters their card on the provider's page and confirms.
4. The provider posts a notification to control the same way, referencing the
   charge. The charge moves to PAID there.

`EXTERNAL` is the case where the merchant holds their own gateway
certification. We proxy to a service they run, the money settles into their own
merchant account, and those charges carry no Cobrana commission.

## Creating a charge

Both rails go through the same path: the panel calls the business backend, the
business backend asks control, and control talks to the provider. Control holds
the credentials; nothing else speaks to a provider.

The body we send is the same on both rails - tenant, amount, concept, customer
and expiresAt. What comes back is not: a service provider returns a
`paymentCode`, a gateway returns a `paymentLink`.

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

## Notifications get lost

Providers time out, we redeploy mid-request, a network blip eats a POST. Some
providers retry on a non-200, some send the notification exactly once and never
again. `scheduled-jobs/daily-reconciliation.js` asks the provider what it
settled on a given date and closes whatever our side missed.
