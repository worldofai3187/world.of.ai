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
- activity-log: this file, first entry — <this commit>
