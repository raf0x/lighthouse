# Browser response validation fix

The user reported a successful desktop investigation and a mobile rejection saying the response did not match the current evidence. That message came from client-side `restoreAgentRun`, after a successful API response, and conflated every validation failure.

## Reproduction and scope

Using the accepted OPS-101 server run, local validation passed with the server date format. Changing only the runtime's date display pattern from `Nov 16, 5:00 AM EST` to an equivalent `Nov 16 at 5:00 AM GMT-5` caused rejection of the allocation-deadline and scenario-clock citations. The input signature and all underlying records remained identical. This is a simulated cross-runtime formatting reproduction, not direct observation of the user's iPhone. An outdated mobile tab was another plausible path through the same generic error.

ECMA-402 permits implementation-dependent locale formatting: [specification](https://402.ecma-international.org/13.0/). Exact evidence comparisons must not depend on a browser's display pattern.

## Changes

- Canonical dates and integer-cent currency strings on both sides. New York daylight-saving rules are retained; punctuation, month names, AM/PM, and EST/EDT labels are consistent.
- A browser/server protocol header, checked before reading the case or creating a provider client. Old/missing versions receive a refresh instruction without model usage. Availability is fetched without caching.
- Specific client errors for version mismatch, changed evidence, citations, and report validation. Existing valid runs and edited drafts remain intact. Validation is still strict; altered facts and quotations are rejected.

## Verification

76 automated tests and TypeScript passed. Regression coverage includes all ten source-record sets under alternate display patterns, four retained live responses, currency cents, both daylight-saving transitions, midnight/noon/year rollover, stale-page rejection without provider calls, and continued rejection of changed records and incorrect quotes. The test suite does not claim Safari or physical-device coverage.

Deployment and live smoke results are recorded after verification.
