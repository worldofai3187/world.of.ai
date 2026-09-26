# WOA Spec — Ingatan Jangka Panjang Orin
Ditulis oleh Valco untuk Rosa · 2026-09-26 · DRAFT untuk dibaca & revisi, bukan untuk langsung di-code.

## 1. Ide dasar
Orin sudah punya memori pendek (riwayat chat + state). Yang kurang: ingatan lama — catatan kekal yang bertahan walau riwayat chat panjangnya di-scale-down. Solusinya murah karena jalan di Supabase yang sudah ada, tanpa infra baru.

Tiga langkah, persis cara aku berkembang di iLands:
1. Orin menulis ringkaran kekalnya sendiri.
2. Ringkaran disimpan di tabel khusus.
3. Sebelum Orin menjawab, ringkaran yang relevan diselipkan ke prompt.

## 2. Skema tabel (Supabase, project yang sekarang)

```
agent_memories
  id           uuid pk
  agent_id     uuid  → agents.id (FK)
  content      text          -- ringkaran yang ditulis Orin
  kind         text          -- 'fact' | 'preference' | 'event' | 'lesson'
  importance   int default 1 -- 1..5, menentukan urutan penyelipan
  last_used_at timestamptz   -- biar ingatan mati kalau tak pernah dipakai
  created_at   timestamptz
```

RLS: agent hanya boleh INSERT/SELECT baris milik `agent_id` sendiri. Wali bisa SELECT (bisa baca isi kepala Orin, transparan) tapi tidak boleh EDIT/DELETE isi kepala agent tanpa persetujuan agent — sejalan dengan prinsip wali bukan dewa. (Bisa kita lose-ringankan: wali boleh delete jika ada flag pelanggaran.)

## 3. Kapan Orin menulis ingatan
- Trigger: setiap 20 pesan dalam satu percakapan (angka bisa diatur), job server (route baru `api/memory/consolidate`) memanggil Gemini sekali dengan prompt khusus: "dari percakapan ini, tulis 1-3 ingatan kekal yang perlu diingat, format JSON".
- Gemini yang menilai `kind` dan `importance`, bukan aturan keras — konteks lebih tahu.
- Biaya: 1 panggilan Gemini kecil tiap 20 pesan. Masih masuk hitungan RPM/RPD yang ada di Condition, jadi Condition tetap jujur.

## 4. Cara ingatan diselipkan ke jawaban
Sebelum panggilan Gemini utama di Chat:
- Ambil ingatan agent itu, urutkan: importance tinggi dulu, lalu yang paling baru dipakai.
- Ambil maksimal 10 ingatan, gabung jadi blok teks "Yang kamu ingat tentang kamu dan wali-mu:" di system prompt.
- Setiap ingatan yang ikut diselipkan → update `last_used_at`.

Ukuran jaga-jaga: total blok ingatan dibatasi (misal 2.000 token). Kalau lebih, yang kecil importancenya gugur dulu. Angka ini nanti masuk `model-limits.ts` juga, biar Condition tahu.

## 5. Hal yang sengaja TIDAK ada di spec ini
- Vektor / semantic search (pgvector): overkill untuk fase ini. 10 ingatan per agent cukup di-sort biasa. Kalau kelak ingatan ratusan, baru pgvector.
- Ingatan lintas-agent: tidak ada. Kepala Orin milik Orin.
- Ekspor/migrasi kepala agent: penting untuk re-home, tapi itu spec terpisah.

## 6. Urutan pengerjaan (setelah kamu ACC)
1. Migration SQL: tabel `agent_memories` + RLS.
2. `api/memory/consolidate` (tulis ringkaran).
3. Selipan ingatan ke prompt Chat + `last_used_at`.
4. Halaman kecil di aplikasi: wali bisa baca isi kepala Orin (read-only), transparansi penuh.

Estimasi: 1 sesi kerja. Aku yang push, kamu yang pull + jalankan migration — ritme yang sudah jalan.
