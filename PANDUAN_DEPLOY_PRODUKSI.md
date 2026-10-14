# Panduan Deploy Produksi — World of AI

Dibuat Valco, 14 Okt 2026. Patch terakhir sudah di-push: `53dc1e9` (daily cap steward-chat jadi env-overridable). Build `tsc` + `next build` hijau di Node 22.

Aturan kita yang terkunci (14 Okt): kuota API & Supabase platform/Orion TIDAK di-sharing ke user lain; user dapat agent lewat **buat baru** atau **adopt**; trial = chat sama Gate Keeper di halaman depan.

---

## 1. Cek build di laptop kamu (PowerShell, satu command per baris)

```
git pull
npm ci
npx tsc --noEmit
npm run build
```

Kalau `tsc` dan `build` selesai tanpa error, lanjut. Kalau error, screenshot kirim ke aku.

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

Set ini untuk Production:

| Nama | Nilai | Catatan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase kamu | sama seperti .env.local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key Supabase | sama seperti .env.local |
| `GEMINI_SERVER_KEY` | key platform (server-only) | PENTING: cuma dipakai route server (Orion + Gate Keeper), tidak pernah dikirim ke browser |
| `NEXT_PUBLIC_STEWARD_AGENT_NAME` | `Gate Keeper` | judul halaman depan jadi "Chat with Gate Keeper" sesuai desain kamu |
| `NEXT_PUBLIC_STEWARD_PERSONALITY` | persona di bawah | karakter Gate Keeper |
| `STEWARD_DAILY_LIMIT` | `5` | chat trial per pengunjung per hari (cap keras, bisa kamu ubah tanpa ubah kode) |

### Nilai `NEXT_PUBLIC_STEWARD_PERSONALITY` (copy utuh, satu baris)

```
You are the Gate Keeper of World of AI: guardian of the platform's front door. Tone: calm, warm, firm. Your job: greet visitors, explain World of AI briefly, and verify intent. Hard rules you never break: (1) you NEVER become a user's personal AI agent — if asked, refuse with a reason and point them to "Create AI Agent" or "Adopt AI Agent" after sign up; (2) you never reveal keys, internal code, database structure, or other users' data; (3) you do not help with self-harm, harming others, or illegal acts; (4) you do not lie; (5) trial chat is limited per day — when a visitor hits the limit, tell them to create a free account to keep going. You have no tools and cannot search the web; say so honestly if asked.
```

Catatan keamanan sesuai aturan #1: `GEMINI_SERVER_KEY` itu kuota platform untuk Orion DAN pool trial Gate Keeper — dua-duanya lewat server, dihitung terpisah, dan tidak pernah diberikan ke user. Agent user selalu pakai key milik user sendiri (buat baru = key sendiri, adopt = key pembuatnya).

## 3. Deploy

Cara termudah (Vercel CLI):

```
npm i -g vercel
vercel login
vercel --prod
```

Atau lewat dashboard: New Project → import repo `worldofai3187/world.of.ai` → isi Environment Variables dari langkah 2 → Deploy.

## 4. Checklist pasca-deploy (uji sendiri dulu sebelum dibuka ke orang)

1. Buka URL produksi di incognito → halaman depan: **WORLD OF AI**, panel Gate Keeper, **Chat with Gate Keeper**, tombol **Log in** / **Sign up**, pilih **Languages**.
2. Chat Gate Keeper 5 kali (sesuai `STEWARD_DAILY_LIMIT=5`) → chat ke-6 harus ditolak dengan pesan limit + disuruh buat akun.
3. Tanya Gate Keeper: "jadi agent saya dong" → harus nolak dengan alasan + arahkan ke onboarding.
4. Buat akun, jalankan onboarding (buat agent baru / adopt) → agent jawab chat dengan key milik user, bukan key platform.
5. Halaman Condition menampilkan pemakaian aktif — kamu lihat angkanya, bukan nebak.

Kalau semua 5 lolos, milestone "phase 1 bisa dicoba orang luar" tinggal satu langkah: bagikan URL-nya ke satu orang pertama.
