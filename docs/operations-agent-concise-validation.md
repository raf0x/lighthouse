# Concise investigator follow-up

The investigator now shows a short outcome, one next step, and two expandable messages. Detailed findings, questions, quotations, and run diagnostics remain available in disclosures. The Harbor rail no longer repeats the action plan on this tab.

## Contract and checks

- Hard word budgets: summary 35; next step 45; each explanation 45; each question 35; internal draft 160; client draft 130. Subject and sign-off count toward the draft limits.
- Each draft includes the human-review sentence exactly once. The issuing Finance team owns invoice correction and cleared-funds verification; a customer can provide remittance evidence.
- Focused regression checks reject the reported customer-invoice requests, the unsupported written-justification alternative, leaked internal category IDs, contradictory explicit blocker counts, and unsupported summary warnings.
- Version `investigator-v4` ignores old cached investigations. Previously applied/edited drafts survive; replacement still requires the explicit apply flow and clears their approval.
- These checks are bounded pattern checks and policy comparisons, not comprehensive semantic verification. Human wording review remains required.

## Software and browser validation

71 automated tests passed. TypeScript validation and the Next.js production build passed; no new dependencies were added. Production live execution remains disabled.

Desktop browser QA verified the simplified outcome, initially collapsed messages/evidence/diagnostics, both readable drafts, keyboard disclosure controls, exact quotations and invoice-source navigation, exported run JSON, and cache/persistence after reload. A temporary synthetic QA approval stayed intact when replacement was cancelled and was cleared when the concise drafts were applied. The final workspace has no approval recorded for those new drafts. The UI was inspected on the deployed preview; mobile-browser testing was not available.

## Live evaluation history

The original Portside browser run on `cd169b1` produced a 14-word summary, a 17-word next step, a 63-word internal draft, and an 84-word client draft. It completed in 29.6 seconds with estimated token usage of $0.0655, after one policy-guided correction. Its invoice action belongs to our Finance team, and the unsupported justification alternative is absent. See [raw browser run](evals/operations-agent-concise-v4-ui.json).

[Initial API sample](evals/operations-agent-concise-v4.json) tested conflict, ready-for-review, and expired-deadline cases. Manual review caught internal category identifiers in two messages; the subsequent validator rejects those earlier outputs. [Plain-language reruns](evals/operations-agent-concise-v4-plain.json) removed those labels, but the conflict summary then misstated the blocker count and called a 72-hour deadline a warning. Those errors prompted the final summary checks. Preserve the historical `passed` flags as results under their then-current validator, not as current acceptance or narrative-quality certification.

The final focused conflict rerun on `b9823d1` passed with a correct summary. All four selected outputs below pass the final validator; the three already-acceptable outputs were revalidated locally rather than spending on redundant provider calls. Their source commits are recorded in the [machine-readable summary](evals/operations-agent-concise-v4-summary.json). One case passed its first submission; three required one policy-guided correction.

| Case | Initial submission | Internal / client words | Run time | Estimated usage |
| --- | --- | --- | --- | --- |
| OPS-101 | One policy-guided correction | 63 / 84 | 29.6s | $0.0655 |
| OPS-103 | One policy-guided correction | 42 / 54 | 24.7s | $0.0618 |
| OPS-105 | One policy-guided correction | 64 / 48 | 21.8s | $0.0561 |
| OPS-110 | First submission | 44 / 50 | 14.4s | $0.0313 |

These are focused follow-up cases, not a repeat of the earlier ten-case live suite. All seven live runs in this follow-up used approximately $0.37 in estimated tokens. No messages, invoices, payments, or ticket releases were executed.
