# Operations

Day-to-day runbook for the support side. Nothing here is required reading to
ship a feature.

## A customer says they paid and the charge is still open

1. Ask for the payment code and the date.
2. Check the charge in the panel. If it is `PENDING`, the provider notification
   either never arrived or failed while we were processing it.
3. Run the daily reconciliation job for that date. It replays what the provider
   reports and settles anything we missed.
4. If the charge is still open after that, the payment did not reach the
   provider either. Ask the customer for their bank's receipt.

## A charge was created twice

Happens when a merchant clicks twice in the panel. Cancel the newer one. Never
cancel one that already has a payment against it.

## Monthly close

Reports for the previous month are generated on the 1st. If a merchant says
their numbers are off, check whether they have `EXTERNAL` charges: those settle
into the merchant's own account and are excluded from our totals by design.

## Escalation

Anything involving money that moved and cannot be explained goes to the CTO
directly, same day. Do not "fix" a charge by editing its status.
