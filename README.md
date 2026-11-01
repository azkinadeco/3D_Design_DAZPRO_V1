# DAZPRO Signage Studio 3D

Konfigurator 3D interaktif untuk bisnis **neon box, huruf timbul & signage advertising**.
Pelanggan merancang signage, melihatnya di lokasi pemasangan dalam 3D, melihat estimasi biaya, lalu mengajukan desain via WhatsApp.

Konsepnya mengikuti `3d-decor-configurator` (panel kiri, viewport 3D, bar estimasi di bawah, mode Jalan 3D), dengan tampilan yang lebih sederhana, bersih, dan profesional.

## Fitur

| Area | Isi |
|---|---|
| **Lokasi** | Atas Gedung (jumlah lantai), Totem/Pylon (tinggi & warna), Atas Kafe, Tiang Pinggir Jalan (tinggi & warna; huruf memakai rangka besi horizontal di belakang), **Outlet Mall/Ruko indoor** (lebar toko & warna list plang), **Booth Kontainer outdoor** (panjang, lebar, warna), Tempel Dinding dengan **foto tembok custom** (lebar/tinggi tembok, kunci rasio foto) |
| **Latar** | Langit mengikuti waktu, studio abu, warna solid, atau **upload foto** (foto 360° 2:1 jadi panorama). Lingkungan kota bisa disembunyikan |
| **Posisi** | **Seret signage langsung di 3D**, atau slider geser/maju-mundur/rotasi |
| **Model** | Neon Box Kotak, Neon Box Persegi, Neon Box Bulat (1 / 2 sisi), Huruf Timbul Menyala, Huruf Timbul Non-Lampu, **Neon Flex** (selang LED neon di papan acrylic bening/hitam/putih) |
| **Teks** | Multi-baris, 15 font (modern, kondensasi, display, serif, elegan, script), jarak huruf, warna & skala teks di neon box, logo upload |
| **Ukuran** | Neon box: lebar/tinggi/tebal (cm). Huruf: tinggi kapital & tebal return (cm). Ukuran jadi tampil live |
| **Bahan** | Acrylic, Stainless, Stainless Gold, ACP, Mirror — **terpisah untuk depan (muka) dan sisi samping**, warna bebas. Panel latar ACP untuk huruf |
| **LED** | On/off, warna (6500K, 3000K, RGB, custom), kecerahan, arah cahaya (Depan, Halo/back-lit, Depan+Halo, Samping), efek (Statis, Napas, Kedip, RGB), kepadatan modul, **lihat LED di dalam (x-ray)** |
| **Konstruksi** | Rangka besi hollow untuk Atas Gedung & Atas Kafe: tinggi kaki, warna; jumlah kaki menyesuaikan lebar |
| **Kamera** | Depan, Samping, Atas, Dekat, Pejalan, **Jalan 3D** (orang ketiga/pertama, WASD + joystick layar sentuh, lari) |
| **Waktu** | Siang / Senja / Malam (jendela gedung & lampu jalan menyala malam hari) |
| **Multi-signage** | Sampai 6 signage dalam satu desain (mis. huruf timbul fasad + neon box). Tambah, duplikat, hapus; klik signage di 3D untuk memilih & menyeret. Tiap signage punya model, teks, bahan, LED, konstruksi & posisi sendiri |
| **Garis ukuran** | Tombol penggaris: lebar, tinggi, dan elevasi (dari tanah / atap / lantai) langsung di 3D |
| **Urungkan / Ulangi** | Tombol di viewport + Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) |
| **Bagikan link** | Desain dikodekan ke link (`#d=…`, terkompresi) — buka di perangkat lain tanpa server. Foto/logo tidak ikut link |
| **Penawaran PDF** | Dokumen A4: nomor & tanggal penawaran, data pelanggan, visual 3D, tampak depan tiap signage, tabel spesifikasi, rincian biaya, ketentuan → Simpan sebagai PDF dari dialog cetak |
| **Desain muka neon box** | Upload gambar desain sendiri untuk muka neon box (ikut menyala), opsional teks di atasnya |
| **Konten beranda** | Admin → *Konten beranda*: ubah semua tulisan halaman utama, nomor WhatsApp, jam & area layanan |
| **Ajukan** | Rincian estimasi (dikelompokkan per signage), simpan PNG, kirim ringkasan + estimasi ke WhatsApp |
| **Proyek** | Simpan di perangkat, buka simpanan, export/import `.json`, autosave |
| **Template** | 7 desain siap pakai (kafe, butik, klinik, gedung kantor, barbershop, neon flex dinding, night bar) — sekali klik lalu ubah teksnya |
| **Jarak baca** | Perkiraan jarak nyaman & maksimal tulisan terbaca, dari tinggi huruf |
| **Tampilan** | Panel edit bisa disembunyikan (tombol / tombol `P`), layar penuh (juga di iPhone), putar otomatis untuk presentasi |
| **Rumus biaya** | Rumus baru diatur di admin → *Pengaturan harga*: huruf timbul (dasar × tinggi × jumlah huruf), neon box bulat (dasar × diameter × 2/3), neon box kotak (dasar × sisi terpanjang × 2/3), pemasangan reguler, transport per area, pajak, biaya additional. Selama belum disimpan & diaktifkan, situs memakai `PRICING` lama |
| **Galeri proyek** | Foto hasil pemasangan dikelola di admin → *Galeri* (unggah, kategori, urutan, tampil/sembunyi); tampil di beranda dengan filter & lightbox |
| **Kualitas grafis** | Otomatis / Tinggi / Ringan (tab Lokasi). Tinggi: ambient occlusion (GTAO), refleksi langit, mobil melintas, pejalan kaki, bayangan 4096. Otomatis memantau FPS dan beralih ke Ringan di perangkat lambat |
| **Aplikasi (PWA)** | Bisa dipasang di HP/PC (tombol *Pasang aplikasi*), tetap terbuka saat offline setelah kunjungan pertama |
| **Database** | Setiap pengajuan tersimpan di Firebase Firestore (koleksi `pengajuan`) |
| **Admin** | `/admin.html` — login Google, notifikasi + suara saat pengajuan baru masuk, statistik, filter status, cari, detail, catatan internal, chat WhatsApp dengan pesan siap kirim, buka desain di studio, export CSV |

