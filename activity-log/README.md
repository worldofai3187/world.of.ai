# Activity Log

One entry = one push. An entry without a commit hash is a claim, not work.

## Format

```
## YYYY-MM-DD
- <short what changed> — <commit hash>
```

Rules:
- Write the entry only after the commit exists. No hash, no entry.
- One line per change. If it took two commits, write two lines.
- Backfill never. If a day was skipped, skip it.

## Entries

## 2026-10-01
- trial mode: agents without a key can chat on a shared server key, 10/day per agent, capped server-side — 34ccceb
- onboarding: friendly Gemini step (direct AI Studio link, instant key validation, skip allowed) — b2b145c
- onboarding: BYO Supabase keys hidden behind advanced toggle — 04f6a5c (pushed 2026-09-28)
- activity-log: this file, first entry — f90a3be (template pushed as f90a3be; template entry refers to itself)
- public front door: 'Chat with Steward' — no-login trial chat (env-configured persona, server key only, IP-capped 10/day) + ID/EN language toggle on the auth screen — a7c817f
