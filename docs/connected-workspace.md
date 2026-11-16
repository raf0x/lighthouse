# Connected workspace

Lighthouse opens on Today: three case priorities, a compact summary and the latest evidence changes. Accounts, Operations and Portfolio share one validated browser-local store (`lighthouse-operations-v1`). Existing saved imports, drafts, reviews and original records remain compatible.

## Navigation and identity

- Today (`/`): deadline problems first, then unresolved blockers. A reviewed remediation plan stays in the queue while blockers remain.
- Accounts (`/accounts`): a searchable directory and a short account summary with one next action. The mobile layout shows either the directory or the selected account.
- Operations (`/operations`): check evidence, resolve blockers, review the plan. The primary action is visible at the bottom on small screens. `case` and `tab` query parameters support direct case/activity links.
- Portfolio (`/portfolio`): current partner orders and their policy outcome. Totals use integer order cents; currencies remain separate. Plan approval never removes blocked order value.
- Global search finds account names, order IDs, invoice IDs and payment references. It does not search external systems.

Each existing partner case has a stable account ID derived from its case ID. Imported cases keep independent account identities; similar names never cause automatic merging. Multiple imports for the same organization are not consolidated in this release. The eight original SaaS sample accounts remain in the directory with their original IDs; their analytics are available under `/insights` and `/insights/portfolio`. They have no fabricated operational cases. Existing `/?account=ACC…` walkthrough links remain supported.

## Evidence and persistence

The shared provider restores existing data using the policy engine's validation, then persists changes once per state update. Navigation retains in-session changes even if browser storage fails; a warning asks the user to export before leaving. Other browser tabs receive storage changes. This is a local prototype, not shared team storage or a tamper-proof audit trail.

Today and Account summaries calculate policy status from current evidence without creating a saved analysis or approval. Opening a case still offers Check evidence to create its local plan. Built-in manual edits and restores now record the same structured before/after history as imported evidence updates.

What changed is a deterministic brief of recent evidence events, not AI-generated prose or an unread notification feed. Each entry links to the precise case's Activity tab and labels its historical outcome. No extra API calls are made for navigation, priorities, portfolio totals or change summaries. Production AI endpoint restrictions remain unchanged.

## Verification

Run `npm test`, `npm run typecheck` and `npm run build`. The workspace regression tests cover identity, corrections propagating across views, stale review handling, reviewed blocked plans, scenario deadline ordering, separate currencies, persisted change history and restoration.

Browser acceptance: open Today; inspect Portside; check evidence; correct its invoice and payment; rerun checks; return to its account and portfolio; inspect the change brief; reload; confirm results persist; verify global order search and existing demos. Check narrow layouts for horizontal overflow, usable navigation and the persistent case action.
