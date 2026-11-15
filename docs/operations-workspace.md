# Lighthouse partner operations workspace

## Scope

The `/operations` route turns Lighthouse's existing visual system into an interactive ticket-order exception workspace. It is a **rules-based baseline**, not a live language-model agent. Ten fictional cases run locally with no model requests, external writes, or new infrastructure. The existing `/live` walkthrough, account pages, and optional Anthropic analysis endpoint retain their behavior.

The current workflow is: inspect records, run policy checks, examine cited findings, edit message templates, and record a local human review. Reviewing a remediation plan never marks an order released or a blocker resolved.

## Data and policy

`app/lib/operations.ts` owns the typed fixtures, policy checks, review provenance, storage validation, and Markdown export. All scenarios use a fixed clock of November 15, 2026 at 09:00 America/New_York. This makes deadlines reproducible rather than accidentally becoming live commitments as the demo ages. Activity timestamps record actual browser actions.

The fictional policy requires a matching approved entity, one active invoice, exact order amount/currency, a referenced cleared payment, reconciled CRM and Finance status, and a valid allocation window. Deadlines within 24 hours raise an attention finding. Expired deadlines require a fresh Ticketing Operations decision. Currency conversion, entity approval, payment settlement, and deadline extensions are never inferred.

| Case | Scenario | Expected result |
| --- | --- | --- |
| OPS-101 | Invoice entity mismatch, pending payment, near deadline | Action needed |
| OPS-102 | Missing payment evidence | Evidence needed |
| OPS-103 | CRM and Finance disagree | Evidence needed |
| OPS-104 | Pending payment, four-hour deadline | Action needed |
| OPS-105 | Matching evidence and cleared funds | Ready for review |
| OPS-106 | Partial cleared payment | Action needed |
| OPS-107 | Invoice/payment currency mismatch | Action needed |
| OPS-108 | Duplicate active invoice | Action needed |
| OPS-109 | Missing approved billing entity | Evidence needed |
| OPS-110 | Expired allocation deadline | Action needed |

## Interactive demonstration

1. Open `/operations?case=OPS-101` and choose **Analyze this case**.
2. Follow a source citation to compare the invoice's Canadian entity with the approved US entity.
3. Open **Message drafts** and edit either template.
4. Choose **Approve plan**, enter a reviewer name, and confirm. Only the local plan review is recorded.
5. Choose **Edit evidence**. Copy the approved entity into the invoice entity and set both Finance and CRM status to cleared. Save. The assessment and approval are cleared.
6. Analyze again. The remaining near-deadline notice does not block release review.
7. Download the packet to inspect the evidence, findings, drafts, and review state outside the application.

## State boundaries

- Browser-local storage is versioned and validated. Reload preserves edits and matching reviews. Invalid and incompatible records are ignored.
- Review provenance records the exact evaluated inputs and message drafts. Evidence edits require fresh analysis; draft edits require a fresh review.
- Reviewer names are self-entered. This is not authentication, a shared approval system, or a tamper-proof audit log.
- Storage failures show a session-only warning; packet export remains available.
- No upload, mail-send, payment, invoice-write, or ticket-release integration is present.
- The check history describes actual deterministic comparisons, not fabricated tool calls or hidden model reasoning.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build`. The operations tests cover all ten scenarios, evidence references, edited outcomes, monetary edge cases, deadline boundaries, review invalidation, storage recovery, and export. Existing account and walkthrough regression checks remain included.

## Next increment

After the baseline is reviewed, a model can help interpret unstructured documents or draft natural language. Keep deterministic financial comparisons and approval state authoritative. Before connecting paid inference, choose a provider and budget. Real write actions additionally need authenticated reviewers, server-owned state, role checks, idempotency, and server-side verification that the approved evidence version is current. Do not treat the local review button as authorization for a future connector.
