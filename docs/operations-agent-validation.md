# Lighthouse investigator validation — November 15, 2026

Ready for supervised review in the protected preview. The live agent uses the existing Anthropic account with `claude-sonnet-4-6`; provider credentials stay on the server. The public production investigator remains disabled.

## Verified implementation

- Code tested: `bb976dfd2ac3af7d2f6bda23e6fc03057b50af7d` (subsequent changes in this PR add evaluation records/documentation only).
- `npm test`: **66 passed**. TypeScript and the production build passed. Vercel preview build is READY.
- Live coverage: **10/10 latest case outcomes** pass the current decision/category, citation, schema, and focused draft checks. **5/10 first submissions** pass; the other five require one rules-guided correction. This is not a claim of 100% independent model accuracy.
- One earlier Sonnet run timed out at the initial 50-second limit. Its complete rerun through the browser passed in 66.3 seconds after the timeout was raised to 90 seconds. The four-call and 2,400-output-token-per-call limits did not increase.
- The two already-passing Sonnet smoke cases were retained; the other seven cases were tested through the API, and OPS-101 was tested through the UI. See the [machine-readable summary](evals/operations-agent-summary.json) for each run's exact provenance.

## Latest accepted outcomes

| Case | Validation | Run time | Estimated API usage |
| --- | --- | --- | --- |
| OPS-101 | After one correction | 66.3s | $0.0962 |
| OPS-102 | After one correction | 52.0s | $0.0823 |
| OPS-103 | First submission | 31.9s | $0.0432 |
| OPS-104 | After one correction | 47.2s | $0.0799 |
| OPS-105 | After one correction | 33.9s | $0.0673 |
| OPS-106 | First submission | 25.0s | $0.0384 |
| OPS-107 | After one correction | 53.8s | $0.0877 |
| OPS-108 | First submission | 22.7s | $0.0364 |
| OPS-109 | First submission | 24.7s | $0.0379 |
| OPS-110 | First submission | 23.3s | $0.0358 |

These ten accepted runs total **$0.6051** at standard uncached Sonnet 4.6 token rates. All recorded experiments and failed attempts total about **$1.15** in reported usage. The timed-out request may add usage that was not returned. These are token-based estimates, not an invoice or a credit-balance check.

## Browser QA

Verified on the desktop preview:

- Live execution, elapsed timer, completion state, displayed token usage, and actual tool/validation trace.
- Exact field quotations and a citation opening the matching invoice record.
- Downloaded agent JSON containing the source records, model/run ID, trace, and usage.
- Existing local approval stays intact until the explicit replacement confirmation; applying AI drafts clears that approval.
- AI draft origin and text survive reload.
- A reviewer can request changes; editing the draft clears that review state and preserves AI origin.
- Changing evidence removes the old investigation result and clears the assessment/drafts/review. Restoring exactly the original evidence can reload its matching cached investigation.
- Exported review packet includes the edited text and review history. No messages or operational writes occurred.
- Final desktop rendering inspected. A small-screen browser was not available for direct testing; responsive styles were reviewed, but this is not a mobile-browser QA claim.

The [raw browser run](evals/operations-agent-ui-run.json) and [edited review packet](evals/operations-agent-ui-reviewed.md) preserve the before/after example.

## Narrative review findings

A passing structured check does not certify every sentence. Manual review of the raw OPS-101 client draft found that it asked the customer's finance team to provide a corrected invoice. The policy's action belongs to the issuing Finance team. That wording was corrected through the normal editor, and the revision workflow was verified. Other drafts can imply follow-up activity or commitments that the records do not establish. These require human editing before use.

Accordingly, **no unrestricted narrative-quality pass is claimed**. The system is a supervised drafting prototype. It has no email, CRM-write, invoice-write, payment, or ticket-release tool. The UI explicitly distinguishes policy/category and field-quote checks from narrative review.

## Evaluation history and changes

Earlier results are retained rather than replaced:

1. [Initial Haiku smoke](evals/operations-agent-smoke.json): the validator rejected repeated classification errors.
2. [Repair-feedback smoke](evals/operations-agent-smoke-v2.json) and [remaining baseline cases](evals/operations-agent-baseline.json): six of ten cases were accepted under the then-current validator; four exhausted their run limit. Review found ungrounded approval/release wording and malformed responses.
3. [Strict-input Haiku run](evals/operations-agent-strict.json): all ten passed the then-current checks, but manual review found serialized JSON embedded in four narrative fields. The current validator rejects those four reports. This is why the historical `passed` flags must be read alongside the implementation version.
4. Added strict tool schemas, focused approval/release/markup checks, mandatory review text, and rejection of embedded report properties. Changed the cache version to discard earlier results. Chose Sonnet after reviewing its sample text; this is a small task-specific comparison, not a general model ranking.
5. [Sonnet smoke](evals/operations-agent-sonnet-smoke.json), [remaining Sonnet cases](evals/operations-agent-sonnet-final.json), and the browser run provide the latest accepted outcomes above.

Repaired submissions receive the deterministic engine's expected decision, missing/unsupported category IDs, and primary owner. The initial prompt does not contain case-specific answers. The results establish agreement with a supplied demo policy; they do not establish general reasoning ability or safe autonomous operation on real documents.

## Remaining scope

Public paid execution requires authenticated access and a durable atomic quota. The per-worker busy guard is not an account-wide spending limit. Shared approvals, real uploads, persistent server case state, and external actions remain future work. The existing public rules-based workspace remains available without this paid agent.
