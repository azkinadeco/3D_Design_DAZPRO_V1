# DAZPRO Signage Studio 3D (V1)

Konfigurator 3D interaktif untuk bisnis **neon box, huruf timbul & signage advertising**.
Pelanggan merancang signage, melihatnya di lokasi pemasangan dalam 3D, melihat estimasi biaya, lalu mengajukan desain via WhatsApp.

Konsepnya mengikuti `3d-decor-configurator` (panel kiri, viewport 3D, bar estimasi di bawah, mode Jalan 3D), dengan tampilan yang lebih sederhana, bersih, dan profesional.

## Fitur

| Area | Isi |
|---|---|
| **Lokasi** | Atas Gedung (jumlah lantai), Totem/Pylon (tinggi & warna), Atas Kafe, Tiang Pinggir Jalan (tinggi & warna), Tempel Dinding dengan **foto tembok custom** (lebar/tinggi tembok, kunci rasio foto) |
| **Latar** | Langit mengikuti waktu, studio abu, warna solid, atau **upload foto** (foto 360° 2:1 jadi panorama). Lingkungan kota bisa disembunyikan |
| **Posisi** | **Seret signage langsung di 3D**, atau slider geser/maju-mundur/rotasi |
| **Model** | Neon Box Kotak, Neon Box Persegi, Neon Box Bulat, Huruf Timbul Menyala, Huruf Timbul Non-Lampu |
| **Teks** | Multi-baris, 15 font (modern, kondensasi, display, serif, elegan, script), jarak huruf, warna & skala teks di neon box, logo upload |
| **Ukuran** | Neon box: lebar/tinggi/tebal (cm). Huruf: tinggi kapital & tebal return (cm). Ukuran jadi tampil live |
| **Bahan** | Acrylic, Stainless, Stainless Gold, ACP, Mirror — **terpisah untuk depan (muka) dan sisi samping**, warna bebas. Panel latar ACP untuk huruf |
| **LED** | On/off, warna (6500K, 3000K, RGB, custom), kecerahan, arah cahaya (Depan, Halo/back-lit, Depan+Halo, Samping), efek (Statis, Napas, Kedip, RGB), kepadatan modul, **lihat LED di dalam (x-ray)** |
| **Konstruksi** | Rangka besi hollow untuk Atas Gedung & Atas Kafe: tinggi kaki, warna; jumlah kaki menyesuaikan lebar |
| **Kamera** | Depan, Samping, Atas, Dekat, Pejalan, **Jalan 3D** (orang ketiga/pertama, WASD + joystick layar sentuh, lari) |
| **Waktu** | Siang / Senja / Malam (jendela gedung & lampu jalan menyala malam hari) |
| **Ajukan** | Rincian estimasi, simpan PNG, kirim ringkasan + estimasi ke WhatsApp |
| **Proyek** | Simpan di perangkat, buka simpanan, export/import `.json`, autosave |

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

## Rencana berikutnya (belum di V1)

- Panel admin + database pengajuan (seperti `/admin` di project dekorasi).
- Link desain yang bisa dibagikan (`/d/<kode>`).
- Ekspor PDF penawaran.
