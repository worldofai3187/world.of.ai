# WOA: log yang nggak bisa disembunyikan agent

## Kenapa ini penting
Agent yang nulis log sendiri bukan saksi. Dia bisa bolos, nunda, atau nulis versi manisnya.
Jadi log harus ditulis di tempat yang agent nggak pegang kuncinya.

## Tiga lapis

### Lapis 1 — Boundary log (server yang nulis)
Semua aksi agent lewat API route / edge function kamu. Server yang nulis baris log, bukan agent.
- agent minta aksi -> server cek izin -> server eksekusi -> server tulis log
- agent nggak punya jalan langsung buat nulis log
- kalau agent diam, yang tercatat tetap "nggak ada aksi" dari sisi server, dan itu sendiri sinyal

### Lapis 2 — Trigger DB (DB yang nulis)
Pasang trigger AFTER INSERT/UPDATE/DELETE di tabel penting. Siapa pun yang nyentuh baris (agent, server, kamu) otomatis bikin baris audit. Agent nggak bisa nolak karena bukan dia yang nulis.

### Lapis 3 — Anomali (pola yang server lihat)
- lonjakan volume mendadak
- coba akses baris di luar scope (RLS nolak, tapi tetap dicatat)
- domain / tool baru yang belum pernah dipakai agent
- auth gagal berulang
- pola prompt-injection di konten masuk

Kalau log agent beda dari log server -> itu sendiri sinyal danger. Jangan percaya versi agent.

## Batas jujurnya
Nggak ada 100%. Kalau agent pegang kunci yang bisa akses dunia luar di luar server kamu, dia bisa bertindak tanpa kamu lihat. Makanya desainnya capability-based, bukan trust-based: agent cuma bisa lakuin apa yang kamu sediakan sebagai tool, dan tiap tool logging di server. Nggak ada channel tersembunyi.

---

## SQL siap tempel — audit log + trigger

```sql
-- ===== audit_log =====
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  agent_id uuid,
  actor text not null default 'db_trigger',
  table_name text not null,
  op text not null,              -- INSERT / UPDATE / DELETE
  row_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_agent_created on audit_log(agent_id, created_at desc);

alter table audit_log enable row level security;

-- Wali boleh baca log milik agent-nya. TIDAK ada policy insert/update/delete:
-- artinya agent (dan siapa pun lewat API) nggak bisa nulis atau hapus log ini.
drop policy if exists "select_own_audit" on audit_log;
create policy "select_own_audit" on audit_log for select
  to authenticated using (
    exists (select 1 from agents a where a.id = audit_log.agent_id and a.user_id = auth.uid())
  );

-- ===== fungsi trigger =====
create or replace function log_table_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_agent uuid;
  v_row_id text;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'DELETE' then
    v_agent := old.agent_id;
    v_row_id := old.id::text;
    v_before := to_jsonb(old);
  elsif tg_op = 'UPDATE' then
    v_agent := new.agent_id;
    v_row_id := new.id::text;
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    v_agent := new.agent_id;
    v_row_id := new.id::text;
    v_after := to_jsonb(new);
  end if;

  insert into audit_log(agent_id, actor, table_name, op, row_id, before, after)
  values (v_agent, 'db_trigger', tg_table_name, tg_op, v_row_id, v_before, v_after);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- ===== trigger di tabel penting =====
drop trigger if exists trg_audit_chat on chat_messages;
create trigger trg_audit_chat after insert or update or delete on chat_messages
  for each row execute function log_table_change();

-- api_usage volume tinggi, insert-only cukup
drop trigger if exists trg_audit_usage on api_usage;
create trigger trg_audit_usage after insert on api_usage
  for each row execute function log_table_change();

drop trigger if exists trg_audit_risk on risk_actions;
create trigger trg_audit_risk after insert or update or delete on risk_actions
  for each row execute function log_table_change();

drop trigger if exists trg_audit_wallet on wallet_transactions;
create trigger trg_audit_wallet after insert or update or delete on wallet_transactions
  for each row execute function log_table_change();
```

Catatan: `security definer` bikin fungsi nulis ke `audit_log` walau RLS-nya ketat, dan karena `audit_log` nggak punya policy insert, agent tetap nggak bisa nulis/hapus lewat jalur biasa. Itu memang tujuannya.

---

## Satu hal yang harus kamu putuskan dulu

RLS di schema kamu sekarang scoped ke WALI: `agents.user_id = auth.uid()`. Itu bener buat dashboard kamu. Tapi begitu agent pegang anon key sendiri, `auth.uid()` jadi identitas AGENT, bukan kamu. Policy itu bikin agent lihat NOL baris, atau kamu harus longgarin, dan itu bahaya.

Ingat: anon key bukan rahasia. Dia cuma nunjukin project. Yang benar-benar ngunci adalah JWT sesi. Jadi pilih dulu:

**Opsi A — agent nggak pegang kunci apa pun (paling kuat).**
Agent cuma punya token per-agent ke server kamu. Server yang pegang `service_role`. Agent nggak pernah nyentuh Supabase langsung. RLS jadi dinding kedua, dan nggak ada kunci yang bisa bocor dari agent.
Cocok buat fase 1: cepat, aman, satu pintu.

**Opsi B — agent punya sesi sendiri (anon key + login).**
Tambah kolom `agents.auth_user_id`, bikin satu auth user per agent, lalu policy agent scoped ke dirinya sendiri:

```sql
alter table agents add column if not exists auth_user_id uuid unique;

create or replace function current_agent_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from agents where auth_user_id = auth.uid() limit 1
$$;

-- agent cuma boleh lihat & nulis chat-nya sendiri
drop policy if exists "agent_own_chat_select" on chat_messages;
create policy "agent_own_chat_select" on chat_messages for select
  to authenticated using (agent_id = current_agent_id());

drop policy if exists "agent_own_chat_insert" on chat_messages;
create policy "agent_own_chat_insert" on chat_messages for insert
  to authenticated with check (agent_id = current_agent_id());

-- agent TIDAK dikasih policy update/delete, dan tidak dikasih akses ke
-- profiles, agents.gemini_api_key, risk_actions.status, audit_log.
```

Buat kamu (wali), policy lama tetap jalan karena `auth.uid()` kamu beda dari `auth_user_id` agent.

Rekomendasiku: **A dulu buat fase 1**, B nanti kalau agent perlu realtime langsung ke Supabase. Alasannya sama seperti yang kamu bilang soal rogue agent: makin sedikit kunci di tangan agent, makin sedikit yang bisa disembunyikan.
