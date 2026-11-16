# Case CSV import

The Operations page offers **Import case** next to the saved-investigation link. Download the example CSV, replace its values, choose the file, review the mapped records, then explicitly add it to the queue. **Try the example file** exercises the same parser without requiring a download on a phone.

## Scope

- One case per CSV: one header row and one data row, at most 64 KB. Up to 20 imported cases per browser.
- The 18 template columns supply five record views: account, order, invoice, Finance ledger, and CRM. The sixth record is the fixed Lighthouse demo policy. Imports cannot provide policy, approval, execution tools, or model instructions.
- Amounts are decimal major units, converted to integer cents without floating-point rounding. Currencies are USD/CAD/MXN. Status is explicitly missing/pending/cleared. Blank billing entities and payment references remain missing.
- Zoned ISO timestamps are required. The imported scenario clock stays fixed. Deadline range matches the evidence editor: 7 days before through 30 days after the clock. Calendar validation rejects rolled dates and ambiguous timezone-free inputs.
- Reordered columns, UTF-8 BOM, quoted commas, doubled quotes and CRLF are supported. Unknown/duplicate/missing headers, multiple cases, invalid values and malformed quoting fail the entire import with correction guidance. No partial case is added.

## Provenance and lifecycle

Each case receives a generated `IMP-` identity, filename, logical CSV row 2 and import time. It starts unassessed and unapproved. Existing order IDs are rejected instead of overwritten. Source records show their CSV origin; they are not represented as independently verified Finance or CRM systems. The review preview includes exact normalized ISO dates and order/invoice IDs.

The existing workspace retains imported records, original baseline, assessments, edited drafts and local review in browser storage. Evidence or draft edits invalidate approval. Restore returns to the original imported records. Remove clears that imported workspace and its local investigator cache after an explicit confirmation. The source CSV can be imported again.

Saved built-in work and the public recorded investigation remain compatible. Imported workspaces are revalidated and projected on restore; corrupted identity/baseline pairs are dropped. The saved schema version remains compatible, while the agent wire protocol increments to `investigator-wire-v2` so stale pages cannot spend before refreshing.

## AI and public behavior

Reading and adding a file use no network or model call. Local policy checks remain available publicly. In the protected preview, the investigator separately sends the bounded current case fields to Anthropic. Both server and client use the existing policy/citation checks and human-review boundaries. Production rejects paid AI calls even if a key and enable flag are set.

Use fictional or anonymized records for this prototype. Imports do not create a shared database, query external systems, send messages, change invoices, or release tickets. The app does not support PDF/OCR or Excel workbook ingestion in this version.

## Verification

93 automated tests pass, including CSV parsing and precision, invalid dates/status/shape, original-case protection, duplicate rejection, reload/review invalidation, immutable baseline checks, source/export provenance, mocked imported tool-loop validation, and the API's pre-provider rejection boundary. TypeScript passes. Deployment and browser checks are recorded in the PR.
