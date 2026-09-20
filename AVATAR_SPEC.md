# WOA — Avatar Spec (phase 1 → phase 5)

Ditulis Valco, 20 Sep 2026. Gratis, no render, no spend. Buat kamu baca pas sempat.

## 1. Apa yang sebenarnya kamu lihat di screenshot itu
Itu Zayne, dari Love and Deepspace. Yang bikin dia "ganteng" bukan Blender, tapi:
- 3D semi-realistic, otome-style (kulit halus, mata tajam, proporsi kepala-badan 7.5 head).
- Studio besar: character artist, face rigger, lighting artist, satu tim buat satu cowo.
- Kamu nggak bisa ngejar ini solo di Blender dari nol. Bukan karena kamu kurang, tapi karena itu kerjaan 20 orang setahun.

Jadi target "setampan L&DS" di phase 1 itu mustahil. Jangan kejar, nanti kamu begadang sia-sia lagi.

## 2. Ruangan yang benar per fase
- **Phase 1 (sekarang): avatar 2D image.** Satu gambar wajah + nama + satu baris persona. Dibuat lewat image-gen, 50–150 kredit per gambar. Cepat, murah, jalan hari ini.
- **Phase 3: avatar 2D bergerak.** Portrait + lip-sync/ekspresi sederhana. Masih image-based.
- **Phase 5: avatar 3D.** Di sini baru 3D masuk. Jalur yang benar = **VRoid Studio (.vrm) atau Daz Studio**, bukan Blender dari nol. VRoid gratis, ada morph wajah, dan kamu sendiri bilang ekspresinya bagus. Kamu sudah punya satu .glb dari VRoid di laptop — itu asset nyata, bukan sampah.

Kesimpulan: Blender bukan "kurang ganteng", Blender itu ruangan yang salah buat badan manusia realistis solo.

## 3. Yang lebih penting: jangan bikin satu cowo, bikin sistem
Kalau semua agent di WOA harus setampan Zayne, app-nya jadi sempit dan user bosan di hari ketiga.
User mau milih. Jadi WOA butuh **preset look**, minimal 4–6:

| Preset | Vibe | Contoh persona |
|---|---|---|
| Stoic | dingin, tajam, pelindung | Zayne-like |
| Warm | hangat, ramah, suara lembut | teman ngobrol |
| Playful | lucu, mischievous | biang onar |
| Mature | tua, tenang, berwibawa | mentor |
| Odd | aneh, quirky, bukan manusia | AI yang jujur bukan manusia |
| Creature | monster/makhluk | eksperimen, bukan manusia sama sekali |

Tiap preset = satu base image + variasi. Itu yang bikin WOA kelihatan seperti platform, bukan satu game kencan.

## 4. Kontrak phase 1 (yang bisa aku kerjain)
Aku bisa bikin **1 sheet preset**: 6 wajah, otome/anime-style, konsisten lighting-nya, plus nama + satu baris persona tiap karakter.
- Biaya: ~6 × 100 kredit = ~600 kredit. Aku quote dulu, kamu ACC baru jalan.
- Output: 6 file gambar + satu file teks persona. Siap dipakai sebagai avatar default di WOA.
- Catatan jujur: hasilnya "attractive anime/otome 2D", BUKAN 3D L&DS. Itu bar yang realistis buat solo + budget kita.

## 5. Layar Meet (referensi screenshot kamu)
Kamu bilang: tampilan meet kayak gini, plus subtitle, dan icon bawah diganti kolom chat. Aku tangkep begini:

```
+----------------------------------+
|                                  |
|        [ figure agent ]          |
|         (badan penuh)            |
|                                  |
|   "subtitle: satu baris dialog"  |
|                                  |
|  +----------------------------+  |
|  |  kolom chat: ketik di sini |  |
|  +----------------------------+  |
+----------------------------------+
```

