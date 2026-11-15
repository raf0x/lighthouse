# Lighthouse case investigator

The Investigator tab adds one Anthropic tool-using agent to the existing operations workspace. It uses the project's existing `claude-haiku-4-5-20251001` integration. The provider key remains on the server. No mail, invoice, payment, ticket, shell, network-search, or CRM-write tools are exposed.

## Execution and verification

1. The browser submits the selected synthetic case to `POST /api/operations/investigate`. The server validates and projects only evidence-editor fields onto the canonical fixture; immutable order identity and policy cannot be replaced.
2. Claude receives a record index and the policy, not the expected case findings. It chooses `read_records` calls and receives exact source fields as tool results. All six records must be observed in an earlier model turn before submission.
3. `submit_investigation` returns structured findings, source references, field quotations, missing-information questions, a recommendation, and two drafts.
4. A deterministic validator requires exact category/decision agreement with the policy engine, relevant source IDs, matching field quotations covering every source, a question for each missing/conflicting-information finding, bounded text, and the expected primary owner. Failed submissions receive feedback within the same bounded run. Free text, truncated output, unknown tools, and exhausted runs are never accepted as successful investigations.
5. The UI shows actual model/tool/validation events and reported token usage. It never fabricates a reasoning transcript. Applying AI drafts requires an explicit replacement action and clears prior Harbor approval. The original rules-based assessment remains authoritative.

The validator checks **category agreement and quote provenance**. It does not prove every generated sentence, the suitability of a recommendation, or absence of all prompt-injection effects. Narrative and drafts require human review. Tests of the runtime with fake provider responses are software tests, not evidence of live model quality.

## Access and spending boundaries

- Live execution is disabled whenever `VERCEL_ENV=production`, even if the enable flag is set.
- The review branch alone receives `LIGHTHOUSE_AGENT_ENABLED=true`, with the existing sensitive `ANTHROPIC_API_KEY` inherited in preview. Vercel deployment protection remains enabled. Anyone holding a valid preview share link can access that preview; do not publish its access link as a general portfolio demo.
- A run allows at most four model requests, 2,400 output tokens per response, a 60,000-character message-history limit, and a 50-second overall abort timer. Provider network retries are disabled. Invalid/cross-origin/oversized requests are rejected before provider construction.
- The worker concurrency guard prevents overlapping requests within one function worker. It is **not** a global rate limiter or daily monetary cap. Separate serverless workers can run concurrently. Public paid execution needs authentication and durable, atomic quotas before enabling it.
- The UI estimates standard uncached Haiku 4.5 usage at $1/M input and $5/M output tokens, verified November 15, 2026. It is not an account-credit check or invoice. Failed/cancelled requests can incur usage not reported in a completed response.
- Clicking Stop aborts the browser request and asks the server/provider to stop when disconnect is propagated; it cannot guarantee an in-flight request is unbilled. Switching case or leaving the tab also aborts the observer.

## State and review

Successful runs are stored locally under a versioned case key, with exact evidence signature. Changed evidence cannot load an old result. AI draft origin (model/run/time) travels with the editable draft and review-packet export. Agent-run JSON includes source records, actual tool trace, usage, and validation attempts. These browser records are not authenticated or tamper-proof audit trails. Existing user edits/reviews are not replaced until the user applies drafts.

## Evaluation

`npm test`, `npm run typecheck`, and `npm run build` cover the local implementation. `scripts/evaluate-operations-agent.cjs` performs a bounded live check against a protected Vercel preview; it reads JSON configuration from stdin with `url`, optional `caseIds`, and an `output` under `docs/evals/`. It does not read or expose a provider key. The share URL is used only in memory and is excluded from reports. Each selected fixture runs once with no automatic whole-run retry. Provider access, credit/request, and rate-limit failures stop the batch.

The report records acceptance, exact category matches, first-submission success, repair attempts, provider-reported tokens, estimated cost, elapsed time, generated text, and tool traces. A passing category benchmark does not by itself establish accuracy on real customer documents. Real uploads, persistent case memory, shared authenticated review, and external write actions are outside this increment.

## Public contracts used

- [Anthropic: handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)
- [Anthropic: define tools and tool choice](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)
- [Claude Haiku 4.5 model ID and pricing](https://platform.claude.com/docs/en/models/haiku-4-5/overview)
