# Lighthouse · OPS-101

Synthetic scenario · rules-based assessment · nothing sent or released
AI-assisted drafts (possibly edited): claude-sonnet-4-6
Run: bd810113-2475-42bf-9d52-269ee613d857 · 2026-11-15T21:30:39.839Z
Human review of narrative remains required.

## Case
Portside Collectibles · ORD-2401
Scenario time: Nov 15, 9:00 AM EST
Engine: operations-v1

## Assessment
Resolve the blockers before release.
2 blocking findings need attention for ORD-2401. Ticket release remains on hold.

- Invoice names a different entity: The invoice names “Portside Collectibles Canada, Ltd.”; the account approves “Portside Collectibles US, Inc.”.
  Sources: account, invoice, policy
  Next step (Finance): Ask Finance to validate and reissue INV-7601 against the approved entity; involve Legal if entity approval must change.
- Payment has not cleared: The ledger records a pending transfer. A pending amount does not establish cleared funds.
  Sources: payment, policy
  Next step (Finance): Obtain Finance confirmation of cleared funds before release review.
- Allocation deadline is approaching: 20 hours remain at the scenario clock. The deadline is Nov 16, 5:00 AM EST.
  Sources: order, policy
  Next step (Partner Operations): Alert the account owner and Ticketing Operations to the deadline while the evidence is resolved.

## Source records
### Account record [account]
Source: Synthetic partner account
- Partner: Portside Collectibles
- Approved billing entity: Portside Collectibles US, Inc.
- Account owner: Partner Operations

### Ticket order [order]
Source: ORD-2401
- Order total: USD 48,000.00
- Ticket quantity: 160
- Allocation deadline: Nov 16, 5:00 AM EST
- Scenario clock: Nov 15, 9:00 AM EST

### Invoice register [invoice]
Source: INV-7601
- Billed entity: Portside Collectibles Canada, Ltd.
- Invoice total: USD 48,000.00
- Linked order: ORD-2401
- Other active invoice: None in this sample

### Payment ledger [payment]
Source: Synthetic finance ledger
- Ledger status: pending
- Recorded amount: USD 48,000.00
- Payment reference: PAY-5301
- Linked order: ORD-2401

### CRM payment note [crm]
Source: Synthetic CRM snapshot
- Payment status: pending
- Linked order: ORD-2401

### Release policy [policy]
Source: Demo policy · v1
- Entity: Invoice entity must match the approved account entity. Missing entities require clarification.
- Invoice: Exactly one active invoice must match the order amount and currency.
- Payment: A referenced, cleared payment for the exact order amount and currency is required. Conflicting records need Finance review.
- Deadline: Escalate deadlines within 24 hours. After expiry, obtain a new allocation decision; never assume an extension.
- Human review: A reviewer approves the proposed plan. This demo cannot send messages, change invoices, or release tickets.

## Internal draft
INTERNAL CASE NOTE — OPS-101 / ORD-2401

Partner: Portside Collectibles
Order: ORD-2401 | 160 tickets | USD 48,000.00
Deadline: Nov 16, 5:00 AM EST (~20 hours from scenario clock)

Ticket release is not confirmed and requires human review.

The supplied records show two blockers:

1. ENTITY MISMATCH (blocker)
The approved billing entity on the account is 'Portside Collectibles US, Inc.' Invoice INV-7601 bills 'Portside Collectibles Canada, Ltd.' These do not match. Finance must validate and issue a corrected invoice naming the approved entity. The approved entity must not be altered to accommodate the invoice.

2. PAYMENT PENDING (blocker)
Payment PAY-5301 (USD 48,000.00) is in 'pending' status on both the ledger and the CRM. Policy requires a cleared payment. Finance must confirm cleared funds and update the ledger status before this condition is satisfied.

3. DEADLINE NEAR (attention)
The allocation deadline is within 20 hours. If the two blockers above are not resolved before Nov 16, 5:00 AM EST, Ticketing Operations must be consulted for an escalation or new allocation decision. We cannot assume an extension.

No duplicate invoice. Invoice currency and amount match the order (USD 48,000.00). CRM and ledger both show 'pending' — no payment_conflict applies.

Required actions:
- Finance: Issue corrected invoice for approved entity 'Portside Collectibles US, Inc.'
- Finance: Confirm PAY-5301 cleared and update ledger
- Ticketing Operations: Advise on deadline risk if blockers persist
- Once cleared: route to Ticketing Operations for human release review

## Client draft
Dear Portside Collectibles,

Thank you for your order ORD-2401 (160 tickets, USD 48,000.00).

Ticket release is not confirmed and requires human review.

The supplied records show two items that must be resolved before your order can advance:

1. Invoice entity: The invoice on file names 'Portside Collectibles Canada, Ltd.' The approved billing entity for your account is 'Portside Collectibles US, Inc.' A corrected invoice reflecting the approved entity is required. Our Finance team needs to validate and reissue the invoice against the approved entity.

2. Payment status: Payment reference PAY-5301 (USD 48,000.00) is currently showing as pending. We require Finance confirmation of cleared funds before the payment condition can be satisfied.

Please note that the allocation deadline for this order is Nov 16, 5:00 AM EST. Prompt resolution of both items is important given this timeline.

Once both items are addressed, the case will be routed for human release review. We are unable to confirm ticket availability or release at this stage.

If you have questions, please contact your account representative.

Thank you.

## Local review
Pending human review.

## Local activity
- 2026-11-15T21:15:39.117Z · Case analyzed: 3 findings. Action needed. Checked with operations-v1.
- 2026-11-15T21:15:45.553Z · Plan approved locally: QA reviewer: Synthetic workflow test: checking that applying AI drafts clears this approval. Nothing sent or released.
- 2026-11-15T21:31:51.382Z · AI drafts applied: Drafts from claude-sonnet-4-6, run bd810113-2475-42bf-9d52-269ee613d857. Policy checks remain authoritative; human review required.
- 2026-11-15T21:32:33.581Z · Changes requested: QA reviewer: Correct the client draft: our Finance team must validate and reissue the invoice; do not ask the customer to issue our invoice. Nothing sent or released.
- 2026-11-15T21:32:40.838Z · Drafts edited: Message text changed. Any prior review cleared.