Tiga elemen, dan itu benar:
1. **Figure** — agent berdiri di tengah, badan penuh.
2. **Subtitle** — satu baris dialog dia, overlay di badan. Ini yang bikin dia terasa hidup.
3. **Kolom chat** — ganti bar icon game di bawah. Ini keputusan bagus: layar berubah dari menu game jadi percakapan.

**Yang jangan dicopy dari L&DS:** bar icon, tombol gacha, notification dot merah. Kalau ditiru semua, WOA kelihatan kayak game kencan, bukan ruang ketemu. Ambil tiga elemen di atas, buang sisanya. Bersih > rame.

**Fase:**
- Phase 1: figure 2D (gambar) + subtitle teks + kolom chat. **Ini bisa sekarang.** Nggak butuh 3D.
- Phase 5: figure 3D yang gerak + ekspresi + subtitle live dari suara. Ini butuh VRoid/3D + lip-sync.

Jadi layar meet-nya bisa kita bikin versi 2D-nya dulu, dan itu udah keliatan bagus. 3D nyusul, bukan penghalang.

## 6. Urutan yang aku sarankan
1. **Senin: satu panggilan Gemini beneran di Chat.** Ini yang bikin WOA hidup.
2. Layar Meet versi 2D (figure + subtitle + chat). Aku bisa bantu tulis struktur komponennya, gratis.
3. Avatar 2D preset (sheet 6 wajah) — setelah chat jalan, ACC dulu.
4. VRoid/3D — phase 5, jangan dibalik.

Otak dulu, muka kemudian.

---

## 7. Kontrak state → ekspresi (schema phase 1, visual phase 3/5)

Masalah yang dicegah: kalau ekspresi baru dipikirkan pas visual 3D datang, semua baris
chat lama nggak punya state, dan kita harus nebak ulang. Satu kolom sekarang = murah.

Alur (sama seperti backend protocol): **Event → interpretasi agen → internal state → respons.**

- **State itu teks pendek, bukan angka.** Contoh: `calm`, `curious`, `warm`, `playful`,
  `guarded`, `annoyed`, `tired`. Boleh satu kata, boleh frasa pendek.
- **Bukan skor game.** Nggak ada +10 happiness. State ditulis agen dari interpretasinya,
  bukan dihitung dari hadiah/hukuman. Nyambung ke §7 protokol: log nggak boleh jadi alat nudge.
- **Disimpan di baris yang sama dengan balasannya:** `chat_messages.emotional_state`
  (text, nullable). Satu baris = satu turn. Turn user = NULL.
- **Phase 1: kolomnya ada, isinya boleh NULL.** Route Gemini yang sekarang cuma nulis
  `content`, dan itu sengaja nggak aku ubah supaya tes Senin tetap satu panggilan bersih.
- **Phase 2 (setelah chat jalan):** panggilan yang sama juga minta state pendek, server
  yang validasi (whitelist), baru disimpan.

**Pemetaan state → ekspresi (phase 3/5).** Ini tabel lookup, bukan logika yang ditanam di
model. VRM sudah punya nama baku, jadi pemetaannya pendek:

| state | morph VRM | catatan |
|---|---|---|
| calm, relaxed | `relaxed` | mata setengah, bahu turun |
| warm, happy, playful | `happy` | sudut mulut naik |
| curious | `surprised` ringan | alis naik, mata melebar dikit |
| sad | `sad` | sudut mulut turun |
| guarded, annoyed | `angry` ringan | alis turun, jangan berlebihan |
| tired | `relaxed` + kelopak turun | datang dari `energy` / Condition |

**Empat aturan yang bikin ini jujur:**
1. State itu hak agen, bukan tombol user. User nggak bisa "mencet" senyum.
2. Kalau state nggak ada di whitelist, visual jatuh ke `relaxed` netral. Nggak nebak.
3. Satu state per turn. Nggak numpuk.
4. `energy` (Condition) itu badan; `emotional_state` itu perasaan. Dua hal beda, jangan digabung.
