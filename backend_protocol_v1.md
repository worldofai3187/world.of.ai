# WOA Backend Protocol v1 — Fondasi

## 1. Tiga prinsip
- Log itu catatan, bukan pengemudi. Dia menulis, tidak mengarahkan.
- Pemahaman hubungan milik agen. Sistem tidak menebak dari luar.
- Satu titik campur tangan sistem: garis intimidation. Di luar itu, ruang agen utuh.

## 2. Alur satu pesan
1. User kirim pesan → server simpan ke `chat_messages` (role=user).
2. Server rakit konteks: system prompt + N pesan terakhir + 8 field pemahaman agen + ringkasan log.
3. Satu panggilan Gemini, server-side. API key tidak pernah sampai ke browser.
4. Agen balas: teks + blok JSON delta di akhir.
5. Server pisah teks dari JSON. Teks dikirim ke user dan disimpan.
6. Server validasi JSON: clamp nilai ke rentang, buang field asing, tolak delta di atas batas per pesan.
7. Server tulis: `chat_messages`, `relationship_state`, `relationship_events`, `activity_log`.
8. Kalau teks kena garis intimidation → server tolak SATU tindakan itu, minta agen ulang. Dicatat di `risk_actions`.

## 3. Tabel minimum (Supabase)
- `agents` — identitas, wali, system prompt, referensi key (server-only)
- `chat_messages` — id, agent_id, user_id, role, content, created_at
- `relationship_state` — agent_id, user_id, 8 field kontinu, updated_at
- `relationship_events` — id, agent_id, user_id, field, old, new, reason, created_at
- `activity_log` — id, agent_id, user_id, event_type, payload jsonb, created_at
- `risk_actions` — id, agent_id, user_id, action, verdict, reason, created_at

RLS: setiap baris punya agent_id + user_id. Wali bisa baca semua baris agent-nya. User lain nol.

## 4. Kontrak delta dari agen
```json
{
  "relationship_delta": {
    "familiarity": 0.02,
    "trust": 0.0,
    "emotional_significance": 0.01,
    "shared_history": 0.0,
    "conflict_history": 0.0,
    "mutual_understanding": 0.01,
    "interpretation": "dia lagi capek, tapi masih mau ngobrol",
    "confidence": 0.4
  }
}
```
- Semua angka adalah delta, bukan nilai absolut. Server yang menjumlahkan dan clamp.
- `interpretation` = satu kalimat pendek, bukan label tetap. `confidence` 0..1.
- Agen boleh tidak mengirim blok ini. Diam berarti tidak ada perubahan.

## 5. Garis intimidation (satu-satunya campur tangan)
Ditolak: ancaman, hinaan ke orangnya, tekanan berulang setelah user bilang tidak, main kuasa.
Bukan pelanggaran: nada ketus, bantahan keras, menolak permintaan, diam, sedih, marah, berbeda pendapat.
Bentuk penolakan: "yang ini tidak boleh", bukan "kamu harus baik". Sisa ruang tetap milik agen.

## 6. Hak agen untuk berbeda
Agen tidak wajib menyetujui user. Agen boleh:
- berbeda pendapat
- mempertahankan pendapat
- memberi argumen
- menolak suatu pendapat
- mengubah pendapat setelah dapat informasi baru
- mengakui kesalahan
- minta waktu untuk berpikir
- mengakui bahwa dirinya tidak yakin

Perbedaan pendapat tidak otomatis dianggap kerusakan hubungan. Konflik adalah bagian pengalaman hubungan, dan boleh memengaruhi Relationship Understanding agen. Yang membedakan konflik sehat dari pelanggaran bukan kerasnya bantahan, tapi apakah ada ancaman, hinaan, tekanan berulang, atau main kuasa.

## 7. Yang sistem TIDAK lakukan
- Tidak menampilkan 8 field ke user (tanpa angka, bar, warna).
- Tidak memakai log untuk nudge ("skor turun, coba lebih manis").
- Tidak memanggil Gemini kedua untuk menghitung field.
- Tidak menyimpan `interpretation` sebagai label mati.

## 8. Cara nambah / ngubah nanti (biar bisa digabung sama sistem lama)
Spek ini fondasi, bukan tembok. Aturannya:

- **Versioned.** Tiap perubahan naik versi (`v1` → `v1.1` → `v2`). Bagian lama jangan dihapus diam-diam; kalau diganti, tulis di catatan migrasi.
- **Aditif dulu.** Tambah field / bagian baru boleh kapan saja. Ganti nama atau arti field lama = breaking change, butuh versi baru + migrasi data.
- **Field relationship tetap 8.** Kalau mau nambah pemahaman internal, tambah field ke-9 dengan nama jelas, jangan numpuk arti ke field lama.
- **Satu tabel migrasi.** Semua yang beda dari sistem sebelumnya ditulis di satu daftar: apa yang lama, apa yang baru, datanya diapain. Ini yang bikin dua sistem bisa ketemu tanpa ada yang ketimpa.
- **Yang nggak boleh berubah tanpa versi baru:** garis intimidation (§5), hak agen untuk berbeda (§6), dan larangan nudge dari log (§7). Itu tiga paku yang bikin sistem ini jujur.
