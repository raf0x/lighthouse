# Private workspaces

The public animated dashboard remains the homepage. Guests keep the existing device-only workspace. Email sign-in at `/workspace` switches to an account-owned workspace; nothing imports automatically. “Bring work from this device” copies missing records and keeps existing cloud records. The original device copy is retained.

## Setup

- Use the dedicated Lighthouse Supabase project, never another application's database.
- `database/cloud-workspace.sql` is the current schema snapshot. It has already been applied to Lighthouse; do not reapply it to an existing table.
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the deployment environment. They are public client configuration, not administrative credentials. No service-role key is used by the app.
- Supabase Site URL and allowed redirects must include the exact deployed `/workspace` URL. Allow preview URLs individually, not a broad Vercel wildcard.
- Email links use PKCE. Open each link in the same browser that requested it. Request a separate link on a second device.
- The initial deployment uses Supabase's default email sender, which permits only organization-team addresses and has strict limits. Public sign-up requires configuring a dedicated SMTP sender. The UI states this restriction.

## Data and permissions

Each authenticated user owns one versioned JSON workspace. Row-level security limits reads and writes to `auth.uid()`. Anonymous users have no table or save-function permission. The save function runs as the caller and uses a row lock, expected version and mutation ID to reject stale writes and make lost-response retries safe.

Cases, applied message drafts, plan reviews, case activity, follow-ups and notes sync. A clean page checks for changes every 15 seconds and on focus. Raw AI investigation traces, theme and unfinished form text remain on the device. Signed-in investigation traces and unsaved recovery copies are keyed by user ID. These local recovery copies are not encrypted and may remain after a session expires; use a trusted browser. Sign-out clears the visible private workspace and prevents new writes using the previous account's token.

The UI reports a cloud save only after acknowledgment. Network errors retain a recovery draft. Conflicts block case editing and offer a download before loading the latest version. This first version does not automatically merge simultaneous edits or offer collaborative teams, offline-first loading, a tamper-proof audit trail, or external ticket/message actions.

## Verification

`npm test` covers save/retry ordering, two simulated devices, conflicts, late responses, account disposal, explicit import and recovery storage failures alongside the existing policy and follow-up checks. `npm run typecheck` and `npm run build` validate the application.

`database/cloud-workspace-checks.sql` exercises the actual save function and RLS with two fictional users in a transaction ending in ROLLBACK. It must run in the dedicated Lighthouse project. During implementation its connector confirmation expired, so this live SQL test has **not** passed. Schema inspection confirms RLS is enabled; Supabase security advisors reported no findings.

End-to-end release check: sign in with an approved team email, copy device work explicitly, save a fictional follow-up, and wait for “Saved to your workspace.” Sign in to the same account on a second browser/device and verify the update. Sign out and confirm private records disappear. These authenticated browser checks remain pending until a user completes email sign-in.
