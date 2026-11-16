# Lighthouse public case study

`/demo` is the shareable entry point. It presents a retained real Claude investigation on fictional OPS-101 records, followed by a local resolution exercise. Viewing the case study, opening evidence, downloading the run, and resolving the sample never call a model or change the operations workspace.

## Three parts

- **Saved investigation:** Original accepted summary, next step, message drafts, twelve field citations, and tool activity from `docs/evals/operations-agent-browser-fix-ui.json`. The first rejected submission and subsequent correction remain visible. Time, tokens, and estimated cost describe the historical run.
- **Resolve the case:** Correcting the sample invoice removes the entity mismatch. Simulating Finance confirmation clears both ledger and CRM payment status. Local policy moves from two blockers to one, then to ready for human review. The deadline warning remains because the scenario clock is fixed. Reset restores only the temporary sample.
- **How it works:** One Claude investigator reads records and proposes; deterministic code checks structured findings and field quotations; a person reviews the plan and drafts. The separate seven-agent dashboard remains a scripted walkthrough.

The server validates the retained recording against current rules during the build. A stale or invalid recording stops publication. No report text is silently rewritten to fit new evidence. Corrected sample records deliberately cannot restore the original AI result.

## Public and protected access

Both `/api/operations/investigate` and the older `/api/analyze` endpoint reject production execution before reading a body or creating a provider client, even if a key and enable flag exist. Live AI remains in the protected preview with the branch-scoped enable flag. The existing account dashboard uses its labeled scripted fallback when live analysis is disabled.

The demo offers no sending, invoice editing, payment verification, or ticket-release integration. Harbor approves a local remediation plan, not release. Structured checks cannot verify every narrative sentence. Opening live paid execution publicly would be a separate change requiring authentication and durable spending controls.

## Validation

- 80 automated checks pass, including the published recording, two-to-one-to-zero blocker progression, retained deadline warning, isolated reset, and production guard on the legacy endpoint.
- TypeScript and a production build validate the implementation.
- The user reported the earlier browser-formatting fix working on their phone: 28.5 seconds, 11,206 input / 2,086 output tokens. This is separate from the retained public recording.
- Preview and production browser checks are recorded in the pull request after deployment. These are desktop checks; responsive CSS is not a substitute for a physical-handset check.

No additional paid model runs are necessary to build or test this presentation.
