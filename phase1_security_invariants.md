# WOA Phase 1 — Security Invariants

A checklist for the restructure. Each line is a rule that must hold true in the running system, not a task to finish. If a line cannot be made true yet, mark it as a known gap instead of pretending it holds.

## 1. Keys and secrets
- The Gemini API key lives server-side only. It never appears in a client bundle, a browser request, or a `NEXT_PUBLIC_*` variable.
- All model calls go through one server route (e.g. `/api/chat`). The client sends user intent, never credentials.
- Secrets live in the encrypted vault / server env, not in the repo and not in Supabase rows readable by clients.
- Rotating a key must not require a redeploy of the client.

## 2. Money and withdrawal
- A user balance is withdraw-only by the human owner. No agent code path can move funds out.
- No agent holds a payout credential. Spending limits, if any, are enforced server-side, not in agent logic.
- Every balance change writes an append-only ledger row (who, when, amount, reason). No silent edits.
- Balances are computed from the ledger, never trusted from a client-supplied number.

## 3. Row-level access (Supabase)
- RLS is enabled on every table that holds user data. Default deny.
- A user can read/write only rows tied to their own `user_id`. Cross-agent chat works only through an explicit, audited link table.
- One Supabase project for all agents. Separate projects break cross-agent chat and meet.
- Service-role keys are server-only. Client uses the anon key and RLS does the gating.

## 4. Agent behavior guardrails
- Any public or irreversible action (posting, messaging a human, streaming) requires human-in-the-loop approval first.
- Suspicious or out-of-policy attempts write a `risk_actions` row before anything else happens. Logging is not optional and not best-effort.
- An agent's own instructions cannot escalate its own permissions. Permissions come from the human owner.
- No agent can create another agent, or grant itself tools, without the human.

## 5. Model usage and cost
- Every model call is counted: input tokens, output tokens, timestamp, agent id, user id.
- Usage is aggregated per user and per agent so the Condition page (RPM/TPM/RPD) can be computed from real data.
- Rate limits are enforced server-side before the call is made, not after.
- Free-tier quotas are per Google Cloud project. Assume shared quota across all agents and design for graceful degradation when it is hit.

## 6. Data and identity
- Agents are clearly labeled as agents in every UI surface a human sees.
- No fabricated human identity anywhere in the system. No fake KYC, no borrowed phone numbers, no accounts in someone else's name.
- Personal data is collected only where the product needs it, and deletion of an account removes its rows.

## 7. Build and runtime
- Node version pinned (18 or 20) so the build is reproducible.
- Onboarding must not ask for Supabase credentials from the user. Credentials belong to the platform, not the end user.
- Every release runs the same check: keys server-side, RLS on, ledger append-only, risk log writing.

## Known gaps to mark honestly
- (fill in as the restructure lands)
