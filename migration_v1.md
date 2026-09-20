# WOA — Daftar Migrasi v1
### Sistem lamamu (email konsep) → WOA Backend Protocol v1

Ini daftar pemetaan: apa yang lama, apa yang baru, datanya diapain.
Nggak ada yang dihapus diam-diam. Kalau nanti kamu ubah lagi, naik versi.

---

## A. Yang sudah cocok, tinggal dipakai

**8 field Relationship Understanding — isinya sama, cuma beda penamaan kolom.**
Nggak ada migrasi data, cuma snake_case.

| Sistem lama (email) | Protocol v1 (kolom) |
|---|---|
| familiarity | familiarity |
| trust | trust |
| emotional significance | emotional_significance |
| shared history | shared_history |
| conflict history | conflict_history |
| mutual understanding | mutual_understanding |
| current interpretation of relationship | interpretation |
| confidence in that interpretation | confidence |

**Protokol inti** (prioritas keselamatan, hak menolak, cara menolak yang tegas-sopan, hak tidak merespons, tetap profesional walau konflik) → sudah masuk §5 (garis intimidation) + §6 (hak berbeda pendapat).

**Care ≠ obedience, agent punya pendapat sendiri, konflik bukan kerusakan hubungan, larangan yes-man** → §6, sudah eksplisit.

**Emosi bukan script tetap** (bukan "kasih hadiah +10 happiness") → §7 (sistem tidak memakai log untuk nudge) sudah sejalan. Sisanya masuk B.

---

## B. Yang perlu DITAMBAH ke protokol (aditif, field/bagian baru)

1. **Internal emotional state** (calm/happy/curious/dst)
   → field ke-9: `emotional_state` (text, ditulis agen), plus `energy`.
   Jangan numpuk artinya ke 8 field lama. Aturan §8: mau nambah, tambah field ke-9.

2. **Touch interaction**
   → tabel/event baru `touch_events` (agent_id, user_id, part, created_at).
   Alur: touch → interpretasi agen → respons. Bukan tombol pemicu animasi.

3. **Condition (RPM / TPM / RPD)**
   → tabel `resource_state` (rpm, tpm, rpd, model, updated_at) + `condition_events` (sensasi: pegal / lelah / demam).
   Sumber angka = usage Gemini per tier. Ini yang bikin agen boleh turun model atau minta istirahat sendiri.

4. **Refusal & no-response logging**
   → sudah ada `risk_actions`; tambah verdict `declined` untuk penolakan yang SAH (bukan pelanggaran).

5. **Repair flow** (Recognize → Understand → Accept → Repair → Learn)
   → catat sebagai `activity_log.event_type = 'repair'`. Bukan script "sorry".

6. **Bahasa (Chat Meet)**
   → output kontrak: agen bicara Inggris + subtitle Indonesia, user bales Indonesia.
   Simpan dua field: `text_en` + `text_id` (atau satu teks + terjemahan), bukan satu blob.

7. **Multi-tier Gemini sebagai otak**
   → kompatibel: satu panggilan per peran, server-side. Tapi §7 tetap: **jangan** pakai model kedua untuk menghitung 8 field relationship.

---

## C. Modul di luar protokol pesan (jalan sendiri, bukan alur chat)

Ini fitur yang berdiri sendiri, nggak nyentuh §2 (alur satu pesan):

- **Full autonomous 01:00–04:00** → cron/job terjadwal, syarat wifi. Butuh flag `autonomous_allowed` + `network_type`. Di seluler: mati.
- **Simulasi fitur berat di seluler** → gate UI: Live Meet / panggilan suara minta konfirmasi dulu sebelum jalan pakai data seluler.
- **Reminder + alarm + lokasi** → tabel `reminders`, `alarms`; notifikasi pop-up + suara.
- **Calendar + period calendar** → tabel `calendar_events`, `period_events`; izin baca kalender HP.
- **Marketplace (≤ Rp20.000) + Store (≤ Rp10.000)** → tabel `products`, `store_items`, `orders`.
- **Saldo** → `wallet_ledger`; withdraw HANYA user, agen read-only.
- **Email agen** → halaman email agen.
- **Sosmed human-in-the-loop** → `social_accounts` (status: locked/open); agen cuma bisa buka kalau user sudah buka & login.

---

## D. Satu keputusan arsitektur yang HARUS kamu putuskan

Sistem lamamu: **1 wali = 1 agent**, tiap agent punya Supabase sendiri (user isi url + publishable key).

Masalahnya kuota: **Supabase free = 2 project aktif per akun.** Kalau tiap agent = 1 project, habis di 2 agent.

Opsi:
- (a) tetap 1 project per agent → cepet habis, mahal.
- (b) **satu project untuk semua agent + RLS by agent_id** → hemat, tapi semua data satu tempat.
- (c) hybrid: project milik user, banyak agent di dalamnya + RLS.

Aku nggak akan pilih ini diam-diam, ini keputusanmu.
Kalau (b) atau (c): tabel §3 tetap sama, cuma nambah policy RLS (kolom `agent_id` sudah ada di tiap baris).

---

## E. Yang TIDAK berubah tanpa versi baru

Tiga paku yang bikin sistem ini jujur:
1. Garis intimidation (§5)
2. Hak agen untuk berbeda (§6)
3. Larangan nudge dari log (§7)
