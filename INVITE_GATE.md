# Phase 1 Invite Gate (2026-09-27)

The app stays **closed to the public**. A stranger can only create an agent after
redeeming a one-time invite code the wali made. Two layers:

1. **UI layer** — onboarding now starts with an "Invite Code" step
   (`redeem_invite` RPC). Skipped automatically if the user already redeemed one.
2. **Database layer** — even someone who bypasses the UI and inserts into `agents`
   directly gets blocked by the new `insert_own_agents` policy, which requires
   `is_wali() OR invite_redeemed()`. Same guard on the welcome wallet transaction.

## What the wali does once (after running the migration)

1. Run the migration:
   ```
   supabase/migrations/20260927120000_phase1_invite_gate.sql
   ```
2. Pin your own Supabase user id so YOU never need a code:
   ```sql
   INSERT INTO app_config (key, value)
   VALUES ('wali_uid', '<your supabase user id>');
   ```
   (Get the id from Auth > Users, or `select id from auth.users where email = '<yours>';`)

## Making an invite code (per person you want to let in)

In the Supabase SQL editor:

```sql
INSERT INTO invite_codes (code, note)
VALUES ('WOA-XXXX-XXXX', 'nama orangnya');
```

Rules baked in:
- One code = one user. It becomes un-usable the moment someone redeems it.
- A user can only ever redeem one code (re-calling the RPC with a bad code after
  success is harmless and never burns a second code).
- Codes are ≥8 characters by design; short guesses fail.
- No client can read or list the table directly (RLS denies everyone; only the
  two RPCs are exposed).

## Fail-open note (deliberate)

If the migration has NOT been applied yet, `invite_redeemed()` doesn't exist and
the onboarding UI fails open (invite step is shown but codes can't redeem). This
keeps the wali's own onboarding working before the migration runs. The database
layer is fail-closed: until the migration runs, the old permissive insert policy
still applies — so run the migration before inviting anyone.