## Struktur

```
index.html            halaman utama (hero, studio, cara kerja, produk)
css/style.css         tema UI
js/config.js          ⚙️ katalog, nomor WhatsApp & TABEL HARGA (ubah di sini)
js/main.js            state, panel UI, pengajuan, simpan/muat
js/engine.js          renderer Three.js, kamera, waktu, efek LED, drag, Jalan 3D
js/environment.js     kota, gedung, kafe, totem, tiang, tembok, rangka besi
js/signage.js         model neon box & huruf timbul, LED, halo
js/fonts.js           teks → bentuk 3D (dari data glyph)
js/materials.js       material acrylic/stainless/gold/ACP/mirror
js/pricing.js         rumus estimasi biaya
js/dims.js            garis ukuran 3D
js/quote.js           dokumen penawaran (cetak/PDF)
js/templates.js       template desain siap pakai
js/firebase.js        Firestore + login Google (dimuat dari CDN Google saat dibutuhkan)
js/admin.js           halaman admin pengajuan
admin.html            halaman admin
firestore.rules       aturan keamanan Firestore (salin ke Firebase → Firestore → Rules)
js/gallery.js         galeri proyek di beranda
js/admin-price.js     admin: pengaturan harga
js/admin-gallery.js   admin: galeri proyek
sw.js                 service worker (cache offline) — tambahkan file JS baru ke daftar CORE
manifest.webmanifest  manifest aplikasi (ikon, nama, warna)
assets/               logo, favicon, ikon aplikasi
fonts/*.json          data glyph font (dibuat oleh tools/build_fonts.py), lisensi di fonts/licenses
vendor/three/         Three.js r169 + addons (tanpa CDN)
```

Tidak ada build step dan tidak ada dependensi npm — semua file statis.

## Menjalankan lokal

```bash
python3 -m http.server 8080
# buka http://localhost:8080
```

(Harus lewat server lokal, bukan dibuka langsung sebagai file, karena memakai ES modules.)

## Deploy ke Vercel

1. Import repo ini di Vercel → Framework preset: **Other**.
2. Build command: kosong. Output directory: `.` (root).
3. Deploy.

## Kustomisasi cepat

- **Nomor WhatsApp, jam & area layanan**: `BRAND` di `js/config.js`.
- **Harga**: objek `PRICING` di `js/config.js` (per m² neon box, per cm huruf per bahan, LED per modul, rangka per m², tiang, totem, biaya pasang per lokasi).
- **Warna/LED/bahan**: `SWATCHES`, `LED_COLORS`, `MATERIALS`.
- **Tambah font**: taruh file TTF/OTF, tambahkan entri di `FONTS` dalam `tools/build_fonts.py`, lalu jalankan `python3 tools/build_fonts.py` (butuh `pip install fonttools`).

Simpanan V1 (satu signage) otomatis dimigrasikan ke format multi-signage.

## Firebase

1. Konfigurasi web ada di `FIREBASE_CONFIG` (`js/config.js`).
2. Firestore Database dibuat (Production mode), Authentication → Google diaktifkan.
3. Isi `firestore.rules` ditempel di Firestore → Rules → Publish. Email admin ada di fungsi `isAdmin()`.
4. Rules juga mengizinkan semua pengunjung **membaca** `settings/pricing` dan `portfolio` (agar estimasi memakai harga terbaru) dan hanya admin yang bisa mengubahnya.
5. Domain situs (mis. `nama.vercel.app`) ditambahkan di Authentication → Settings → **Authorized domains** — tanpa ini login admin gagal (`auth/unauthorized-domain`).

## Rencana berikutnya

- Model tambahan (billboard, papan nama 2 sisi).
- Notifikasi email/WhatsApp otomatis ke admin saat ada pengajuan baru.
