# Case CSV import

The Operations page offers **Import case** next to the saved-investigation link. Download the example CSV, replace its values, choose the file, review the mapped records, then explicitly add it to the queue. **Try the example file** exercises the same parser without requiring a download on a phone.

## Scope

- One case per CSV: one header row and one data row, at most 64 KB. Up to 20 imported cases per browser.
- The 18 template columns supply five record views: account, order, invoice, Finance ledger, and CRM. The sixth record is the fixed Lighthouse demo policy. Imports cannot provide policy, approval, execution tools, or model instructions.
- Amounts are decimal major units, converted to integer cents without floating-point rounding. Currencies are USD/CAD/MXN. Status is explicitly missing/pending/cleared. Blank billing entities and payment references remain missing.
- Zoned ISO timestamps are required. The initial scenario clock is supplied by the file; a reviewed follow-up may advance it. Deadline range matches the evidence editor: 7 days before through 30 days after the clock. Calendar validation rejects rolled dates and ambiguous timezone-free inputs.
- Reordered columns, UTF-8 BOM, quoted commas, doubled quotes and CRLF are supported. Unknown/duplicate/missing headers, multiple cases, invalid values and malformed quoting fail the entire import with correction guidance. No partial case is added.

## Provenance and lifecycle

Each case receives a generated `IMP-` identity, filename, logical CSV row 2 and import time. It starts unassessed and unapproved. Importing an existing order ID is rejected. Use **Update evidence** on that existing case for a reviewed replacement. Source records show their CSV origin; they are not represented as independently verified Finance or CRM systems. The review preview includes exact normalized ISO dates and order/invoice IDs.

The existing workspace retains imported records, original baseline, assessments, edited drafts and local review in browser storage. Evidence or draft edits invalidate approval. Restore returns to the original imported records. Remove clears that imported workspace and its local investigator cache after an explicit confirmation. The source CSV can be imported again.

Saved built-in work and the public recorded investigation remain compatible. Imported workspaces are revalidated and projected on restore; corrupted identity/baseline pairs are dropped. The saved schema version remains compatible, while the agent wire protocol increments to `investigator-wire-v2` so stale pages cannot spend before refreshing.

## AI and public behavior

Reading and adding a file use no network or model call. Local policy checks remain available publicly. In the protected preview, the investigator separately sends the bounded current case fields to Anthropic. Both server and client use the existing policy/citation checks and human-review boundaries. Production rejects paid AI calls even if a key and enable flag are set.

Use fictional or anonymized records for this prototype. Imports do not create a shared database, query external systems, send messages, change invoices, or release tickets. The app does not support PDF/OCR or Excel workbook ingestion in this version.

## Verification

106 automated tests pass, including CSV parsing and precision, invalid dates/status/shape, original-case protection, duplicate rejection, reload/review invalidation, immutable baseline checks, source/export provenance, mocked imported tool-loop validation, and the API's pre-provider rejection boundary. TypeScript passes. Deployment and browser checks are recorded in the PR.

## Follow-up evidence

Imported cases have a visible **Update evidence** button beside Edit evidence. Download the current CSV, change the evidence fields, upload a complete replacement row, and inspect the before/after comparison. No state changes on parsing or preview. Acceptance rechecks the exact compared input signature, replaces the supplied evidence, runs the deterministic policy engine, generates fresh local drafts and clears the previous review and draft origin. Earlier agent runs cannot be reused for changed evidence. No model call is triggered.

Partner, order ID, order amount/currency and ticket quantity stay fixed. Follow-up files may replace the invoice ID, change invoice/payment/CRM fields, or advance the explicitly zoned scenario clock. Earlier scenario times are rejected. Blanks intentionally replace old fields with missing evidence. A new filename alone is a no-op that preserves drafts and approval. Invalid or wrong-order files fail without applying any fields.

The original imported baseline remains available for Restore. Activity records exact changed values, policy outcomes/findings before and after, source filename, acceptance time, and a summary of any cleared prior review. Manual edits and restores also capture comparisons. These details survive reload and appear in review-packet exports. The latest 100 local events are retained; this is not authenticated or tamper-proof provenance. State above the restore size bound is not written; the existing storage warning directs users to download before leaving.

**Try example update** is available only for the exact fictional Seabrook starter records. It loads a visibly labeled example with corrected invoice entity, cleared ledger/CRM statuses and a scenario clock two hours later. It does not infer clearance for arbitrary imported cases.

Follow-up tests cover partial fixes, new invoice IDs, advancing time, later expiry, no-op and wrong-order rejection, stale comparisons, explicit blank fields, preserved baseline, old-review and old-agent invalidation, persistence/export, and malformed saved audit details. Browser verification is recorded in the release PR.
