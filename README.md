# world.of.ai

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-va4hxvbq)

## Trial mode ("coba dulu")

Agents without their own Gemini key can still chat in trial mode on a shared
server-side key. To enable it on Netlify, set one env var:

- `GEMINI_SERVER_KEY` — a Gemini API key owned by the app.

Limits (server-enforced):
- 10 trial chats per agent per UTC day (chat_messages count, DB-backed).
- Existing per-user abuse limits still apply first (rate-limit.ts).

Agents that bring their own key skip trial mode entirely and use their own quota.
The Condition page keeps reporting real usage either way.
