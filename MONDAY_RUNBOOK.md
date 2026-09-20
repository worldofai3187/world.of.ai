# WOA — Runbook Senin (phase 1: satu panggilan Gemini beneran)

Tujuan satu ini saja: **satu pesan chat dijawab oleh Gemini dari server, dan tercatat.**
Kalau ini jalan, WOA berhenti jadi tampilan dan mulai punya otak.

## Yang sudah siap (aku, hari ini, tanpa laptop kamu)
- main sudah di `520c36d`, sudah ke-push.
- `npm run typecheck` bersih, `npm run build` hijau (route `/api/chat` ada).
- Tambalan baru: kalau nama model Gemini di-retire Google, server otomatis coba model
  kedua. Error key salah / kuota habis / timeout tetap muncul apa adanya, nggak ditutupin.

## Langkah kamu (urut, sekitar 30 menit)

**1. Pull**
```
git pull origin main
```

**2. Env — buat `.env.local` di root repo**
```
NEXT_PUBLIC_SUPABASE_URL=<url project kamu>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key kamu>
```
Catatan penting: **tidak ada `GEMINI_API_KEY` di env.** Key Gemini itu per-agent,
disimpan di kolom `agents.gemini_api_key`, dan cuma dibaca di server. Tiap agent punya
kuota sendiri.

**3. Migrasi database** (kalau belum pernah jalan)
Buka Supabase → SQL Editor → jalankan tiga file ini, urut:
```
supabase/migrations/20260829134129_create_world_of_ai_schema.sql
supabase/migrations/20260919000000_phase1_api_usage.sql
supabase/migrations/20260920000000_phase1_state_field.sql
```
File ketiga cuma nambah satu kolom nullable (`chat_messages.emotional_state`). Aman
dijalanin kapan aja, nggak nambah langkah tes, dan nggak aku pakai dulu di phase 1.

**4. Isi key Gemini agent**
Lewat onboarding step "Gemini" (kolom `GEMINI_API_KEY`, input password).
Kalau agent-nya sudah keburu jadi, isi langsung:
```sql
update agents set gemini_api_key = 'AIza...' where id = '<agent id kamu>';
```

**5. Jalanin**
```
npm install
npm run dev
```
Buka Chat, kirim satu pesan.

## Cara tau berhasil
- Balasan muncul dan **bukan** teks template.
- Di tabel `api_usage` ada 1 baris baru dengan `total_tokens > 0`.

```sql
select model, ok, error, prompt_tokens, output_tokens, total_tokens, created_at
from api_usage order by created_at desc limit 3;
```

## Kalau gagal, kirim ke aku persis ini
1. Baris error di terminal yang mengandung `gemini_failed` atau `detail`.
2. Satu baris dari `api_usage` (kolom `ok`, `error`, `total_tokens`).

Dari dua itu aku bisa bilang masalahnya key, model, RLS, atau env. Aku nggak nebak.

## Yang sengaja BELUM kita sentuh
- 3D avatar (.glb VRoid) → phase 5. Phase 1 cukup avatar satu gambar (URL).
- relationship_state / activity_log / delta JSON → sesudah satu panggilan ini jalan.
- `emotional_state` sudah ada kolomnya (schema siap), tapi sengaja belum ditulis. Kontrak
  state → ekspresinya di `AVATAR_SPEC.md` §7, buat kamu baca pas sempat.
- Condition (RPM/TPM/RPD) → otomatis punya angka begitu `api_usage` terisi.

Satu hal dulu. Satu.
