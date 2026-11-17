# Connected workspace

Lighthouse opens on the original animated demo dashboard (`/`, also available at `/live`). Today (`/today`) provides three case priorities, a compact summary and the latest evidence changes. Accounts, Operations and Portfolio share one validated browser-local store (`lighthouse-operations-v1`). Existing saved imports, drafts, reviews and original records remain compatible.

## Navigation and identity

- Today (`/today`): deadline problems first, then unresolved blockers. A reviewed remediation plan stays in the queue while blockers remain.
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

## Account follow-ups

Each account can have one open follow-up: a task, a named owner or team, and a calendar due date. Accounts provides Add/Edit, Mark complete, Reopen and Add next follow-up. An optional account note and the latest 50 follow-up events are available under Activity & notes. A completed task remains visible until another is added; earlier task snapshots remain in activity.

Today lists open follow-ups for currently available accounts, earliest due date first. Due and overdue items are shown first; upcoming work is collapsed. Dates use the viewer's local calendar, refreshed on focus and once a minute. They are separate from the fixed sample scenario clocks. No reminders or messages are sent. Ownership is a text label, not a permission or notification assignment.

Follow-ups use a separate validated local store (`lighthouse-follow-ups-v1`), preserving the existing case storage format. Completing a task never edits case evidence, drafts, policy status or approvals. Storage events synchronize browser tabs, and stale account revisions are rejected before changes. Browser-local storage is not a multi-user transactional database. Removed imported accounts are hidden from Today; their follow-up records are retained locally. Storage failures keep session edits available with a visible warning and JSON download.

Sign-in and cross-device storage require a dedicated Lighthouse backend. No shared database or authentication is configured in this release, and no data is uploaded automatically. The intended next step is an isolated Supabase project in the user's selected organization, with per-user access controls and explicit local-data import.

Follow-up QA: create a task due yesterday and another in the future; confirm Today ordering and Upcoming; edit and reload; complete and reopen; add a note; verify activity and unchanged policy blockers. Check the form, date input and account navigation at 390px. `tests/follow-ups.cjs` covers these domain transitions, valid dates, stale revisions, restore validation and bounded history.
